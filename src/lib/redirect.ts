const REDIRECT_KEY = "redirect_after_login";

/** บันทึกปลายทางที่จะกลับไปหลัง Login สำเร็จ (เรียกจาก router guard) */
export const setRedirectAfterLogin = (path: string) => {
  sessionStorage.setItem(REDIRECT_KEY, path);
};

/**
 * อ่านและล้างปลายทางที่บันทึกไว้ พร้อม validate ว่าเป็น internal path จริง
 * (กัน open-redirect จาก `//evil.com` หรือ absolute URL) — ใช้จุดเดียวทุกที่
 * ที่ต้อง redirect หลัง login สำเร็จ แทนการอ่าน sessionStorage ตรงๆ
 */
export const consumeSafeRedirect = (): string => {
  const saved = sessionStorage.getItem(REDIRECT_KEY);
  sessionStorage.removeItem(REDIRECT_KEY);
  const isSafe =
    typeof saved === "string" &&
    saved.startsWith("/") &&
    !saved.startsWith("//");
  return isSafe ? (saved as string) : "/";
};
