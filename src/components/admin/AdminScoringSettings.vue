<script setup lang="ts">
import { onMounted } from "vue";
import {
  Save,
  Plus,
  Trash2,
  Activity,
  ClipboardCheck,
  Scale,
  Loader2,
} from "lucide-vue-next";
import { uiStore } from "../../store/ui";
import {
  useAdminScoringSettings,
  BODYCOMP_METRICS,
} from "../../composables/useAdminScoringSettings";

const {
  loading,
  saving,
  error,
  daily,
  assessment,
  bodyComp,
  load,
  save,
  addStreakTier,
  removeStreakTier,
  addBand,
  removeBand,
} = useAdminScoringSettings();

onMounted(load);

const onSave = async () => {
  const ok = await save();
  if (ok)
    uiStore.toast("success", "บันทึกแล้ว", "อัปเดตกฎการให้คะแนนเรียบร้อย");
  else uiStore.toast("error", "ผิดพลาด", error.value || "บันทึกไม่สำเร็จ");
};
</script>

<template>
  <div class="scoring-wrap">
    <header class="scoring-head">
      <div>
        <h2 class="scoring-title">ตั้งค่าการให้คะแนน</h2>
        <p class="scoring-sub">
          กำหนดแต้มที่ผู้ใช้จะได้รับ ค่าทั้งหมดปรับได้จากที่นี่ ไม่มีการ
          hardcode
        </p>
      </div>
      <button class="btn-save" :disabled="saving || loading" @click="onSave">
        <Loader2 v-if="saving" :size="16" class="spin" />
        <Save v-else :size="16" />
        บันทึก
      </button>
    </header>

    <div v-if="loading" class="loading-row">
      <Loader2 :size="22" class="spin" /> กำลังโหลด...
    </div>

    <div v-else class="scoring-grid">
      <!-- Daily mission -->
      <section class="score-card">
        <div class="card-head">
          <Activity :size="18" />
          <h3>ภารกิจรายวัน</h3>
        </div>
        <label class="field">
          <span>แต้มพื้นฐานต่อวัน</span>
          <input type="number" min="0" v-model.number="daily.basePoints" />
        </label>
        <div class="sub-label">
          โบนัสต่อเนื่อง (Streak) — ให้โบนัสสูงสุดที่ผ่านเกณฑ์
        </div>
        <div class="tier-row" v-for="(t, i) in daily.streakTiers" :key="i">
          <label class="field tiny">
            <span>ครบกี่วัน</span>
            <input type="number" min="0" v-model.number="t.minStreak" />
          </label>
          <label class="field tiny">
            <span>โบนัส (แต้ม)</span>
            <input type="number" min="0" v-model.number="t.bonus" />
          </label>
          <button class="icon-del" @click="removeStreakTier(i)" title="ลบ">
            <Trash2 :size="15" />
          </button>
        </div>
        <button class="btn-add" @click="addStreakTier">
          <Plus :size="14" /> เพิ่มระดับ
        </button>
      </section>

      <!-- Assessment 3อ2ส -->
      <section class="score-card">
        <div class="card-head">
          <ClipboardCheck :size="18" />
          <h3>แบบประเมิน 3อ2ส</h3>
        </div>
        <div class="sub-label">ช่วงคะแนน → แต้มที่ได้</div>
        <div class="tier-row" v-for="(b, i) in assessment.bands" :key="i">
          <label class="field tiny">
            <span>คะแนนต่ำสุด</span>
            <input type="number" min="0" v-model.number="b.minScore" />
          </label>
          <label class="field tiny">
            <span>คะแนนสูงสุด</span>
            <input type="number" min="0" v-model.number="b.maxScore" />
          </label>
          <label class="field tiny">
            <span>แต้ม</span>
            <input type="number" min="0" v-model.number="b.points" />
          </label>
          <button class="icon-del" @click="removeBand(i)" title="ลบ">
            <Trash2 :size="15" />
          </button>
        </div>
        <button class="btn-add" @click="addBand">
          <Plus :size="14" /> เพิ่มช่วงคะแนน
        </button>
        <label class="field">
          <span>โบนัสเมื่อทำ Post-test ได้ดีขึ้น</span>
          <input
            type="number"
            min="0"
            v-model.number="assessment.improvementBonus"
          />
        </label>
      </section>

      <!-- Body composition -->
      <section class="score-card">
        <div class="card-head">
          <Scale :size="18" />
          <h3>พัฒนาการองค์ประกอบร่างกาย</h3>
        </div>
        <div class="sub-label">
          แต้มต่อ 1 หน่วยที่ดีขึ้น (จำกัดเพดานต่อรายการ)
        </div>
        <div class="metric-row" v-for="m in BODYCOMP_METRICS" :key="m.key">
          <div class="metric-name">
            {{ m.label }}
            <span class="metric-dir">
              {{ m.direction === "decrease" ? "ลดลง" : "เพิ่มขึ้น" }}
            </span>
          </div>
          <label class="field tiny">
            <span>แต้ม/หน่วย</span>
            <input
              v-if="m.direction === 'decrease'"
              type="number"
              min="0"
              v-model.number="bodyComp[m.key].pointsPerUnitDecrease"
            />
            <input
              v-else
              type="number"
              min="0"
              v-model.number="bodyComp[m.key].pointsPerUnitIncrease"
            />
          </label>
          <label class="field tiny">
            <span>เพดานแต้ม</span>
            <input
              type="number"
              min="0"
              v-model.number="bodyComp[m.key].maxPoints"
            />
          </label>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.scoring-wrap {
  padding: 16px;
  max-width: 1100px;
  margin: 0 auto;
}
.scoring-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}
.scoring-title {
  font-size: 1.4rem;
  font-weight: 800;
  color: var(--color-text-main);
  margin: 0;
}
.scoring-sub {
  color: var(--vp-muted);
  font-size: 0.85rem;
  margin: 4px 0 0;
}
.btn-save {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 18px;
  border: none;
  border-radius: 12px;
  background: var(--color-primary);
  color: #fff;
  font-weight: 700;
  cursor: pointer;
  transition: background-color 0.2s ease;
}
.btn-save:hover:not(:disabled) {
  background: var(--color-primary-dark);
}
.btn-save:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.loading-row {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--vp-muted);
  padding: 40px 0;
  justify-content: center;
}
.scoring-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 16px;
}
.score-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 16px;
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.card-head {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--color-primary-dark);
}
.card-head h3 {
  font-size: 1rem;
  font-weight: 700;
  margin: 0;
  color: var(--color-text-main);
}
.sub-label {
  font-size: 0.78rem;
  color: var(--vp-muted);
  font-weight: 600;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 0.8rem;
  color: var(--vp-text);
}
.field span {
  font-weight: 600;
  color: var(--vp-muted);
}
.field input {
  border: 1.5px solid var(--color-border);
  border-radius: 8px;
  padding: 8px 10px;
  font: inherit;
  width: 100%;
}
.field input:focus {
  outline: none;
  border-color: var(--color-primary);
}
.field.tiny {
  flex: 1;
  min-width: 0;
}
.tier-row,
.metric-row {
  display: flex;
  align-items: flex-end;
  gap: 8px;
}
.metric-row {
  align-items: center;
}
.metric-name {
  flex: 1.2;
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--vp-text);
  display: flex;
  flex-direction: column;
}
.metric-dir {
  font-size: 0.68rem;
  color: var(--color-primary-dark);
  font-weight: 700;
}
.icon-del {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: transparent;
  color: #ef4444;
  cursor: pointer;
  flex-shrink: 0;
}
.icon-del:hover {
  background: #fef2f2;
  border-color: #fecaca;
}
.btn-add {
  align-self: flex-start;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 7px 12px;
  border: 1.5px dashed var(--color-border);
  border-radius: 10px;
  background: transparent;
  color: var(--vp-muted);
  font-weight: 600;
  font-size: 0.8rem;
  cursor: pointer;
}
.btn-add:hover {
  border-color: var(--color-primary);
  color: var(--color-primary-dark);
}
.spin {
  animation: spin 1s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
