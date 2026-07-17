# Remove the ฉายา / Titles System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Completely remove the gamification "ฉายา" (titles) feature — UI, API, and database — leaving nothing behind.

**Architecture:** Pure deletion. Remove frontend consumers (Profile, Rankings, Admin) first so the build stays green, then delete the now-orphaned components/composables, then the backend routes/endpoints, then drop the database tables/column. There is no automated test framework in this repo, so each task's verification gate is a repo grep plus `npx vue-tsc --noEmit` and `npx vite build` (frontend) or a targeted grep (backend), and every task ends with a focused commit.

**Tech Stack:** Vue 3 + TypeScript (Vite), Express + mysql2 (run via tsx), MySQL.

**Spec:** `docs/superpowers/specs/2026-06-26-remove-titles-system-design.md`

---

## Preflight (read before Task 1)

- This repo currently has **unrelated uncommitted changes** (an earlier navbar/language refactor). Before starting, either commit/stash those separately or work on a dedicated branch/worktree, so the title-removal commits below stay focused. **Use targeted `git add <paths>` (never `git add -A`)** in every commit step.
- Line numbers below were accurate at planning time. If a file has shifted, locate the quoted anchor text rather than trusting the number.
- "Verify green" in this plan means: `npx vue-tsc --noEmit` exits 0 **and** `npx vite build` exits 0.

---

## File Structure

| File                                       | Action | Responsibility after change                             |
| ------------------------------------------ | ------ | ------------------------------------------------------- |
| `src/views/Profile.vue`                    | Modify | User profile; loses the ฉายา tab entirely               |
| `src/views/Rankings.vue`                   | Modify | Leaderboard; loses the equipped-title badge             |
| `src/views/Admin.vue`                      | Modify | Admin shell; loses the "จัดการฉายา" tab                 |
| `src/store/lang.ts`                        | Modify | i18n dictionary; loses 7 title-only keys                |
| `src/components/UserTitle.vue`             | Delete | (title badge)                                           |
| `src/components/admin/AdminTitle.vue`      | Delete | (admin title CRUD UI)                                   |
| `src/composables/useUserTitles.ts`         | Delete | (user title fetch/claim/equip)                          |
| `src/composables/useAdminTitle.ts`         | Delete | (admin title CRUD calls)                                |
| `server/index.ts`                          | Modify | Loses titles router mount + 3 inline endpoints + import |
| `server/routes/titles.ts`                  | Delete | (admin title CRUD API)                                  |
| `db/migrations/2026-06-26-drop-titles.sql` | Create | Forward migration dropping titles schema                |
| `vitalcare.sql`                            | Modify | Checked-in schema dump matches reality                  |

---

## Task 1: Strip the ฉายา tab from Profile.vue

**Files:**

- Modify: `src/views/Profile.vue`

- [ ] **Step 1: Remove the menu tile** (template). Delete this block (anchor `class="menu-item mi-titles"`, ~L100‑109):

```html
<div
  class="menu-item mi-titles"
  :class="{ active: !isMobileScreen && activeTab === 'titles' }"
  @click="openTab('titles')"
>
  <div class="menu-icon-wrap m-yellow">
    <Award class="menu-icon" />
  </div>
  <div class="menu-label">{{ langStore.t("titles_tab") }}</div>
</div>
```

- [ ] **Step 2: Remove the entire titles tab content block** (template). Delete from the comment `<!-- Titles Tab -->` (~L1305) through the closing `</div>` of `<div v-if="activeTab === 'titles'" class="tab-content titles-tab">` (~L1420). The block starts:

```html
<!-- Titles Tab -->
<div v-if="activeTab === 'titles'" class="tab-content titles-tab"></div>
```

and ends (these are the last lines of the block — the `empty-mini` div then two closing divs that close `titles-container-compact` and the `v-if` tab):

```html
                  <div v-if="filteredTitles.length === 0" class="empty-mini">
                    <Award :size="32" class="opacity-20" />
                    <p>{{ langStore.t("no_titles_found") }}</p>
                  </div>
                </div>
              </div>
```

Delete the comment line and everything between, inclusive. Do **not** delete the following line `</div>` that closes `card-body` (it belongs to the parent).

- [ ] **Step 3: Remove the title script — composable + state.** Delete these lines (~L2002‑2020):

```ts
const { titles, loadingTitles, fetchAllTitles, equipTitle, claimTitle } =
  useUserTitles();
const titleSearchQuery = ref("");
const filteredTitles = computed(() => {
  if (!titleSearchQuery.value) return titles.value;
  const q = titleSearchQuery.value.toLowerCase();
  return titles.value.filter(
    (t) =>
      t.name.toLowerCase().includes(q) ||
      t.description?.toLowerCase().includes(q),
  );
});
const unlockedCount = computed(
  () => titles.value.filter((t) => t.is_unlocked).length,
);
const totalCount = computed(() => titles.value.length);
const unlockProgress = computed(() =>
  totalCount.value ? (unlockedCount.value / totalCount.value) * 100 : 0,
);
```

- [ ] **Step 4: Remove the `handleClaim` function** (~L2036‑2090). Delete the whole function from `const handleClaim = async (title) => {` through its closing `};` (the line immediately before `function toggleFavorite(e, id) {`). Leave `showInfoPopup` (L2022‑2034) intact — it is used by other tabs.

- [ ] **Step 5: Remove the tab-loader branch.** Find (~L2350):

```ts
  else if (tabName === "titles") fetchAllTitles();
```

Delete this line. Check the line above it — if it ends a chain such that removing this leaves a dangling `else`/`if`, re-read the surrounding `openTab`/loader function and keep it syntactically valid (it is a standalone `else if`, so plain deletion is correct).

- [ ] **Step 6: Remove now-unused imports.** Delete these three import lines:
  - `import { useUserTitles } from "../composables/useUserTitles";` (~L1983)
  - `import UserTitle from "../components/UserTitle.vue";` (~L1985)
  - The `Lock,` and `Check,` entries in the `lucide-vue-next` import (~L1953, L1956). **Keep `Award`** — it is still used elsewhere in this file.

- [ ] **Step 7: Remove the title scoped CSS.** Delete the contiguous block from the comment `/* Titles Tab */` (~L3827) through the end of the `.lock-icon-only { … }` rule (~L4026). First line `/* Titles Tab */`, last rule:

```css
.lock-icon-only {
  width: 100%;
  display: flex;
  justify-content: center;
  color: #cbd5e1;
  padding: 4px;
}
```

Do **not** delete the following `/* Empty States */` `.empty-mini` block — it is shared.

- [ ] **Step 8: Remove the `.mi-titles` rules inside the media query** (~L4335‑4340):

```css
.menu-item.mi-titles.active .menu-label {
  color: #eab308;
}
.menu-item.mi-titles.active .menu-icon-wrap {
  border-color: #eab308;
}
```

- [ ] **Step 9: Verify green.**

Run: `npx vue-tsc --noEmit`
Expected: exit 0 (no errors about `useUserTitles`, `UserTitle`, `Lock`, `Check`, `titles`, `filteredTitles`, etc.)

Run: `npx vite build`
Expected: exit 0.

- [ ] **Step 10: Verify no title references remain in Profile.vue.**

Run: `grep -nE "titles|UserTitle|equipTitle|claimTitle|filteredTitles|mi-titles|Lock\b" src/views/Profile.vue`
Expected: no matches (an `isLocked` prop on a non-title component, if any, is fine — but there should be none here).

- [ ] **Step 11: Commit.**

```bash
git add src/views/Profile.vue
git commit -m "refactor: remove ฉายา/titles tab from Profile"
```

---

## Task 2: Remove the equipped-title badge from Rankings.vue

**Files:**

- Modify: `src/views/Rankings.vue`

- [ ] **Step 1: Remove the badge block** (template, ~L222‑227):

```html
<UserTitle
  v-if="item.equipped_title_name"
  :name="item.equipped_title_name"
  :rarity="item.equipped_title_rarity"
  :color="item.equipped_title_color"
/>
```

(If the `UserTitle` element spans slightly different attributes/lines, delete the entire `<UserTitle … />` element and its `v-if="item.equipped_title_name"` wrapper.)

- [ ] **Step 2: Remove the import** (~L284):

```ts
import UserTitle from "../components/UserTitle.vue";
```

- [ ] **Step 3: Verify green.**

Run: `npx vue-tsc --noEmit`
Expected: exit 0.

Run: `npx vite build`
Expected: exit 0.

- [ ] **Step 4: Verify clean.**

Run: `grep -nE "UserTitle|equipped_title" src/views/Rankings.vue`
Expected: no matches.

- [ ] **Step 5: Commit.**

```bash
git add src/views/Rankings.vue
git commit -m "refactor: remove equipped-title badge from Rankings"
```

---

## Task 3: Remove the "จัดการฉายา" tab from Admin.vue

**Files:**

- Modify: `src/views/Admin.vue`

- [ ] **Step 1: Remove the nav entry** (~L79‑83):

```ts
      {
        id: "titles",
        label: langStore.locale === "th" ? "จัดการฉายา" : "Manage Titles",
        icon: Medal,
      },
```

- [ ] **Step 2: Remove the tab render** (~L341):

```html
<AdminTitle v-else-if="activeTab === 'titles'" />
```

- [ ] **Step 3: Remove the component import** (~L31):

```ts
import AdminTitle from "../components/admin/AdminTitle.vue";
```

- [ ] **Step 4: Remove the now-unused `Medal` icon import** (~L19). In the `lucide-vue-next` import, delete the `Medal,` entry. (`Medal` was only used by the titles nav icon.)

- [ ] **Step 5: Verify green.**

Run: `npx vue-tsc --noEmit`
Expected: exit 0.

Run: `npx vite build`
Expected: exit 0.

- [ ] **Step 6: Verify clean.**

Run: `grep -nE "AdminTitle|'titles'|Medal" src/views/Admin.vue`
Expected: no matches.

- [ ] **Step 7: Commit.**

```bash
git add src/views/Admin.vue
git commit -m "refactor: remove ฉายา admin tab from Admin shell"
```

---

## Task 4: Remove title-only i18n keys

**Files:**

- Modify: `src/store/lang.ts`

All seven keys are used only by the title UI removed in Tasks 1‑3.

- [ ] **Step 1: Remove the Thai (`th`) keys.** Delete these lines:
  - `titles_tab: "ฉายา",` (~L111)
  - `titles_unlocked: "ปลดล็อกฉายาแล้ว",` (~L183)
  - `equip: "ใช้งาน",` (~L184)
  - `equipped: "ใช้อยู่",` (~L185)
  - `unlock: "ปลดล็อก",` (~L186)
  - `no_titles_found: "ไม่พบฉายาที่คุณค้นหา",` (~L187)
  - `code: "รหัส",` (~L195)

- [ ] **Step 2: Remove the English (`en`) keys.** Delete these lines:
  - `titles_tab: "Titles",` (~L473)
  - `titles_unlocked: "Titles Unlocked",` (~L545)
  - `equip: "Equip",` (~L546)
  - `equipped: "Equipped",` (~L547)
  - `unlock: "Unlock",` (~L548)
  - `no_titles_found: "No titles found",` (~L549)
  - `code: "Code",` (~L557)

- [ ] **Step 3: Verify no remaining usage of these keys.**

Run: `grep -rnE "t\(\s*[\"'](titles_tab|titles_unlocked|equip|equipped|unlock|code|no_titles_found)[\"']" src`
Expected: no matches.

- [ ] **Step 4: Verify green.**

Run: `npx vue-tsc --noEmit`
Expected: exit 0 (the `MessageKey` type narrows; any stray usage would error here).

Run: `npx vite build`
Expected: exit 0.

- [ ] **Step 5: Commit.**

```bash
git add src/store/lang.ts
git commit -m "chore: drop title-only i18n keys"
```

---

## Task 5: Delete the orphaned frontend files

By now nothing imports these (Profile/Rankings/Admin were updated in Tasks 1‑3).

**Files:**

- Delete: `src/components/admin/AdminTitle.vue`
- Delete: `src/composables/useAdminTitle.ts`
- Delete: `src/components/UserTitle.vue`
- Delete: `src/composables/useUserTitles.ts`

- [ ] **Step 1: Confirm no importers remain.**

Run: `grep -rnE "UserTitle|useUserTitles|useAdminTitle|AdminTitle" src`
Expected: no matches.

- [ ] **Step 2: Delete the files.**

```bash
git rm src/components/admin/AdminTitle.vue src/composables/useAdminTitle.ts src/components/UserTitle.vue src/composables/useUserTitles.ts
```

- [ ] **Step 3: Verify green.**

Run: `npx vue-tsc --noEmit`
Expected: exit 0.

Run: `npx vite build`
Expected: exit 0.

- [ ] **Step 4: Commit.**

```bash
git commit -m "chore: delete orphaned title components/composables"
```

---

## Task 6: Remove the backend titles API

**Files:**

- Modify: `server/index.ts`
- Delete: `server/routes/titles.ts`

- [ ] **Step 1: Remove the router import** in `server/index.ts` (~L40):

```ts
import titlesRouter from "./routes/titles.js";
```

- [ ] **Step 2: Remove the router mount** (~L307):

```ts
app.use("/api/admin/titles", titlesRouter);
```

- [ ] **Step 3: Remove the three inline endpoints.** Delete the contiguous block from the comment `// ─── User-Facing Titles API` (~L309) through the closing `});` of the `app.patch("/api/user/:userId/equip-title", …)` handler (~L448). The block begins:

```ts
  // ─── User-Facing Titles API ──────────────────────────────────────────────
  // GET /api/titles — all active titles, with is_unlocked flag for the requesting user
  app.get("/api/titles", async (req, res) => {
```

and ends:

```ts
      res.json({ success: true, equipped_title_id: title_id });
    } catch (err: any) {
      res.status(500).json({ error: "Internal Server Error" });
    }
  });
```

Delete the comment header and everything through that final `});`, inclusive. Stop before the next comment `// ── Local File Upload Endpoint`. This also removes the only emitter of the `TITLE_CLAIMED_BROADCAST` socket event (there is no client listener for it, confirmed by grep).

- [ ] **Step 4: Delete the admin titles route file.**

```bash
git rm server/routes/titles.ts
```

- [ ] **Step 5: Verify no backend title references remain.**

Run: `grep -rnE "titlesRouter|gamification_titles|user_titles|equipped_title|equip-title|TITLE_CLAIMED_BROADCAST|/api/titles" server`
Expected: no matches.

- [ ] **Step 6: Type-check the server entry.** The repo runs the server via `tsx` (no separate server typecheck script), so do a parse/type sanity check:

Run: `npx tsc --noEmit --allowJs false --moduleResolution bundler --module esnext --target esnext server/index.ts 2>&1 | grep -i "titles" || echo "no title errors"`
Expected: `no title errors` (ignore unrelated module-resolution noise from isolated compilation; the only thing that matters is that no error references titles). If `tsx` is preferred, alternatively run `node -e "require('child_process')"`-style is unnecessary — the grep in Step 5 plus the running server in Step 7 of Task 8 is the real gate.

- [ ] **Step 7: Commit.**

```bash
git add server/index.ts
git commit -m "refactor: remove titles API (routes + inline endpoints)"
```

---

## Task 7: Drop the database schema

**Files:**

- Create: `db/migrations/2026-06-26-drop-titles.sql`
- Modify: `vitalcare.sql`

- [ ] **Step 1: Create the forward migration.** Create `db/migrations/2026-06-26-drop-titles.sql` with exactly:

```sql
-- Remove the ฉายา/titles gamification feature (2026-06-26)
DROP TABLE IF EXISTS `user_titles`;
DROP TABLE IF EXISTS `gamification_titles`;
ALTER TABLE `users` DROP COLUMN `equipped_title_id`;
```

(If a `db/migrations/` directory does not exist, create it. If the project keeps migrations elsewhere, place the file beside existing migrations and match their naming — check the repo for a migrations folder first with `ls db 2>/dev/null; grep -rl "ALTER TABLE" --include="*.sql" .`)

- [ ] **Step 2: Update the checked-in schema dump.** In `vitalcare.sql`:
  - Remove the `gamification_titles` and `user_titles` table definitions if present (the current committed dump is partial and may not contain them — if `grep -n "gamification_titles\|user_titles" vitalcare.sql` returns nothing, skip).
  - Remove the `equipped_title_id` column line from the `users` table definition if present (`grep -n "equipped_title_id" vitalcare.sql`).

- [ ] **Step 3: Verify.**

Run: `grep -rnE "gamification_titles|user_titles|equipped_title_id" vitalcare.sql db`
Expected: matches only inside `db/migrations/2026-06-26-drop-titles.sql` (the DROP statements), nothing in `vitalcare.sql`.

- [ ] **Step 4: Commit.**

```bash
git add db/migrations/2026-06-26-drop-titles.sql vitalcare.sql
git commit -m "chore(db): drop titles tables and users.equipped_title_id"
```

---

## Task 8: Final verification sweep

**Files:** none (verification only)

- [ ] **Step 1: Full repo grep for residual references.**

Run:

```bash
grep -rnE "UserTitle|useUserTitles|useAdminTitle|AdminTitle|gamification_titles|user_titles|equipped_title|equip-title|/api/titles|titles_tab|TITLE_CLAIMED_BROADCAST" src server scripts | grep -v "docs/superpowers"
```

Expected: no matches.

- [ ] **Step 2: Grep for stray ฉายา in code (excluding specs/plans).**

Run: `grep -rn "ฉายา" src server scripts`
Expected: no matches.

- [ ] **Step 3: Final green build.**

Run: `npx vue-tsc --noEmit`
Expected: exit 0.

Run: `npx vite build`
Expected: exit 0.

- [ ] **Step 4: Manual smoke (only if a backend + DB are available).** Start the app (`npm run dev`), log in, and confirm:
  - Profile has **no** ฉายา tab and the page loads with no console errors.
  - Admin has **no** "จัดการฉายา" tab.
  - Rankings renders with no title badges and no errors.
  - No network calls 404 against `/api/titles*`.
    If no backend/DB is available, record that this step was skipped and rely on Steps 1‑3.

- [ ] **Step 5: (If Step 1 or 2 surfaced residue) fix it and commit.** Otherwise no commit needed.

```bash
git add -p
git commit -m "chore: clean up residual title references"
```

---

## Self-Review (completed by plan author)

- **Spec coverage:** DB hard-drop → Task 7. Backend routes/endpoints/mount/import → Task 6. Frontend deletes (UserTitle, AdminTitle, useUserTitles, useAdminTitle) → Task 5. Profile tab → Task 1. Rankings badge → Task 2. Admin tab → Task 3. lang keys → Task 4. `vitalcare.sql` dump → Task 7. Verification (grep + vue-tsc + build + manual) → Task 8 (and per-task gates). bot.ts confirmed clean (no task needed). `users.nickname` untouched (out of scope). All spec items covered.
- **Placeholder scan:** No TBD/TODO; each edit shows the exact code to remove and exact commands.
- **Consistency:** Task ordering keeps the build green at every commit (consumers removed before orphan files; lang keys removed after their only usage). Identifiers (`useUserTitles`, `equipped_title_id`, `TITLE_CLAIMED_BROADCAST`, key names) are consistent across tasks and match the codebase greps.
