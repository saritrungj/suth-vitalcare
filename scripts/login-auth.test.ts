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
