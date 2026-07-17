import { readFileSync, writeFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filePath = path.resolve(__dirname, "..", "src", "views", "Profile.vue");

let content = readFileSync(filePath, "utf-8");

// ── 1. Add Zap, TrendingUp to lucide-vue-next imports ──
content = content.replace(
  /(Heart, ImageIcon, Droplets, Lock, LayoutGrid, Medal, Check, PanelLeft, PanelLeftClose, ChevronLeft, X, Clock)(\n\} from 'lucide-vue-next')/,
  "$1, Zap, TrendingUp$2",
);

// ── 2. Replace useTanitaInsights block with computed properties ──
const oldInsightBlock = `const {
  insightSweetSpot, insightProtein, insightBodyType, insightVisceral, insightHydration, insightWeightGap
} = useTanitaInsights(tanita, user, { latestWeight, latestHeight, profileBMI, recommendedCalories, accurateAge }, dashboardGoal, dashboardActivity)`;

const newComputedBlock = `const bodyScore = computed(() => {
  if (!tanita.value) return 0
  let score = 100
  const fat = parseFloat(tanita.value.fat_pc)
  const bmi = parseFloat(profileBMI.value)
  const vis = parseFloat(tanita.value.visceral_fat)
  const tbw = parseFloat(tanita.value.tbw_pc)
  if (!isNaN(fat)) {
    if (fat > 30) score -= 15
    else if (fat > 25) score -= 8
    else if (fat < 12) score -= 5
  }
  if (!isNaN(bmi)) {
    if (bmi > 27.5) score -= 10
    else if (bmi > 24.9) score -= 5
    else if (bmi < 18.5) score -= 5
  }
  if (!isNaN(vis)) {
    if (vis > 12) score -= 15
    else if (vis > 9) score -= 8
  }
  if (!isNaN(tbw)) {
    if (tbw < 45) score -= 5
    else if (tbw > 70) score -= 5
  }
  return Math.max(0, Math.min(100, Math.round(score)))
})

const scoreColor = computed(() => {
  const s = bodyScore.value
  if (s >= 80) return '#22c55e'
  if (s >= 60) return '#eab308'
  return '#ef4444'
})

const visceralStatus = computed(() => {
  const v = parseFloat(tanita.value?.visceral_fat)
  if (isNaN(v)) return { label: '\\u2013', class: '' }
  if (v <= 9) return { label: '\\u0e1b\\u0e01\\u0e15\\u0e34', class: 'ft-ok' }
  if (v <= 14) return { label: '\\u0e2a\\u0e39\\u0e07\\u0e40\\u0e25\\u0e47\\u0e01\\u0e19\\u0e49\\u0e2d\\u0e22', class: 'ft-warn' }
  return { label: '\\u0e2a\\u0e39\\u0e07', class: 'ft-danger' }
})

const hydrationStatus = computed(() => {
  const w = parseFloat(tanita.value?.tbw_pc)
  if (isNaN(w)) return { label: '\\u2013', class: '' }
  if (w >= 50 && w <= 65) return { label: '\\u0e1b\\u0e01\\u0e15\\u0e34', class: 'ft-ok' }
  if (w < 50) return { label: '\\u0e15\\u0e48\\u0e33', class: 'ft-warn' }
  return { label: '\\u0e2a\\u0e39\\u0e07', class: 'ft-warn' }
})`;

content = content.replace(oldInsightBlock, newComputedBlock);

// ── 3. Add fitness CSS after empty-state styles (but before modal-related styles) ──
const fitnessCSS = `
/* ── Fitness Tab Design (Apple Health / Fitbit style) ── */
.fitness-tab {
  display: flex;
  flex-direction: column;
  gap: 24px;
  padding: 4px 0;
}

.ft-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.ft-date {
  font-size: 0.8rem;
  color: #94a3b8;
  font-weight: 500;
}

.ft-body {
  display: flex;
  flex-direction: column;
  gap: 28px;
}

/* Score Ring */
.ft-score-section {
  display: flex;
  justify-content: center;
  padding: 12px 0;
}

.ft-score-ring {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.ft-score-ring svg {
  display: block;
}

.ft-score-text {
  position: absolute;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.ft-score-num {
  font-size: 2rem;
  font-weight: 800;
  line-height: 1;
}

.ft-score-label {
  font-size: 0.7rem;
  color: #94a3b8;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

/* 4 Metric Cards Grid */
.ft-metrics-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.ft-card {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  background: #f8fafc;
  border: 1px solid #f1f5f9;
  border-radius: 16px;
  padding: 16px;
  transition: all 0.15s;
}

.ft-card:hover {
  border-color: #e2e8f0;
  background: #fff;
  box-shadow: 0 4px 12px rgba(0,0,0,0.04);
}

.ft-card-icon {
  width: 40px;
  height: 40px;
  min-width: 40px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.ft-fat { background: #fee2e2; color: #ef4444; }
.ft-muscle { background: #dbeafe; color: #3b82f6; }
.ft-visceral { background: #fef3c7; color: #f59e0b; }
.ft-water { background: #e0f2fe; color: #0ea5e9; }

.ft-card-body {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}

.ft-card-label {
  font-size: 0.72rem;
  font-weight: 600;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.ft-card-value {
  font-size: 1.25rem;
  font-weight: 800;
  color: #0f172a;
  line-height: 1.2;
}

.ft-card-value small {
  font-size: 0.7rem;
  font-weight: 600;
  color: #94a3b8;
  margin-left: 2px;
}

.ft-card-status {
  font-size: 0.7rem;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 4px;
  display: inline-block;
  width: fit-content;
  margin-top: 2px;
}

.ft-ok { background: #dcfce7; color: #166534; }
.ft-warn { background: #fef3c7; color: #92400e; }
.ft-danger { background: #fee2e2; color: #991b1b; }

/* BMI + Weight Summary Cards */
.ft-summary-cards {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.ft-summary-item {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.ft-summary-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.ft-summary-label {
  font-size: 0.72rem;
  font-weight: 700;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.ft-summary-sub {
  font-size: 0.7rem;
  color: #94a3b8;
  font-weight: 500;
}

.ft-summary-badge {
  font-size: 0.6rem;
  padding: 2px 8px;
  border-radius: 9999px;
  font-weight: 700;
}

.ft-summary-value {
  font-size: 1.5rem;
  font-weight: 800;
  color: #0f172a;
  line-height: 1.1;
}

.ft-summary-value small {
  font-size: 0.75rem;
  font-weight: 600;
  color: #94a3b8;
}

.ft-summary-bar {
  margin-top: 4px;
}

.ft-bar-track {
  width: 100%;
  height: 6px;
  background: #f1f5f9;
  border-radius: 3px;
  overflow: hidden;
}

.ft-bar-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.6s ease;
}

.ft-bar-labels {
  display: flex;
  justify-content: space-between;
  margin-top: 4px;
  font-size: 0.5rem;
  color: #94a3b8;
  font-weight: 600;
}

/* Selectors */
.ft-selectors {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.ft-select {
  width: 100%;
}

.ft-select :deep(.select-trigger) {
  min-height: 44px;
  padding: 12px 14px 4px;
  border-radius: 12px;
  border-color: #e2e8f0;
}

@media (max-width: 640px) {
  .ft-metrics-grid { gap: 8px; }
  .ft-card { padding: 12px; gap: 8px; }
  .ft-card-icon { width: 34px; height: 34px; min-width: 34px; }
  .ft-card-value { font-size: 1.1rem; }
  .ft-summary-cards { gap: 8px; }
  .ft-summary-item { padding: 12px; }
  .ft-summary-value { font-size: 1.25rem; }
  .ft-selectors { gap: 8px; }
  .ft-score-num { font-size: 1.6rem; }
}

@media (min-width: 768px) {
  .ft-metrics-grid { gap: 16px; }
  .ft-summary-cards { gap: 16px; }
}
`;

// Insert the fitness CSS before ".empty-state {" which is a known stable anchor
// We'll insert it right before the closing of the scoped style tag
// Find the last `</style>` in the scoped style section
// The scoped style closes with `</style>` and then there's a global `<style>` tag
const scopedStyleEnd = "</style>\n<style>\n";
if (content.includes(scopedStyleEnd)) {
  content = content.replace(scopedStyleEnd, fitnessCSS + "\n" + scopedStyleEnd);
}

// Write the file
writeFileSync(filePath, content, "utf-8");
console.log("✅ Profile.vue updated successfully");
console.log("Changes made:");
console.log("  1. Added Zap, TrendingUp to lucide-vue-next imports");
console.log(
  "  2. Replaced useTanitaInsights with bodyScore, scoreColor, visceralStatus, hydrationStatus computed properties",
);
console.log("  3. Added fitness-design CSS styles");
