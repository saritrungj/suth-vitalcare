// useAdminUsers.ts
import { ref, computed, watch, onMounted, onUnmounted } from "vue";
import { authStore } from "../store/auth";
import { uiStore } from "../store/ui";
import { useSWR } from "./useSWR";
import { useRoute, useRouter } from "vue-router";
import { showSuccess, showError, showConfirm } from "../lib/swal";
import type { SmartTableColumn } from "../components/common/SmartTable.vue";

export function useAdminUsers() {
  const route = useRoute();
  const router = useRouter();
  // ── Dropdown Constants ──────────────────────────────────
  const roleTypes = [
    "นักเรียน",
    "นักศึกษา",
    "บุคลากรโรงพยาบาล",
    "บุคลากรมหาวิทยาลัย",
    "บุคคลทั่วไป",
  ];
  const schoolLevels = ["ม.1", "ม.2", "ม.3", "ม.4", "ม.5", "ม.6"];
  const uniFaculties = [
    "สำนักวิชาวิทยาศาสตร์",
    "สำนักวิชาเทคโนโลยีสังคม",
    "สำนักวิชาเทคโนโลยีการเกษตร",
    "สำนักวิชาวิศวกรรมศาสตร์",
    "สำนักวิชาแพทยศาสตร์",
    "สำนักวิชาพยาบาลศาสตร์",
    "สำนักวิชาทันตแพทยศาสตร์",
    "สำนักวิชาสาธารณสุขศาสตร์",
    "สำนักวิชาศาสตร์และศิลป์ดิจิทัล",
  ];
  const uniYears = ["ปี 1", "ปี 2", "ปี 3", "ปี 4", "ปี 5", "ปี 6"];
  const mainGoals = [
    "ลดน้ำหนัก",
    "เพิ่มกล้ามเนื้อ",
    "เพิ่มการเดิน",
    "นอนหลับให้ดีขึ้น",
    "รักษาสุขภาพทั่วไป",
  ];

  // ── Data ────────────────────────────────────────────────
  const users = ref<any[]>([]);
  const {
    data: swrUsers,
    isValidating: loadingUsers,
    mutate,
  } = useSWR<any[]>(() => (authStore.user?.id ? "/api/users" : null), {
    revalidateOnFocus: true,
  });

  watch(
    swrUsers,
    (nv) => {
      if (nv) users.value = nv;
    },
    { immediate: true },
  );

  let realtimeTimeout: any = null;
  watch(
    () => uiStore.lastRealtimeUpdate,
    () => {
      if (realtimeTimeout) clearTimeout(realtimeTimeout);
      realtimeTimeout = setTimeout(() => {
        mutate();
      }, 1500);
    },
  );

  // ── Table state ─────────────────────────────────────────
  const statusFilter = ref<"all" | "active" | "suspended" | "banned">("all");
  const roleFilter = ref("all");
  const selectedIds = ref<number[]>([]);
  const activeMenuId = ref<number | null>(null);

  const menuPos = ref({ top: 0, left: 0 });
  const toggleMenu = (id: number, e?: Event) => {
    if (activeMenuId.value === id) {
      activeMenuId.value = null;
    } else {
      activeMenuId.value = id;
      if (e && e.currentTarget) {
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        menuPos.value = {
          top: rect.bottom + window.scrollY,
          left: rect.right + window.scrollX,
        };
      }
    }
  };
  const activeMenuUser = computed(
    () => filtered.value.find((u) => u.id === activeMenuId.value) || null,
  );

  // ── Filters & sort ──────────────────────────────────────
  const filtered = computed(() => {
    // 1. กรองข้อมูลตาม Status และ Role ก่อน
    const baseFiltered = users.value.filter((u) => {
      const matchStatus =
        statusFilter.value === "all" ||
        (statusFilter.value === "active" && !u.is_suspended) ||
        (statusFilter.value === "suspended" && u.is_suspended === 1) ||
        (statusFilter.value === "banned" && u.is_suspended === 2);
      const matchRole =
        roleFilter.value === "all" || u.role === roleFilter.value;
      return matchStatus && matchRole;
    });

    // 2. คืนค่าตามที่กรองไว้ (ยกเลิกการขยับรายการที่เลือกขึ้นด้านบนเพื่อให้ตารางไม่เคลื่อน)
    return baseFiltered;
  });

  // ── Status counts ────────────────────────────────────────
  const counts = computed(() => ({
    all: users.value.length,
    active: users.value.filter((u) => !u.is_suspended).length,
    suspended: users.value.filter((u) => u.is_suspended === 1).length,
    banned: users.value.filter((u) => u.is_suspended === 2).length,
  }));

  // ── Helpers ──────────────────────────────────────────────
  const fmtDate = (d: string) => {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("th-TH", {
      day: "2-digit",
      month: "short",
      year: "2-digit",
    });
  };

  const formatPhone = (val: string) => {
    if (!val) return "";
    const digits = val.replace(/\D/g, "").slice(0, 10);
    let formatted = digits;
    if (digits.length > 6) {
      formatted = `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
    } else if (digits.length > 3) {
      formatted = `${digits.slice(0, 3)}-${digits.slice(3)}`;
    }
    return formatted;
  };

  const avatar = (u: any) => {
    if (u.line_picture_url) return u.line_picture_url;
    if (u.picture_url) return u.picture_url;
    return getInitialsAvatar(u);
  };

  const getInitialsAvatar = (u: any) => {
    const name = displayName(u);
    const initials =
      name
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((n: string) => n[0])
        .join("")
        .toUpperCase() || "?";

    // Premium Gradient Palettes
    const palettes = [
      ["#FF9D6C", "#FF6239"], // Orange-Red
      ["#6EE7B7", "#10B981"], // Emerald-Green
      ["#93C5FD", "#3B82F6"], // Blue
      ["#F9A8D4", "#EC4899"], // Pink
      ["#C4B5FD", "#8B5CF6"], // Violet
      ["#5EEAD4", "#14B8A6"], // Teal
      ["#FDE68A", "#F59E0B"], // Amber
      ["#94A3B8", "#475569"], // Slate
    ];

    const [c1, c2] = palettes[(u.id || 0) % palettes.length];

    const svg = `
      <svg width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="grad${u.id}" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:${c1};stop-opacity:1" />
            <stop offset="100%" style="stop-color:${c2};stop-opacity:1" />
          </linearGradient>
        </defs>
        <rect width="100" height="100" rx="28" fill="url(#grad${u.id})" />
        <text x="50%" y="50%" font-family="'Sarabun', sans-serif" font-size="42" font-weight="bold" fill="white" text-anchor="middle" dy=".35em">${initials}</text>
      </svg>
    `.trim();

    return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
  };

  const roleBadge = (role: string) => {
    const m: Record<string, string> = {
      super_admin: "bg-purple-100 text-purple-700 border-purple-200",
      admin: "bg-orange-100 text-orange-700 border-orange-200",
      user: "bg-slate-100 text-slate-600 border-slate-200",
      host: "bg-slate-100 text-slate-600 border-slate-200", // Treat host as user visually
    };
    return m[role] || m["user"];
  };

  const roleLabel = (u: any) => {
    let label = (u.role === "host" ? "user" : u.role).toUpperCase();
    if (u.is_team_host) {
      label += " (หัวหน้าทีม)";
    }
    return label;
  };

  const statusBadge = (u: any) => {
    if (u.is_suspended === 2)
      return "bg-rose-100 text-rose-700 border-rose-200";
    if (u.is_suspended === 1)
      return "bg-amber-100 text-amber-700 border-amber-200";
    return "bg-emerald-100 text-emerald-700 border-emerald-200";
  };

  const statusLabel = (u: any) => {
    if (u.is_suspended === 2) return "ระงับบัญชีถาวร";
    if (u.is_suspended === 1) return "ระงับการใช้งาน";
    return "ปกติ";
  };

  const displayName = (u: any) =>
    `${u.fname_th || ""} ${u.lname_th || ""}`.trim() || u.nickname || "—";

  // ── Popup/Modal state ────────────────────────────────────
  const modal = ref<"edit" | "ban" | "view" | "enroll" | null>(null);
  const target = ref<any>(null);
  const editForm = ref<any>({});
  const editTanita = ref<any>({});
  const viewTanita = ref<any>({});
  const banReason = ref("");
  const banType = ref<"suspend" | "ban">("ban");
  const submitting = ref(false);

  // --- Enrollment state ---
  const allActivities = ref<any[]>([]);
  const userRegistrations = ref<any[]>([]);
  const loadingRegistrations = ref(false);

  // --- Sync Modal with URL ---
  watch(
    () => [route.query.sub, route.query.id, users.value],
    ([newSub, newId, userList]) => {
      const sub = String(newSub || "");
      const validSub = ["edit", "ban", "view", "enroll"].includes(sub);

      if (validSub) {
        modal.value = sub as any;
        if (newId && Array.isArray(userList) && userList.length > 0) {
          const found = userList.find(
            (u: any) => u.id === Number(newId),
          ) as any;
          if (found && (!target.value || target.value.id !== found.id)) {
            // We found the user, but we should only trigger the full setup
            // if we didn't already have this user set (to avoid infinite setup loops)
            setupModalData(sub as any, found);
          }
        }
      } else if (!sub && modal.value) {
        modal.value = null;
        target.value = null;
      }
    },
    { immediate: true },
  );

  const setupModalData = (
    type: "edit" | "ban" | "view" | "enroll",
    user: any,
  ) => {
    target.value = user;
    if (type === "enroll") {
      fetchUserRegistrations(user.id);
      fetchAllActivities();
    }
    if (type === "view" || type === "edit") {
      editTanita.value = {};
      viewTanita.value = {};
      fetch(`/api/tanita/user/${user.id}`, {
        headers: { "x-user-id": String(authStore.user?.id) },
      })
        .then((r) => (r.ok ? r.json() : []))
        .then((d) => {
          if (d && d.length > 0) {
            if (type === "edit") editTanita.value = { ...d[0] };
            if (type === "view") viewTanita.value = { ...d[0] };
          } else if (type === "edit") {
            editTanita.value = {
              weight: user.weight || "",
              height: user.height || "",
            };
          }
        });
    }
    if (type === "edit") {
      editForm.value = {
        fname_th: user.fname_th || "",
        lname_th: user.lname_th || "",
        nickname: user.nickname || "",
        email: user.email || "",
        phone: user.phone || "",
        gender: user.gender || "",
        role: user.role || "user",
        role_type: user.role_type || "",
        role_detail_1: user.role_detail_1 || "",
        role_detail_2: user.role_detail_2 || "",
        address: user.address || "",
        weight: user.weight || "",
        height: user.height || "",
        birth_date: user.birth_date || "",
        main_goal: user.main_goal || "",
        underlying_disease: user.underlying_disease || "",
        id_code: user.id_code || "",
      };
    } else if (type === "ban") {
      banReason.value = "";
      banType.value = "ban";
    }
  };

  const openModal = async (
    type: "edit" | "ban" | "view" | "enroll",
    user: any,
  ) => {
    target.value = user;
    modal.value = type;
    activeMenuId.value = null;

    // Sync to URL
    router.push({ query: { ...route.query, sub: type, id: user.id } });
    setupModalData(type, user);
  };

  const closeModal = () => {
    if (route.query.sub) {
      router.back();
    } else {
      modal.value = null;
      target.value = null;
      submitting.value = false;
    }
  };

  // ── API actions ──────────────────────────────────────────
  const saveEdit = async () => {
    if (!target.value) return;
    submitting.value = true;
    try {
      if (editTanita.value.weight)
        editForm.value.weight = editTanita.value.weight;
      if (editTanita.value.height)
        editForm.value.height = editTanita.value.height;

      const r = await fetch(`/api/users/${target.value.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": String(authStore.user?.id || ""),
        },
        body: JSON.stringify(editForm.value),
      });
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        throw new Error(
          e.error || `ไม่สามารถบันทึกข้อมูลได้ (Status: ${r.status})`,
        );
      }

      if (
        Object.keys(editTanita.value).length > 0 &&
        (editTanita.value.weight ||
          editTanita.value.fat_pc ||
          editTanita.value.id)
      ) {
        if (editTanita.value.id) {
          await fetch(`/api/tanita/${editTanita.value.id}`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              "x-user-id": String(authStore.user?.id),
            },
            body: JSON.stringify(editTanita.value),
          });
        } else {
          const payload = { ...editTanita.value, user_id: target.value.id };
          await fetch(`/api/tanita`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-user-id": String(authStore.user?.id),
            },
            body: JSON.stringify(payload),
          });
        }
      }

      await mutate();
      closeModal();
      showSuccess("บันทึกข้อมูลสำเร็จ");
    } catch (e: any) {
      showError(e.message);
    } finally {
      submitting.value = false;
    }
  };

  const confirmBan = async () => {
    if (!target.value) return;
    submitting.value = true;
    try {
      const r = await fetch(`/api/users/${target.value.id}/ban`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": String(authStore.user?.id || ""),
        },
        body: JSON.stringify({
          is_suspended: banType.value === "ban" ? 2 : 1,
          ban_reason: banReason.value,
        }),
      });
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        throw new Error(e.error || `ดำเนินการไม่สำเร็จ (Status: ${r.status})`);
      }

      await mutate();
      closeModal();
      showSuccess(
        banType.value === "ban" ? "แบนผู้ใช้สำเร็จ" : "ระงับผู้ใช้สำเร็จ",
      );
    } catch (e: any) {
      showError(e.message);
    } finally {
      submitting.value = false;
    }
  };

  const unban = async (u: any) => {
    const ok = await showConfirm(`เลิกแบน ${displayName(u)} ใช่หรือไม่?`);
    if (!ok) return;
    submitting.value = true;
    try {
      const r = await fetch(`/api/users/${u.id}/unban`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": String(authStore.user?.id || ""),
        },
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.error || "เลิกแบนไม่สำเร็จ");
      }
      await mutate();
      showSuccess("เลิกแบนสำเร็จ");
      activeMenuId.value = null;
    } catch (e: any) {
      showError(e.message);
    } finally {
      submitting.value = false;
    }
  };

  const kick = async (u: any) => {
    const ok = await showConfirm(
      `เตะ ${displayName(u)} ออกจากระบบทั้งหมด ใช่หรือไม่?`,
      undefined,
      "ยืนยันเตะ",
      "warning",
      true,
    );
    if (!ok) return;
    submitting.value = true;
    try {
      const r = await fetch(`/api/users/${u.id}/force-logout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": authStore.user?.id,
        },
      });
      if (!r.ok) throw new Error("ไม่สำเร็จ");
      await mutate();
      showSuccess("เตะผู้ใช้ออกจากระบบสำเร็จ");
      activeMenuId.value = null;
    } catch (e: any) {
      showError(e.message);
    } finally {
      submitting.value = false;
    }
  };

  const deleteUser = async (u: any) => {
    if (u.id === authStore.user?.id) return showError("ไม่สามารถลบตัวเองได้");
    const ok = await showConfirm(
      `ลบบัญชี "${displayName(u)}" ใช่หรือไม่? ไม่สามารถกู้คืนได้`,
      undefined,
      "ยืนยันลบ",
      "warning",
      true,
    );
    if (!ok) return;
    submitting.value = true;
    try {
      const r = await fetch(`/api/users/${u.id}`, {
        method: "DELETE",
        headers: { "x-user-id": authStore.user?.id },
      });
      if (!r.ok) throw new Error("ลบไม่สำเร็จ");
      await mutate();
      showSuccess("ลบบัญชีสำเร็จ");
      activeMenuId.value = null;
    } catch (e: any) {
      showError(e.message);
    } finally {
      submitting.value = false;
    }
  };

  // --- Enrollment Actions ---
  const fetchAllActivities = async () => {
    try {
      const r = await fetch("/api/activities?manage=true", {
        headers: { "x-user-id": String(authStore.user?.id) },
      });
      if (r.ok) allActivities.value = await r.json();
    } catch {
      // intentionally silent (no console output in browser)
    }
  };

  const fetchUserRegistrations = async (userId: number) => {
    loadingRegistrations.value = true;
    try {
      const r = await fetch(`/api/activities/user/${userId}/registered`, {
        headers: { "x-user-id": String(authStore.user?.id) },
      });
      if (r.ok) userRegistrations.value = await r.json();
    } catch {
      // intentionally silent (no console output in browser)
    } finally {
      loadingRegistrations.value = false;
    }
  };

  const adminEnroll = async (eventId: number) => {
    if (!target.value) return;
    submitting.value = true;
    try {
      const r = await fetch("/api/activities/admin/enroll", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": String(authStore.user?.id),
        },
        body: JSON.stringify({ userId: target.value.id, eventId }),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.error || "ลงทะเบียนไม่สำเร็จ");
      }
      showSuccess("ย้ายผู้ใช้เข้ากิจกรรมสำเร็จ");
      fetchUserRegistrations(target.value.id);
    } catch (e: any) {
      showError(e.message);
    } finally {
      submitting.value = false;
    }
  };

  const adminKick = async (eventId: number, eventTitle: string) => {
    if (!target.value) return;
    const ok = await showConfirm(
      `คัด ${displayName(target.value)} ออกจากกิจกรรม "${eventTitle}" ใช่หรือไม่?`,
      undefined,
      "ยืนยันคัดออก",
      "warning",
      true,
    );
    if (!ok) return;

    submitting.value = true;
    try {
      const r = await fetch("/api/activities/admin/kick", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": String(authStore.user?.id),
        },
        body: JSON.stringify({ userId: target.value.id, eventId }),
      });
      if (!r.ok) throw new Error("คัดออกไม่สำเร็จ");
      showSuccess("คัดผู้ใช้ออกสำเร็จ");
      fetchUserRegistrations(target.value.id);
    } catch (e: any) {
      showError(e.message);
    } finally {
      submitting.value = false;
    }
  };

  const bulkEnroll = async (eventIds: number[]) => {
    if (!selectedIds.value.length || !eventIds.length) return;
    submitting.value = true;
    try {
      let totalRequests = selectedIds.value.length * eventIds.length;
      let count = 0;

      for (const userId of selectedIds.value) {
        for (const eventId of eventIds) {
          await fetch("/api/activities/admin/enroll", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-user-id": String(authStore.user?.id),
            },
            body: JSON.stringify({ userId, eventId }),
          });
          count++;
        }
      }
      showSuccess(
        `ดำเนินการสำเร็จ: ย้ายผู้ใช้ ${selectedIds.value.length} คน เข้า ${eventIds.length} กิจกรรม เรียบร้อยแล้ว`,
      );
      selectedIds.value = [];
    } catch (e: any) {
      showError("การดำเนินการบางส่วนอาจไม่สำเร็จ กรุณาตรวจสอบอีกครั้ง");
    } finally {
      submitting.value = false;
    }
  };

  // ── Bulk actions ─────────────────────────────────────────
  const bulkBan = async () => {
    if (!selectedIds.value.length) return;
    const ok = await showConfirm(
      `แบน ${selectedIds.value.length} บัญชีที่เลือก ใช่หรือไม่?`,
      undefined,
      "ยืนยันแบน",
      "warning",
      true,
    );
    if (!ok) return;
    submitting.value = true;
    try {
      await Promise.all(
        selectedIds.value.map((id) =>
          fetch(`/api/users/${id}/ban`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              "x-user-id": authStore.user?.id,
            },
            body: JSON.stringify({ is_suspended: 2, ban_reason: "Bulk ban" }),
          }),
        ),
      );
      await mutate();
      selectedIds.value = [];
      showSuccess("แบนสำเร็จ");
    } catch (e) {
      showError("เกิดข้อผิดพลาดในการแบนบางรายการ");
    } finally {
      submitting.value = false;
    }
  };

  const bulkDelete = async () => {
    if (!selectedIds.value.length) return;
    const ok = await showConfirm(
      `ลบ ${selectedIds.value.length} บัญชีที่เลือก ใช่หรือไม่?`,
      undefined,
      "ยืนยันลบ",
      "warning",
      true,
    );
    if (!ok) return;
    submitting.value = true;
    try {
      await Promise.all(
        selectedIds.value
          .filter((id) => id !== authStore.user?.id)
          .map((id) =>
            fetch(`/api/users/${id}`, {
              method: "DELETE",
              headers: { "x-user-id": authStore.user?.id },
            }),
          ),
      );
      await mutate();
      selectedIds.value = [];
      showSuccess("ลบสำเร็จ");
    } catch (e) {
      showError("เกิดข้อผิดพลาดในการลบบางรายการ");
    } finally {
      submitting.value = false;
    }
  };

  // ── Columns for SmartTable ──────────────────
  const tableColumns: SmartTableColumn[] = [
    {
      key: "user_info",
      label: "ชื่อ-นามสกุล",
      sortable: true,
      sortKey: "fname_th",
      fixed: true,
      minWidth: 180,
      exportRender: (u) => displayName(u),
    },
    {
      key: "contact",
      label: "ติดต่อ",
      sortable: true,
      sortKey: "email",
      minWidth: 140,
      exportRender: (u) =>
        [u.email, u.phone, u.id_code].filter(Boolean).join(" | "),
    },
    {
      key: "role",
      label: "สิทธิ์",
      minWidth: 80,
      align: "center",
      exportRender: (u) => u.role,
    },
    {
      key: "is_suspended",
      label: "สถานะ",
      minWidth: 80,
      align: "center",
      exportRender: (u) => statusLabel(u),
    },
    {
      key: "created_at",
      label: "วันสมัคร",
      minWidth: 90,
      exportRender: (u) => fmtDate(u.created_at),
    },
  ];

  // ── Export ────────────────────────────────────────────────
  const exportCSV = async () => {
    const selected =
      selectedIds.value.length > 0
        ? filtered.value.filter((u: any) => selectedIds.value.includes(u.id))
        : filtered.value;

    // Canonical per-activity scores (total + per-activity), keyed by user id.
    let activities: { event_id: number; title: string }[] = [];
    const scoreByUser: Record<
      number,
      { total: number; scores: Record<number, number> }
    > = {};
    try {
      const r = await fetch("/api/stats/scores/export", {
        headers: { "x-user-id": String(authStore.user?.id) },
      });
      if (r.ok) {
        const d = await r.json();
        activities = d.activities || [];
        for (const u of d.users || []) scoreByUser[u.user_id] = u;
      }
    } catch {
      /* fall back to no score columns */
    }

    const header = [
      "ID",
      "ชื่อ",
      "อีเมล",
      "โทรศัพท์",
      "สิทธิ์",
      "สถานะ",
      "วันสมัคร",
      "คะแนนรวม (กิจกรรม)",
      ...activities.map((a) => a.title),
    ];
    const rows = selected.map((u) => {
      const s = scoreByUser[u.id];
      return [
        u.id,
        displayName(u),
        u.email || "",
        u.phone || "",
        u.role,
        statusLabel(u),
        fmtDate(u.created_at),
        s ? s.total : 0,
        ...activities.map((a) => (s ? s.scores[a.event_id] || 0 : 0)),
      ];
    });
    const esc = (v: any) => {
      const str = String(v ?? "");
      return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
    };
    const csv = [header, ...rows].map((r) => r.map(esc).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `users_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showSuccess(`Export ${selected.length} รายการสำเร็จ`);
  };

  // ── Close menu on outside click ──────────────────────────
  const menuRef = ref<HTMLElement | null>(null);
  const handleClickOutside = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (!target.closest(".uw-menu-wrapper")) {
      activeMenuId.value = null;
    }
  };

  onMounted(() => {
    document.addEventListener("click", handleClickOutside);
    window.addEventListener("scroll", handleClickOutside, true);
    fetchAllActivities(); // ดึงข้อมูลกิจกรรมมาเตรียมไว้สำหรับ Bulk Action
  });

  onUnmounted(() => {
    document.removeEventListener("click", handleClickOutside);
    window.removeEventListener("scroll", handleClickOutside, true);
  });

  // คืนค่าทั้งหมดที่ Template จำเป็นต้องใช้
  return {
    roleTypes,
    schoolLevels,
    uniFaculties,
    uniYears,
    mainGoals,
    users,
    loadingUsers,
    mutate,
    statusFilter,
    roleFilter,
    selectedIds,
    activeMenuId,
    menuPos,
    toggleMenu,
    activeMenuUser,
    filtered,
    counts,
    fmtDate,
    avatar,
    getInitialsAvatar,
    roleBadge,
    statusBadge,
    statusLabel,
    roleLabel, // Added this
    displayName,
    modal,
    target,
    editForm,
    editTanita,
    viewTanita,
    banReason,
    banType,
    submitting,
    openModal,
    closeModal,
    saveEdit,
    confirmBan,
    unban,
    kick,
    deleteUser,
    bulkBan,
    bulkDelete,
    tableColumns,
    exportCSV,
    menuRef,
    allActivities,
    userRegistrations,
    fetchUserRegistrations,
    loadingRegistrations,
    adminEnroll,
    adminKick,
    bulkEnroll,
    showConfirm,
    showSuccess,
    showError,
    formatPhone,
  };
}
