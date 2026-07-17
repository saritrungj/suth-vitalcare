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

export function userMatchesLoginIdentifier(user: any, identifier: unknown) {
  const target = normalizeLoginIdentifier(identifier);
  if (!target) return false;

  const email = normalizeLoginIdentifier(decryptedOrPlain(user.email));
  if (email && email === target) return true;

  const rawTarget = String(identifier || "").trim();
  const phone = String(decryptedOrPlain(user.phone)).trim();
  if (phone && phone === rawTarget) return true;

  const idCode = String(decryptedOrPlain(user.id_code)).trim();
  if (idCode && idCode === rawTarget) return true;

  return false;
}
