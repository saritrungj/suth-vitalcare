import { onMounted, onUnmounted, getCurrentInstance } from "vue";
import { io, Socket } from "socket.io-client";
let singleton: Socket | null = null;
let singletonRefCount = 0;
function getSocket(): any {
  if (!singleton) {
    singleton = io({
      path: "/socket.io",
      transports: ["polling", "websocket"], // polling FIRST for ngrok compatibility, then upgrades to websocket
      reconnectionAttempts: Infinity,
      reconnectionDelay: 2000,
      timeout: 20000,
    });
    singleton.on("connect", () => {
      // connected
    });
    singleton.on("disconnect", (reason) => {
      // disconnected
    });
    singleton.on("connect_error", (err) => {
      // connection error
    });
    // Add explicit mobile reconnect trigger + session re-validate
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") {
          // 1. Reconnect socket if dropped while in background
          if (singleton && singleton.disconnected) {
            singleton.connect();
          }
          // 2. Re-validate session with server (catches deleted/banned accounts on mobile)
          import("../lib/liff").then(({ validateSessionWithServer }) => {
            validateSessionWithServer().catch(() => {});
          });
        }
      });
    }
  }
  return singleton;
}
export function useRealtime(callbacks: {
  onSubmissionCreated?: (data: any) => void;
  onSubmissionUpdated?: (data: any) => void;
  onUserUpdated?: (data: any) => void;
  onActivityCreated?: (data: any) => void;
  onActivityUpdated?: (data: any) => void;
  onActivityDeleted?: (data: any) => void;
  onActivityRequestCreated?: (data: any) => void;
  onActivityRequestUpdated?: (data: any) => void;
  onTeamCreated?: (data: any) => void;
  onTeamUpdated?: (data: any) => void;
  onTeamDeleted?: (data: any) => void;
  onTeamJoined?: (data: any) => void;
  onTeamLeft?: (data: any) => void;
  onTeamKicked?: (data: any) => void;
  onBannerCreated?: (data: any) => void;
  onBannerDeleted?: (data: any) => void;
  onSubmissionDeleted?: (data: any) => void;
  onUserKicked?: (data: any) => void;
  onNotificationCreated?: (data: any) => void;
}) {
  const handlers: [string, (data: any) => void][] = [];
  const addListener = (
    event: string,
    cb: ((data: any) => void) | undefined,
  ) => {
    if (!cb) return;
    const wrapped = (data: any) => {
      cb(data);
    };
    handlers.push([event, wrapped]);
    getSocket().on(event, wrapped);
  };
  const setup = () => {
    singletonRefCount++;
    addListener("SUBMISSION_CREATED", callbacks.onSubmissionCreated);
    addListener("SUBMISSION_UPDATED", callbacks.onSubmissionUpdated);
    addListener("SUBMISSION_DELETED", callbacks.onSubmissionDeleted);
    addListener("USER_UPDATED", callbacks.onUserUpdated);
    addListener("ACTIVITY_CREATED", callbacks.onActivityCreated);
    addListener("ACTIVITY_UPDATED", callbacks.onActivityUpdated);
    addListener("ACTIVITY_DELETED", callbacks.onActivityDeleted);
    addListener("ACTIVITY_REQUEST_CREATED", callbacks.onActivityRequestCreated);
    addListener("ACTIVITY_REQUEST_UPDATED", callbacks.onActivityRequestUpdated);
    addListener("TEAM_CREATED", callbacks.onTeamCreated);
    addListener("TEAM_UPDATED", callbacks.onTeamUpdated);
    addListener("TEAM_DELETED", callbacks.onTeamDeleted);
    addListener("TEAM_JOINED", callbacks.onTeamJoined);
    addListener("TEAM_LEFT", callbacks.onTeamLeft);
    addListener("TEAM_KICKED", callbacks.onTeamKicked);
    addListener("BANNER_CREATED", callbacks.onBannerCreated);
    addListener("BANNER_DELETED", callbacks.onBannerDeleted);
    addListener("USER_KICKED", callbacks.onUserKicked);
    addListener("NOTIFICATION_CREATED", callbacks.onNotificationCreated);
  };
  const cleanup = () => {
    const sock = singleton;
    if (sock) {
      handlers.forEach(([event, handler]) => sock.off(event, handler));
    }
    singletonRefCount--;
    // Don't disconnect - keep singleton alive so App.vue always stays connected
  };
  // If called inside a component (has instance), use lifecycle hooks
  if (getCurrentInstance()) {
    onMounted(setup);
    onUnmounted(cleanup);
  } else {
    // Called outside component (e.g. top-level script) - setup immediately
    setup();
  }
}
