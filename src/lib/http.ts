import { authStore } from "../store/auth";

export class HttpError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}

interface JsonOptions {
  signal?: AbortSignal;
  /** Attach the x-user-id auth header (default: true). */
  withAuth?: boolean;
}

/**
 * Minimal abortable JSON fetch wrapper for the raw `fetch` call sites that are
 * not on the useSWR layer (rankings, submission modal, etc). Provides:
 *  - consistent x-user-id auth header
 *  - AbortSignal support so callers can cancel stale in-flight requests
 *  - a typed error (HttpError) carrying the status code
 *
 * Aborted requests reject with a DOMException(name === 'AbortError'); callers
 * should ignore those rather than surfacing them as errors.
 */
export async function abortableJson<T = any>(
  url: string,
  { signal, withAuth = true }: JsonOptions = {},
): Promise<T> {
  const headers: Record<string, string> = {};
  if (withAuth && authStore.user?.id) {
    headers["x-user-id"] = String(authStore.user.id);
  }
  const res = await fetch(url, { headers, signal });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new HttpError(
      body.error || body.message || `เกิดข้อผิดพลาดในการเชื่อมต่อ (${res.status})`,
      res.status,
    );
  }
  return res.json();
}

/** True when an error is an aborted-request signal that callers can ignore. */
export const isAbortError = (err: unknown): boolean =>
  err instanceof DOMException && err.name === "AbortError";
