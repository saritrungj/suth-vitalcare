import { ref, computed } from "vue";
import { authStore } from "../store/auth";
import { showSuccess, showError, showConfirm } from "../lib/swal";

const API = import.meta.env.VITE_API_URL || "/api";

function headers(json = true): Record<string, string> {
  const h: Record<string, string> = {
    "x-user-id": String(authStore.user?.id || ""),
  };
  if (json) h["Content-Type"] = "application/json";
  return h;
}

export function useAdminUserDetail(userId: number) {
  const loading = ref(true);
  const submitting = ref(false);
  const user = ref<any>(null);
  const submissions = ref<any[]>([]);
  const tanita = ref<any[]>([]);
  const registrations = ref<any[]>([]);
  const assessments = ref<any[]>([]);
  const assessmentSubmissions = ref<any[]>([]);
  const activityScores = ref<any[]>([]);
  const scoreTotal = ref(0);

  const displayName = computed(() =>
    user.value
      ? `${user.value.fname_th || ""} ${user.value.lname_th || ""}`.trim() ||
        user.value.nickname ||
        `#${user.value.id}`
      : "",
  );

  const load = async () => {
    loading.value = true;
    try {
      const r = await fetch(`${API}/users/${userId}/full-profile`, {
        headers: headers(false),
      });
      if (!r.ok) throw new Error("โหลดข้อมูลผู้ใช้ไม่สำเร็จ");
      const d = await r.json();
      user.value = d.user;
      submissions.value = d.submissions || [];
      tanita.value = d.healthHistory || [];
      registrations.value = d.registrations || [];
      assessments.value = d.assessments || [];
      assessmentSubmissions.value = d.assessmentSubmissions || [];
      await loadActivityScores();
    } catch (e: any) {
      showError(e.message || "เกิดข้อผิดพลาด");
    } finally {
      loading.value = false;
    }
  };

  const loadActivityScores = async () => {
    try {
      const r = await fetch(`${API}/stats/user/${userId}/activity-scores`, {
        headers: headers(false),
      });
      if (r.ok) {
        const d = await r.json();
        activityScores.value = d.activities || [];
        scoreTotal.value = d.total || 0;
      }
    } catch {
      /* silent */
    }
  };

  // ── Profile ────────────────────────────────────────────────
  const saveProfile = async (form: any) => {
    submitting.value = true;
    try {
      const r = await fetch(`${API}/users/${userId}`, {
        method: "PATCH",
        headers: headers(),
        body: JSON.stringify(form),
      });
      if (!r.ok)
        throw new Error(
          (await r.json().catch(() => ({}))).error || "บันทึกไม่สำเร็จ",
        );
      showSuccess("บันทึกโปรไฟล์สำเร็จ");
      await load();
    } catch (e: any) {
      showError(e.message);
    } finally {
      submitting.value = false;
    }
  };

  // ── Points ─────────────────────────────────────────────────
  const savePoints = async (points: number, total_score: number) => {
    submitting.value = true;
    try {
      const r = await fetch(`${API}/users/${userId}/points`, {
        method: "PATCH",
        headers: headers(),
        body: JSON.stringify({ points, total_score }),
      });
      if (!r.ok)
        throw new Error(
          (await r.json().catch(() => ({}))).error || "บันทึกคะแนนไม่สำเร็จ",
        );
      showSuccess("ปรับคะแนนสำเร็จ");
      await load();
    } catch (e: any) {
      showError(e.message);
    } finally {
      submitting.value = false;
    }
  };

  const addAdjustment = async (
    eventId: number,
    points: number,
    reason: string,
  ) => {
    if (!points) return;
    submitting.value = true;
    try {
      const r = await fetch(`${API}/activities/${eventId}/bonus-points`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ user_id: userId, points, reason }),
      });
      if (!r.ok)
        throw new Error(
          (await r.json().catch(() => ({}))).error || "ปรับคะแนนไม่สำเร็จ",
        );
      showSuccess("ปรับคะแนนรายกิจกรรมสำเร็จ");
      await loadActivityScores();
      await load();
    } catch (e: any) {
      showError(e.message);
    } finally {
      submitting.value = false;
    }
  };

  // ── Missions ───────────────────────────────────────────────
  const backdateSubmit = async (payload: any) => {
    submitting.value = true;
    try {
      const r = await fetch(`${API}/missions/admin/submit`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ ...payload, userId }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "เพิ่มภารกิจไม่สำเร็จ");
      showSuccess("เพิ่มภารกิจสำเร็จ");
      await load();
    } catch (e: any) {
      showError(e.message);
    } finally {
      submitting.value = false;
    }
  };

  const editSubmission = async (id: number, payload: any) => {
    submitting.value = true;
    try {
      const r = await fetch(`${API}/missions/submission/${id}`, {
        method: "PATCH",
        headers: headers(),
        body: JSON.stringify(payload),
      });
      if (!r.ok) throw new Error("แก้ไขไม่สำเร็จ");
      showSuccess("แก้ไขภารกิจสำเร็จ");
      await load();
    } catch (e: any) {
      showError(e.message);
    } finally {
      submitting.value = false;
    }
  };

  const setSubmissionStatus = async (id: number, status: string, note = "") => {
    submitting.value = true;
    try {
      const r = await fetch(`${API}/missions/${id}/status`, {
        method: "PATCH",
        headers: headers(),
        body: JSON.stringify({ status, note }),
      });
      if (!r.ok) throw new Error("อัปเดตสถานะไม่สำเร็จ");
      showSuccess(status === "approved" ? "อนุมัติแล้ว" : "ปฏิเสธแล้ว");
      await load();
    } catch (e: any) {
      showError(e.message);
    } finally {
      submitting.value = false;
    }
  };

  const deleteSubmission = async (id: number) => {
    const ok = await showConfirm(
      "ลบการส่งภารกิจนี้ใช่หรือไม่?",
      undefined,
      "ยืนยันลบ",
      "warning",
      true,
    );
    if (!ok) return;
    submitting.value = true;
    try {
      const r = await fetch(`${API}/missions/submission/${id}`, {
        method: "DELETE",
        headers: headers(false),
      });
      if (!r.ok) throw new Error("ลบไม่สำเร็จ");
      showSuccess("ลบภารกิจสำเร็จ");
      await load();
    } catch (e: any) {
      showError(e.message);
    } finally {
      submitting.value = false;
    }
  };

  // ── Body composition (tanita) ──────────────────────────────
  const saveTanita = async (record: any) => {
    submitting.value = true;
    try {
      const isEdit = !!record.id;
      const url = isEdit ? `${API}/tanita/${record.id}` : `${API}/tanita`;
      const r = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: headers(),
        body: JSON.stringify({ ...record, user_id: userId }),
      });
      if (!r.ok) throw new Error("บันทึกค่าร่างกายไม่สำเร็จ");
      showSuccess("บันทึกค่าร่างกายสำเร็จ");
      await load();
    } catch (e: any) {
      showError(e.message);
    } finally {
      submitting.value = false;
    }
  };

  const deleteTanita = async (id: number) => {
    const ok = await showConfirm(
      "ลบข้อมูลค่าร่างกายนี้ใช่หรือไม่?",
      undefined,
      "ยืนยันลบ",
      "warning",
      true,
    );
    if (!ok) return;
    submitting.value = true;
    try {
      const r = await fetch(`${API}/tanita/${id}`, {
        method: "DELETE",
        headers: headers(false),
      });
      if (!r.ok) throw new Error("ลบไม่สำเร็จ");
      showSuccess("ลบค่าร่างกายสำเร็จ");
      await load();
    } catch (e: any) {
      showError(e.message);
    } finally {
      submitting.value = false;
    }
  };

  // ── Activities ─────────────────────────────────────────────
  const enroll = async (eventId: number) => {
    submitting.value = true;
    try {
      const r = await fetch(`${API}/activities/admin/enroll`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ userId, eventId }),
      });
      if (!r.ok)
        throw new Error(
          (await r.json().catch(() => ({}))).error || "ลงทะเบียนไม่สำเร็จ",
        );
      showSuccess("เพิ่มเข้ากิจกรรมสำเร็จ");
      await load();
    } catch (e: any) {
      showError(e.message);
    } finally {
      submitting.value = false;
    }
  };

  const kick = async (eventId: number, title: string) => {
    const ok = await showConfirm(
      `คัดออกจาก "${title}" ใช่หรือไม่?`,
      undefined,
      "ยืนยัน",
      "warning",
      true,
    );
    if (!ok) return;
    submitting.value = true;
    try {
      const r = await fetch(`${API}/activities/admin/kick`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ userId, eventId }),
      });
      if (!r.ok) throw new Error("คัดออกไม่สำเร็จ");
      showSuccess("คัดออกสำเร็จ");
      await load();
    } catch (e: any) {
      showError(e.message);
    } finally {
      submitting.value = false;
    }
  };

  return {
    loading,
    submitting,
    user,
    submissions,
    tanita,
    registrations,
    assessments,
    assessmentSubmissions,
    activityScores,
    scoreTotal,
    loadActivityScores,
    addAdjustment,
    displayName,
    load,
    saveProfile,
    savePoints,
    backdateSubmit,
    editSubmission,
    setSubmissionStatus,
    deleteSubmission,
    saveTanita,
    deleteTanita,
    enroll,
    kick,
  };
}
