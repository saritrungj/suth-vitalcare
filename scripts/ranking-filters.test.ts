import assert from "node:assert/strict";
import {
  buildUserFilterFromValues,
  collectRankingFilterOptions,
  parseRankingFilterValues,
} from "../server/lib/rankingFilters";

const parsed = parseRankingFilterValues({
  role_type: "นักศึกษา, บุคลากรมหาวิทยาลัย ,,",
  faculty: [" สำนักวิชาพยาบาลศาสตร์, สำนักวิชาแพทยศาสตร์ "],
  year: "ปี 1,ปี 2",
});
assert.deepEqual(parsed, {
  roleTypes: ["นักศึกษา", "บุคลากรมหาวิทยาลัย"],
});

const filter = buildUserFilterFromValues(parsed, "u2");
assert.equal(filter.sql, " AND u2.role_type IN (?)");
assert.deepEqual(filter.p, [["นักศึกษา", "บุคลากรมหาวิทยาลัย"]]);
assert.equal(filter.hasFilters, true);

const emptyFilter = buildUserFilterFromValues(
  parseRankingFilterValues({ role_type: "", faculty: "", year: "" }),
  "u",
);
assert.deepEqual(emptyFilter, { sql: "", p: [], hasFilters: false });

const options = collectRankingFilterOptions([
  { role_type: " นักศึกษา " },
  { role_type: "นักศึกษา" },
  { role_type: "บุคลากรมหาวิทยาลัย" },
  { role_type: "บุคลากรโรงพยาบาล" },
  { role_type: "" },
]);
assert.deepEqual(options.roleTypes, [
  "นักศึกษา",
  "บุคลากรมหาวิทยาลัย",
  "บุคลากรโรงพยาบาล",
]);
