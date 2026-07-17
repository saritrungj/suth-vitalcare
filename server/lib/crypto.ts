import crypto from "crypto";
import dotenv from "dotenv";
dotenv.config();

// 32-byte (256-bit) key for AES-256
// We require this to securely encrypt PII data
const SECRET_KEY_HEX = process.env.AES_SECRET_KEY || "";
let KEY: Buffer;

try {
  if (SECRET_KEY_HEX.length === 64) {
    KEY = Buffer.from(SECRET_KEY_HEX, "hex");
  } else {
    // Fallback for dev ONLY if secret not provided (generate a random one so it doesn't crash, but won't persist across restarts)
    console.warn(
      "⚠️ WARNING: AES_SECRET_KEY is not a 64-character hex string. Generating a temporary key for this session! Encrypted data will be lost on restart.",
    );
    KEY = crypto.randomBytes(32);
  }
} catch (e) {
  KEY = crypto.randomBytes(32);
}

const ALGORITHM = "aes-256-cbc";
const IV_LENGTH = 16;

/**
 * Encrypts a string using AES-256-CBC.
 * Returns in format: iv:encryptedData
 */
export function encrypt(
  text: string | number | null | undefined,
): string | null {
  if (text === null || text === undefined || text === "") return text as any;
  try {
    const textStr = String(text);
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
    let encrypted = cipher.update(textStr, "utf8", "hex");
    encrypted += cipher.final("hex");
    return iv.toString("hex") + ":" + encrypted;
  } catch (e) {
    console.error("Encryption error:", e);
    return String(text); // Fallback to plain if fails
  }
}

/**
 * Decrypts a string encrypted with the above method.
 */
export function decrypt(
  encryptedText: string | null | undefined,
): string | null {
  if (
    encryptedText === null ||
    encryptedText === undefined ||
    encryptedText === ""
  )
    return encryptedText as any;
  try {
    const textStr = String(encryptedText);
    if (!textStr.includes(":")) return textStr; // Probably not encrypted with our format

    const textParts = textStr.split(":");
    const ivHex = textParts.shift();
    if (!ivHex) return textStr;

    const iv = Buffer.from(ivHex, "hex");
    const encryptedTextBuffer = Buffer.from(textParts.join(":"), "hex");
    const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
    let decrypted = decipher.update(encryptedTextBuffer, undefined, "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch (e) {
    console.warn("Decryption failed for a value (wrong key or corrupted data)");
    return null; // Return null so UI shows empty field instead of ciphertext
  }
}

/**
 * Encrypts specified fields in an object (mutates or creates a copy).
 */
export function encryptFields(obj: any, fields: string[]): any {
  if (!obj) return obj;
  const result = { ...obj };
  for (const field of fields) {
    if (result[field] !== undefined && result[field] !== null) {
      result[field] = encrypt(result[field]);
    }
  }
  return result;
}

/**
 * Decrypts specified fields in an object (mutates or creates a copy).
 */
export function decryptFields(obj: any, fields: string[]): any {
  if (!obj) return obj;
  const result = { ...obj };
  for (const field of fields) {
    if (result[field] !== undefined && result[field] !== null) {
      result[field] = decrypt(result[field]);
    }
  }
  return result;
}

// Lists of fields that require encryption
export const USER_ENCRYPTED_FIELDS = [
  "email",
  "phone",
  "fname_th",
  "lname_th",
  "nickname",
  "id_code",
  "address",
  "gender",
  "weight",
  "height",
  "underlying_disease",
];

export const TANITA_ENCRYPTED_FIELDS = [
  "gender",
  "weight",
  "fat_pc",
  "fat_mass",
  "muscle_mass",
  "bmi",
  "visceral_fat",
  "metabolic_age",
];
