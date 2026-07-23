# Unified per-activity scoring across Rankings, Profile, Admin, and Export

Date: 2026-07-23
Status: Approved (design) — pending plan review

## Problem

The same "score" is computed three different, disagreeing ways:

- **Profile** (`src/composables/useProfileEvents.ts`): `liveTotalPoints` and
  `getEventScore()` = raw `Σ task.points` of approved submissions — **no streak
  bonus, no admin bonus**.
- **Rankings** (`computeActivityLeaderboard` in `server/routes/stats.ts`):
  `task points + streak-tier bonus` (from `master_configs`) — **but ignores the
  `bonus_points` table**, so admin-granted bonuses don't show in rankings.
- **`users.total_score`** (DB aggregate): task points + daily-mission base+streak
  bonus + assessment + body-comp + bonus_points — a third number.

So numbers shown to users are inconsistent, admin bonuses are invisible in
rankings, and there is no per-activity breakdown on the Profile. We want one
canonical, config-driven per-activity score reused everywhere, editable per
activity, and reflected correctly in export.

## Decisions (from brainstorming Q&A)

- **Per-activity score model:** live computed `base + streak bonus + adjustment`.
  The **adjustment is the editable part**, stored in the existing **`bonus_points`**
  table (net per user+activity = `SUM(bonus_points.points)`), not a new table.
- **Total (displayed):** `Σ` of per-activity **points** scores only. It does
  **not** fold in assessment / body-composition / global daily-mission bonuses
  (user's explicit choice). `users.total_score`/`points` are left as-is (shop
  currency / legacy aggregate) and are _not_ used as the displayed total.
- **Shown on both** the user's own Profile (read-only) and AdminUserDetail
  (view + edit).
- **Export:** AdminUsers CSV gains a `คะแนนรวม (กิจกรรม)` column plus one column
  per activity, filled from the same canonical scorer so numbers match exactly.

## Canonical score model (single source of truth)

For a user `U` and a joined activity `E`:

```
base(U,E)         = Σ task.points  of U's APPROVED submissions whose task.event_id = E
streak(U,E)       = length of the consecutive-day run of U's approved submissions in E
streak_bonus(U,E) = getStreakBonus(streak)   // config-driven; 0 if E is unit-metric
adjustment(U,E)   = COALESCE(SUM(bonus_points.points WHERE user_id=U AND event_id=E), 0)
score(U,E)        = base + streak_bonus + adjustment          // always in POINTS
total(U)          = Σ_E score(U,E)   over U's joined activities
```

Notes:

- "Score" is always **points**. Unit-metric activities (กม./ก้าว/…) still have
  task `points`, so they contribute their points to the total; their unit value
  is a separate ranking metric, unaffected here.
- `streak_bonus` follows the existing rankings rule: applied only when the
  activity's metric is points (`isPoints`), else 0. This keeps it consistent with
  `computeActivityLeaderboard`.
- The `bonus_points` POST/DELETE already adjust `users.points`/`total_score`; we
  leave that untouched. Our displayed total is derived from the formula above, so
  there is no double counting in what we show.

## Architecture

### Backend (`server/routes/stats.ts`, building on existing helpers)

1. **`computeUserActivityScores(userId)`** (new helper) → returns

   ```ts
   {
     total: number,
     activities: Array<{
       event_id: number; title: string;
       base_points: number; streak: number; streak_bonus: number;
       adjustment: number; score: number; is_points: boolean;
     }>
   }
   ```

   Implementation (few grouped queries, no N+1):
   - registrations (event_id, title, goal_config) for the user;
   - approved submissions joined to tasks for the user → per-event `base` +
     distinct approved dates (for streak) + per-event metric from goal_config;
   - `bonus_points` grouped by event for the user → `adjustment`;
   - compute `streak` via `computeStreakFromDates` and `streak_bonus` via
     `getStreakBonus` (reused from `server/lib/streakScoring.ts` / `scoring.ts`).

2. **`GET /api/stats/user/:userId/activity-scores`** — self OR admin/host
   (permission check mirrors `/api/tanita/user/:userId`). Returns the object
   above. Used by Profile and AdminUserDetail.

3. **`computeActivityLeaderboard` change** — add net `bonus_points` per user for
   the activity into `base`/`total_points` so rankings reflect admin bonuses.
   (One extra grouped query keyed by the activity; adds `adjustment` to each row.)

4. **Bulk export helper + `GET /api/stats/scores/export`** (admin) → returns
   ```ts
   {
     activities: Array<{ event_id: number; title: string }>,   // column order
     users: Array<{ user_id: number; total: number; scores: Record<eventId, number> }>
   }
   ```
   Computed with grouped queries across all users (registrations, approved
   submissions+tasks, bonus_points) then the same formula in Node. On-demand
   admin action; acceptable cost.

### Adjustment editing (reuse existing endpoints)

- Read history: `GET /api/activities/:id/bonus-points` (admin/host).
- Add delta: `POST /api/activities/:id/bonus-points` `{ user_id, points (+/-), reason }`.
- Remove: `DELETE /api/activities/:id/bonus-points/:bonusId`.

No new write endpoints for adjustments — the AdminUserDetail UI calls these.

### Frontend

- **Profile** (`useProfileEvents.ts` + a scores card): fetch
  `/api/stats/user/:id/activity-scores`; expose `activityScores` + `scoreTotal`.
  Repoint `liveTotalPoints` (passed to `ProfileDashboard`) to `scoreTotal`, and
  `getEventScore(eventId)` to the endpoint's per-activity score, so the Profile
  matches Rankings. Add a read-only "คะแนนของฉัน" breakdown (per activity: base /
  streak bonus / bonus / score, plus total).
- **AdminUserDetail — คะแนน tab** (`PointsTab.vue`): add a per-activity section
  listing the user's joined activities with computed base+streak (read-only) and
  an **adjustment editor** (+/- with reason) that calls the bonus-points endpoints,
  showing current net adjustment and the resulting score, plus the derived total.
  Keep the existing raw `points`/`total_score` override below, clearly separated
  and relabeled as "คะแนนระบบ (ร้านค้า/รวมสะสม)".
- **Export** (`useAdminUsers.ts` `exportCSV`): fetch `/api/stats/scores/export`
  and build the CSV: existing columns + `คะแนนรวม (กิจกรรม)` + one column per
  activity title (value = that user's score in the activity, 0 if none).

## Data flow

```
Rankings ─▶ computeActivityLeaderboard (base + streak_bonus + bonus_points)
Profile  ─▶ GET /api/stats/user/:id/activity-scores ─▶ computeUserActivityScores
Admin    ─▶ GET /api/stats/user/:id/activity-scores (view)
            POST/DELETE /api/activities/:id/bonus-points (edit adjustment)
Export   ─▶ GET /api/stats/scores/export ─▶ bulk canonical scorer
                         │
        all derive from: base + streak_bonus + adjustment(bonus_points)
```

## Consistency guarantee

Rankings, Profile, Admin, and Export all compute score as
`base + streak_bonus + adjustment` with the same helpers (`computeStreakFromDates`,
`getStreakBonus`, `SUM(bonus_points)`), so they agree by construction. Admin
adjustments made via bonus-points immediately move all four.

## Security

- `GET /api/stats/user/:id/activity-scores`: self OR admin/host.
- `GET /api/stats/scores/export`: admin only (`requireAdmin`).
- Adjustment writes: `requireAdminOrHost` (existing bonus-points guard).

## Error handling

- Backend keeps existing try/catch + JSON error shape; missing `bonus_points`
  table is tolerated (treat adjustment as 0) — though it is ensured at startup.
- Frontend uses existing `showSuccess`/`showError` and abortable fetches; a user
  with no joined activities shows an empty breakdown + total 0.

## Testing

Repo has no DB/component harness (only pure `tsx` tests), so:

- **Pure unit test:** a `combineActivityScore({ base, streakBonus, adjustment })`
  and `sumTotal(activities)` helper extracted pure and tested with `node:assert`
  (covers the formula + total, incl. negative adjustments clamped sensibly).
- **Typecheck:** `npm run lint` after each task.
- **Browser verification** (local MySQL + dev server): confirm a user's Profile
  total = Rankings sum; add a +/- adjustment in AdminUserDetail and confirm it
  moves Profile, Rankings, and Export identically; export CSV shows total +
  per-activity columns matching the UI.

## Out of scope

- Changing `users.points`/`total_score` semantics or shop currency behavior.
- Folding assessment / body-composition / global daily bonus into the displayed
  activity total (excluded by decision).
- A brand-new adjustments table (reusing `bonus_points`).
- Team-score changes.
