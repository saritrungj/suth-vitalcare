# Rankings: joined-activities filter, per-activity streak scoring, goal-in-row, clickable submissions

Date: 2026-07-23
Status: Approved (design)

## Problem

The Rankings page (`src/views/Rankings.vue` + `src/composables/useRankings.ts` + `server/routes/stats.ts`) currently:

1. Lists **all** activities in the activity dropdown, plus an "overall" (`rank_overall`) option.
2. Computes the per-activity leaderboard score as `SUM(task.points)` for approved submissions — it does **not** fold in the config-driven streak bonus that the scoring engine (`server/lib/scoring.ts`) awards.
3. Shows only rank / name / score — the activity's goal (target) is not visible per row.
4. Renders submission history (`SubmissionModal.vue`) as non-interactive rows.

We want, for the logged-in user's view:

1. Show **only activities the user has joined**; remove the "overall" option.
2. Display per-user scores correctly, folding the **system scoring config + streak bonus** into the per-activity score.
3. Because each activity has a different goal, show the activity **goal and score in the same row** for each user.
4. Make submission-history rows **clickable** (open the full proof image).

## Decisions (from brainstorming)

- **Scoring model:** per-activity score = `Σ task.points (approved) + streak-tier bonus`, where the streak-tier bonus comes from `master_configs` (category `scoring`, key `daily_mission.streakTiers`), falling back to `DEFAULTS` in `scoring.ts`.
- **Metric rule:** the streak bonus is a _points_ concept, so it is added **only for point-metric activities**. For unit-metric activities (กม./kcal/ก้าว/นาที/…) the leaderboard continues to rank by the raw unit value; no streak bonus is added to a distance/steps total.
- **Default selection:** on load, auto-select the **most recently joined** activity. If the user has joined no activities, show an empty state prompting them to join one.
- **Submission click:** clicking a submission row opens a **full-image lightbox** of the proof (`img_url`). Rows without an image are not clickable.
- **Approach A (centralized):** a single backend helper computes the full ranked participant list for an activity; both the paginated list and a specific user's rank derive from that same list, guaranteeing the displayed score and the computed rank agree.
- **Awarding unchanged (YAGNI):** we do **not** change how points are awarded (`score_events` remains global, per calendar day). We only _display_ a per-activity streak bonus in rankings.

## Architecture

### 1. `server/lib/scoring.ts`

Add and export:

```ts
/** Highest matching daily_mission streak-tier bonus for a given streak length. */
export async function getStreakBonus(streak: number): Promise<number>;
```

- Reuses the existing cached `loadScoringConfig()` and `cfg()` / `DEFAULTS`.
- Reads `daily_mission.streakTiers` (`[{ minStreak, bonus }]`), returns the max `bonus` whose `minStreak <= streak`, else `0`.
- Does **not** add `basePoints` (task points already represent mission points; adding base would double-count).

### 2. `server/routes/stats.ts`

Add a helper used by both the list and rank endpoints:

```ts
async function computeActivityLeaderboard(
  activityId: string | number,
  opts: { req: express.Request; metricUnit: string; isPoints: boolean },
): Promise<
  Array<{
    id: number;
    fname_th;
    nickname;
    picture_url;
    role_type;
    total_points: number; // combined score used for ordering + display
    base_points: number; // Σ task.points (approved)
    streak: number;
    streak_bonus: number; // 0 for unit-metric activities
    total_unit_value: number;
  }>
>;
```

Behavior:

- Determine the activity's official metric from `goal_config` (existing `parseGoalConfig` / `normalizeUnit` helpers) → `isPoints` + `metricUnit`.
- Fetch all registered participants for the activity (respecting existing `buildUserFilter` role_type filters).
- Fetch approved submissions for those participants scoped to the activity, grouped by user, to derive: `base_points` (Σ `t.points`), `total_unit_value` (Σ `s.value` where `metric_unit` matches for unit metrics), and the set of distinct approved dates per user (for streak).
- Compute `streak` per user (reuse the existing consecutive-day logic already present in the list endpoint; extract to a shared function `computeStreakFromDates(dates)` to avoid duplication).
- `streak_bonus = isPoints ? await getStreakBonus(streak) : 0` (bonus config loaded once per request, not per user).
- `total_points = base_points + streak_bonus` for point metrics; for unit metrics ordering uses `total_unit_value`.
- Sort: point metrics by `total_points DESC, id ASC`; unit metrics by `total_unit_value DESC, id ASC`.
- Decrypt `fname_th` / `nickname`.

Endpoint changes:

- `GET /rankings/individual?activity_id=…` → returns `computeActivityLeaderboard(...).slice(offset, offset+limit)`, augmented per row with `target`, `target_type`, `achieved` (= combined score for points / unit value for unit metric), `reached` (achieved ≥ target && target > 0). `streak` / `streak_bonus` remain on the row.
- `GET /individual/rank/:id?activity_id=…` → compute the full list, find the user's index (+1) for `rank`, return `{ rank, score: total_points, points }` from the same list.
- **Team tab** (`/rankings/team` + `/team/rank/:id` with `activity_id`): team combined score = Σ members' combined per-activity score, derived from the same per-user computation (group the computed rows by `team_id`). Ordering unchanged in shape (by combined score for point metrics, unit value otherwise).
- The **no-`activity_id`** (global/overall) branches of these endpoints are left intact server-side (other callers may exist) but are no longer exercised by the Rankings UI. No behavior change there.

Performance note: activities have bounded participant counts; computing the full list per request is acceptable and mirrors the existing per-page streak query. Config is cached ~60s in `scoring.ts`.

### 3. `server/routes/user.ts`

- `GET /:userId/registrations`: add `r.created_at AS joined_at` to the SELECT and to the grouped event object, so the frontend can sort activities by most-recent join. (Permission guard is unchanged — self/admin/host.)

### 4. `src/composables/useRankings.ts`

- **Activity source:** replace `fetchActivities()`'s `/api/activities?all=true` call with the current user's joined activities from `GET /api/users/:id/registrations`. Map each grouped entry to `{ id: event.id, title: event.title, goal_config: event.goal_config, joined_at }`. Sort by `joined_at DESC`.
- **Remove overall:** drop the `rank_overall` default. On mount (and after activities load), if `route.query.eventId` is absent, auto-select `allActivities[0]` (most recently joined). Keep URL-driven selection when `eventId` is present and still in the joined list.
- **Empty state:** expose `hasJoinedActivities` (computed). When false, the view shows an empty state instead of the leaderboard.
- **Row fields:** surface `target`, `target_type`, `achieved`, `reached` from the API rows for the template (helpers `getTarget(item)`, `isReached(item)`).
- `selectActivity(null)` / the "overall" branch is removed; `selectActivity` always takes a real id.

### 5. `src/views/Rankings.vue`

- Remove the "ภาพรวม / VitalCare System" (`rank_overall`) dropdown item.
- Banner: use the activity title; drop overall-specific subtitle wording.
- **Goal in row:** in each `list-row`, render the goal beside the score — `score / target` with the unit, and a ✓ (`Check` icon) badge when `reached`. Column header updated (e.g. `คะแนน / เป้าหมาย`). Responsive: on narrow widths the target stacks under the score.
- Empty state when `!hasJoinedActivities`: message + link/button to the Activities page.

### 6. `src/components/SubmissionModal.vue`

- Add a lightbox: clicking a submission item whose `img_url` resolves via `safeImageUrl` opens a full-screen overlay showing the image (with close on backdrop / Esc). Items without an image keep their current non-clickable appearance (cursor default).
- Lightbox is a local `ref` (`lightboxSrc`) within the modal; no new dependency.

## Data flow

```
Rankings.vue ──uses──▶ useRankings.ts
                         │  fetch joined activities  ─▶ GET /api/users/:id/registrations
                         │  fetch leaderboard page   ─▶ GET /api/stats/rankings/individual?activity_id=…
                         │  fetch my rank            ─▶ GET /api/stats/individual/rank/:id?activity_id=…
                         ▼
                stats.ts computeActivityLeaderboard()
                         │  getStreakBonus()  ◀── scoring.ts (master_configs cache)
                         ▼
                combined per-user rows (base + streak bonus, target, reached)
```

## Error handling

- Backend helpers keep the existing try/catch + `500` shape; streak/config failures fall back to `DEFAULTS` / `0` bonus (never crash the leaderboard).
- Frontend keeps existing abortable-request + toast-retry patterns. Empty joined-activity list is a normal state, not an error.

## Testing

- **Backend unit:** `getStreakBonus` tier selection (below lowest tier → 0; between tiers → correct bonus; at/above highest → highest). `computeStreakFromDates` (today/yesterday anchor, gaps break streak).
- **Backend integration:** `/rankings/individual` combined score = base + bonus for a point activity; unit activity unchanged (no bonus). `/individual/rank/:id` rank matches the row's index in `/rankings/individual` for the same activity/filters (consistency invariant).
- **Frontend:** dropdown lists only joined activities, newest-join preselected; empty state when none joined; goal cell shows target + ✓ when reached; submission row opens lightbox for image, no-op without image.

## Out of scope

- Changing point-awarding logic (`score_events`, `awardDailyMission`).
- Team-specific streak config.
- The global/overall ranking endpoints' server behavior (kept for compatibility, unused by this UI).
