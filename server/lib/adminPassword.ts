import bcrypt from "bcryptjs";

export const ADMIN_PASSWORD_MIN_LENGTH = 10;
export const ADMIN_PASSWORD_MAX_LENGTH = 128;

export function validateAdminPassword(password: unknown): string | null {
  if (typeof password !== "string" || password.length < ADMIN_PASSWORD_MIN_LENGTH) {
    return `รหัสผ่านต้องมีอย่างน้อย ${ADMIN_PASSWORD_MIN_LENGTH} ตัวอักษร`;
  }
  if (password.length > ADMIN_PASSWORD_MAX_LENGTH) {
    return `รหัสผ่านต้องไม่เกิน ${ADMIN_PASSWORD_MAX_LENGTH} ตัวอักษร`;
  }
  return null;
}

export function hashAdminPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}
