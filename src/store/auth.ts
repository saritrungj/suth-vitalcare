import { reactive } from "vue";
import { readStoredUser, writeStoredUser } from "./authSession";

const initialUser = readStoredUser();

export const authStore = reactive({
  isDevModeEnabled: false,
  isAdminMode: false,
  user: initialUser as any,
  loading: !initialUser,
  // Is the user operating in Admin mode right now?
  // Used for conditional UI rendering and routing
  get isAdminRoleActive(): boolean {
    return this.isAdminMode && this.user?.role === "admin";
  },
  // Default permissions if not loaded from DB
  permissions: {
    admin: { admin: true, missions: true, rewards: true, rankings: true },
    user: { admin: false, missions: true, rewards: true, rankings: true },
  },
  saveUser() {
    writeStoredUser(this.user);
  },
  setUser(userData: any) {
    this.user = userData;
    this.loading = false;
    this.saveUser();
  },
  hasPermission(module: string) {
    if (!this.user) return false;
    const role = (this.user.role || "user").toLowerCase();
    const rolePerms = (this.permissions as any)[role] || this.permissions.user;
    return !!rolePerms[module];
  },
  enableDevMode() {
    this.isDevModeEnabled = true;
  },
  toggleAdminMode() {
    this.isAdminMode = !this.isAdminMode;
  },
});
