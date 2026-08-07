import { decrypt } from "./crypto.js";

export function normalizeLoginIdentifier(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

export function decryptedOrPlain(value: unknown) {
  if (value === null || value === undefined || value === "") return "";
  const raw = String(value);
  return decrypt(raw) || raw;
}

/**
 * Phone numbers are stored however the form happened to format them — the
 * signup wizard rewrites input to `081-234-5678` while other paths (LINE, admin
 * import) store bare digits. Matching on digits only makes both spellings reach
 * the same account. Requires 9+ digits so a short numeric username or id_code
 * can never be mistaken for a phone number.
 */
const MIN_PHONE_DIGITS = 9;
const phoneDigits = (value: unknown) => String(value || "").replace(/\D/g, "");

export function userMatchesLoginIdentifier(user: any, identifier: unknown) {
  const target = normalizeLoginIdentifier(identifier);
  if (!target) return false;

  // Username is stored plaintext (not encrypted) and matched case-insensitively.
  const username = normalizeLoginIdentifier(user.username);
  if (username && username === target) return true;

  const email = normalizeLoginIdentifier(decryptedOrPlain(user.email));
  if (email && email === target) return true;

  // id_code may contain letters (staff/employee codes), so compare it
  // case-insensitively too — `target` is already lowercased.
  const idCode = normalizeLoginIdentifier(decryptedOrPlain(user.id_code));
  if (idCode && idCode === target) return true;

  const targetPhone = phoneDigits(target);
  if (targetPhone.length >= MIN_PHONE_DIGITS) {
    const phone = phoneDigits(decryptedOrPlain(user.phone));
    if (phone.length >= MIN_PHONE_DIGITS && phone === targetPhone) return true;
  }

  return false;
}
