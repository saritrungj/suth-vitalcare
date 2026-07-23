import assert from "node:assert/strict";
import {
  toMysqlDateTime,
  dayOf,
  sameCalendarDay,
} from "../server/lib/adminSubmission";

// Date-only input → local noon (avoids timezone day-rollover), MySQL format.
assert.equal(toMysqlDateTime("2026-07-10"), "2026-07-10 12:00:00");

// Full datetime input is preserved.
assert.equal(toMysqlDateTime("2026-07-10 08:30:15"), "2026-07-10 08:30:15");

// Output always matches the MySQL DATETIME shape.
const re = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
assert.match(toMysqlDateTime(), re, "no input → now, valid format");
assert.match(toMysqlDateTime("not-a-date"), re, "invalid → now, valid format");

// dayOf extracts the calendar day.
assert.equal(dayOf("2026-07-10 08:30:15"), "2026-07-10");
assert.equal(dayOf("2026-07-10"), "2026-07-10");

// sameCalendarDay compares only the day part.
assert.equal(
  sameCalendarDay("2026-07-10 01:00:00", "2026-07-10 23:00:00"),
  true,
);
assert.equal(
  sameCalendarDay("2026-07-10 01:00:00", "2026-07-11 01:00:00"),
  false,
);

console.log("admin-submission.test.ts OK");
