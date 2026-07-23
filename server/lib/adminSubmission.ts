// Pure date helpers for admin (possibly backdated) mission submissions.
// NO database imports — unit-tested via scripts/admin-submission.test.ts.

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Normalise an input into a MySQL DATETIME string "YYYY-MM-DD HH:mm:ss" in
 * local wall-clock. A bare "YYYY-MM-DD" is anchored at local noon so timezone
 * offsets can't roll it to the previous/next day. Invalid input falls back to now.
 */
export function toMysqlDateTime(input?: string | Date): string {
  let d: Date;
  if (!input) d = new Date();
  else if (input instanceof Date) d = input;
  else if (/^\d{4}-\d{2}-\d{2}$/.test(input)) d = new Date(`${input}T12:00:00`);
  else d = new Date(input);
  if (isNaN(d.getTime())) d = new Date();
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  );
}

/** Calendar-day portion ("YYYY-MM-DD") of a datetime or date string. */
export function dayOf(value: string): string {
  return String(value).slice(0, 10);
}

/** True when two datetime/date strings fall on the same calendar day. */
export function sameCalendarDay(a: string, b: string): boolean {
  return dayOf(a) === dayOf(b);
}
