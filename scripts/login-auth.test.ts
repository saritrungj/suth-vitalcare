import assert from "node:assert/strict";
import { encrypt } from "../server/lib/crypto";
import {
  decryptedOrPlain,
  normalizeLoginIdentifier,
  userMatchesLoginIdentifier,
} from "../server/lib/loginAuth";

assert.equal(
  normalizeLoginIdentifier("  USER@EXAMPLE.COM "),
  "user@example.com",
);
assert.equal(decryptedOrPlain("plain@example.com"), "plain@example.com");

const encryptedUser = {
  email: encrypt("user@example.com"),
  phone: encrypt("0812345678"),
  id_code: encrypt("1234567890123"),
};

assert.equal(
  userMatchesLoginIdentifier(encryptedUser, "USER@example.com"),
  true,
);
assert.equal(userMatchesLoginIdentifier(encryptedUser, "0812345678"), true);
assert.equal(userMatchesLoginIdentifier(encryptedUser, "1234567890123"), true);
assert.equal(
  userMatchesLoginIdentifier(encryptedUser, "missing@example.com"),
  false,
);

const plainUser = {
  email: "admin",
  phone: "0000000000",
  id_code: null,
};

assert.equal(userMatchesLoginIdentifier(plainUser, " admin "), true);

// ── Username ────────────────────────────────────────────────────────────────
// Stored plaintext with the user's original casing; login must be
// case-insensitive so "Sarit01" and "sarit01" reach the same account.
const usernameUser = { username: "Sarit01", email: null, phone: null };
assert.equal(userMatchesLoginIdentifier(usernameUser, "sarit01"), true);
assert.equal(userMatchesLoginIdentifier(usernameUser, "  SARIT01 "), true);
assert.equal(userMatchesLoginIdentifier(usernameUser, "sarit"), false);

// ── Phone: stored formatted, typed raw (and vice versa) ─────────────────────
// Signup.vue reformats phone input to 081-234-5678 before saving, so the
// stored value keeps the dashes while users type their number as digits.
// Both directions must resolve to the same account.
const dashedPhoneUser = { phone: encrypt("081-234-5678"), email: null };
assert.equal(userMatchesLoginIdentifier(dashedPhoneUser, "0812345678"), true);
assert.equal(userMatchesLoginIdentifier(dashedPhoneUser, "081-234-5678"), true);
assert.equal(userMatchesLoginIdentifier(encryptedUser, "081-234-5678"), true);
// A different number must still not match.
assert.equal(userMatchesLoginIdentifier(dashedPhoneUser, "0899999999"), false);
// Too-short digit strings must not be treated as a phone match.
assert.equal(userMatchesLoginIdentifier(dashedPhoneUser, "081"), false);

// ── id_code with letters must stay case-insensitive ─────────────────────────
// login-email lowercases the identifier before matching, so an id_code such as
// "EMP1234" could never match if it were compared case-sensitively.
const staffUser = { id_code: encrypt("EMP1234"), email: null, phone: null };
assert.equal(userMatchesLoginIdentifier(staffUser, "EMP1234"), true);
assert.equal(userMatchesLoginIdentifier(staffUser, "emp1234"), true);

// ── Pre-normalized identifiers (login-email passes a lowercased string) ─────
assert.equal(userMatchesLoginIdentifier(staffUser, "emp1234"), true);
assert.equal(userMatchesLoginIdentifier(usernameUser, "sarit01"), true);

// ── Empty / junk identifiers must never match a user ────────────────────────
const emptyish = { username: null, email: null, phone: null, id_code: null };
assert.equal(userMatchesLoginIdentifier(emptyish, "anything"), false);
assert.equal(userMatchesLoginIdentifier(usernameUser, ""), false);
assert.equal(userMatchesLoginIdentifier(usernameUser, "   "), false);

console.log("login-auth.test.ts passed");
