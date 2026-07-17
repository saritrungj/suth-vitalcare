export const AUTH_USER_STORAGE_KEY = "vitalcare_user";

type MinimalUser = { id: number | string; [key: string]: any };
type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export const getStorage = (): StorageLike | null => {
  if (typeof window === "undefined") return null;
  return window.localStorage;
};

export const isValidStoredUser = (value: unknown): value is MinimalUser => {
  if (!value || typeof value !== "object") return false;
  const id = (value as any).id;
  return (
    (typeof id === "number" && Number.isFinite(id)) ||
    (typeof id === "string" && id.length > 0)
  );
};

export const readStoredUser = (
  storage: StorageLike | null = getStorage(),
): MinimalUser | null => {
  if (!storage) return null;
  const raw = storage.getItem(AUTH_USER_STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    if (isValidStoredUser(parsed)) return parsed;
  } catch {}

  storage.removeItem(AUTH_USER_STORAGE_KEY);
  return null;
};

export const writeStoredUser = (
  user: MinimalUser | null | undefined,
  storage: StorageLike | null = getStorage(),
) => {
  if (!storage) return;
  if (user) {
    storage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(user));
  } else {
    storage.removeItem(AUTH_USER_STORAGE_KEY);
  }
};
