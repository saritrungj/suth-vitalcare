import assert from "node:assert/strict";
import fs from "node:fs";

const usersPage = fs.readFileSync(
  new URL("../src/components/admin/AdminUsers.vue", import.meta.url),
  "utf8",
);
assert.match(usersPage, /@click="resetPassword"/);
assert.doesNotMatch(usersPage, /changePasswordUser/);
assert.doesNotMatch(usersPage, /\/api\/users\/.*\/password/);

const usersComposable = fs.readFileSync(
  new URL("../src/composables/useAdminUsers.ts", import.meta.url),
  "utf8",
);
const resetPasswordFlow = usersComposable.slice(
  usersComposable.indexOf("const resetPassword ="),
  usersComposable.indexOf("const confirmBan ="),
);
assert.match(resetPasswordFlow, /mode: "default"/);
assert.match(resetPasswordFlow, /mode: "custom"/);
assert.match(resetPasswordFlow, /password\.length < 8/);
assert.match(resetPasswordFlow, /password\.length > 20/);
assert.match(resetPasswordFlow, /\/api\/users\/\$\{target\.value\.id\}\/reset-password/);

const userRoutes = fs.readFileSync(
  new URL("../server/routes/user.ts", import.meta.url),
  "utf8",
);
const adminResetRoute = userRoutes.slice(
  userRoutes.indexOf('router.post("/:id/reset-password"'),
  userRoutes.indexOf("// Deprecated role-specific endpoint"),
);
assert.match(adminResetRoute, /router\.post\("\/:id\/reset-password", requireAdmin/);
assert.match(adminResetRoute, /newPassword = `\$\{idCode\}@Suth`/);
assert.match(adminResetRoute, /mode === "custom"/);
assert.match(adminResetRoute, /password\.length < 8 \|\| password\.length > 20/);
assert.match(adminResetRoute, /reset_token = NULL, reset_token_expiry = NULL/);

console.log("admin-change-password.test.ts passed");
