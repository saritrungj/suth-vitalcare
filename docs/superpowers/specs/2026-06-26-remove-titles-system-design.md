# Remove the ฉายา / Titles System — Design Spec

**Date:** 2026-06-26
**Status:** Approved
**Sub-project 1 of 4** (sequence: ฉายา removal → configurable scoring → redemption shop → activity notifications)

## Context

The app has a gamification "ฉายา" (titles) subsystem: admins create titles with
rarity / unlock conditions / unlock codes, users unlock and **equip** one title, and the
equipped title is meant to show as a badge. The product direction is to drop this feature
entirely before building the new scoring and redemption features, to shrink the surface
area first. This spec covers a **complete removal** — code, UI, and database.

This is distinct from `users.nickname` (a profile display field), which is **out of scope**
and stays.

## Decisions

- **Database: hard drop.** Forward migration removes both tables and the user column.
  Earned-title records are permanently deleted. Accepted.
- **No data migration.** Earned titles are not converted to points or preserved.
- The titles system does not touch `users.points` / `users.total_score`, so removal has
  **no effect** on the upcoming scoring/redemption sub-projects.

## Removal Manifest

### Database (new forward migration SQL)

```sql
DROP TABLE IF EXISTS `user_titles`;
DROP TABLE IF EXISTS `gamification_titles`;
ALTER TABLE `users` DROP COLUMN `equipped_title_id`;
```

Also remove these tables/column from the committed `vitalcare.sql` schema dump so the
checked-in schema matches reality.

### Backend

- **Delete** `server/routes/titles.ts` (admin CRUD + grant/revoke; whole file).
- **`server/index.ts`** — remove the titles router import + mount, and the three inlined
  endpoints:
  - `GET /api/titles` (user-facing list with unlock/equip status, ~L300‑348)
  - `POST /api/titles/:id/claim` (~L349‑423)
  - `PATCH /api/user/:userId/equip-title` (~L424‑450)

### Frontend

- **Delete files:**
  - `src/components/UserTitle.vue`
  - `src/components/admin/AdminTitle.vue`
  - `src/composables/useUserTitles.ts`
  - `src/composables/useAdminTitle.ts`
- **`src/views/Profile.vue`** — remove the "ฉายา" menu tile (~L101‑109), the entire
  `activeTab === 'titles'` content block (~L1305‑1420), the `UserTitle`/`useUserTitles`
  imports, the `useUserTitles()` destructure (~L2002‑2003), the claim/equip handlers
  (`handleClaim`, `equipTitle` usage), title-related refs (`titleSearchQuery`,
  `filteredTitles`, `unlockedCount`, `totalCount`, `unlockProgress`), and the
  `fetchAllTitles()` call in the tab opener (~L2350).
- **`src/views/Rankings.vue`** — remove the `UserTitle` badge block (~L222‑227) and its
  import (~L284). The leaderboard API does not actually return `equipped_title_name`, so
  this display is already inert; no API change is required.
- **`src/views/Admin.vue`** — remove the `AdminTitle` import (~L31), the `titles` nav entry
  ("จัดการฉายา", ~L79‑83), and the `<AdminTitle v-else-if="activeTab === 'titles'" />`
  render (~L341).
- **`src/store/lang.ts`** — remove title-only keys in **both** `th` and `en`:
  `titles_tab`, `titles_unlocked`, `equip`, `equipped`, `unlock`, `code`,
  `no_titles_found`, and the title search placeholder. Keep any key still referenced by
  non-title code (verify each before deleting).

## Verification

1. Repo-wide grep for residual references — `UserTitle`, `useUserTitles`, `useAdminTitle`,
   `gamification_titles`, `user_titles`, `equipped_title`, `equip-title`, `/claim`,
   `titles_tab`, and stray `ฉายา` — including `server/routes/bot.ts` (leaderboard text) and
   `scripts/seed-submissions.ts`. Resolve every hit.
2. `npx vue-tsc --noEmit` → exit 0 (catches dangling imports / removed lang keys).
3. `npx vite build` → exit 0.
4. Manual smoke (if backend available): Profile has no ฉายา tab and loads; Admin has no
   "จัดการฉายา" tab; Rankings renders without title badges; no console/network 404s to
   `/api/titles*`.

## Out of scope

- `users.nickname` profile field (stays).
- Any change to points, leaderboards, missions, or health/body-composition data.
- The other three sub-projects (separate specs).
