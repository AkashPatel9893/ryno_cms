import { RequestError } from "@/lib/cms/error";

const STORAGE_KEY_TOKEN = "ryno_admin_access_token";
const STORAGE_KEY_REFRESH = "ryno_admin_refresh_token";

export function getAdminToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(STORAGE_KEY_TOKEN);
}

export function setAdminSession(accessToken: string, refreshToken?: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY_TOKEN, accessToken);
  if (refreshToken) localStorage.setItem(STORAGE_KEY_REFRESH, refreshToken);
  else localStorage.removeItem(STORAGE_KEY_REFRESH);
}

export function clearAdminSession() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY_TOKEN);
  localStorage.removeItem(STORAGE_KEY_REFRESH);
  window.dispatchEvent(new Event("ryno:admin_session_cleared"));
}

export async function requestAdminOtp(phone: string): Promise<void> {
  const res = await fetch("/api/v1/auth/otp/request", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone, app_type: "ADMIN" }),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as {
      message?: string;
      code?: string;
    };
    throw new RequestError(
      err.message || "Could not request a code",
      err.code || "OTP_REQUEST_FAILED",
    );
  }
}

export async function loginWithOtp(
  phone: string,
  code: string,
): Promise<string> {
  const res = await fetch("/api/v1/auth/otp/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      phone,
      code,
      app_type: "ADMIN",
      device: { device_uuid: "cms-web-client", platform: "WEB" },
    }),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as {
      message?: string;
      code?: string;
    };
    throw new RequestError(
      err.message || "Failed to verify OTP",
      err.code || "OTP_VERIFY_FAILED",
    );
  }
  const data = await res.json();
  const token = (data.access_token || data.data?.access_token) as string;
  const refreshToken = (data.refresh_token || data.data?.refresh_token) as
    string | undefined;
  setAdminSession(token, refreshToken);
  return token;
}

let autoLoginPromise: Promise<string | null> | null = null;
let refreshPromise: Promise<string | null> | null = null;

export async function refreshAdminToken(
  expiredToken: string,
): Promise<string | null> {
  if (refreshPromise) return refreshPromise;
  const refresh = async () => {
    // Another request or tab may already have rotated the token while we waited.
    const current = getAdminToken();
    if (!current) return null;
    if (current !== expiredToken) return current;
    const refreshToken = localStorage.getItem(STORAGE_KEY_REFRESH);
    if (!refreshToken) return null;
    const response = await fetch("/api/v1/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
      cache: "no-store",
    });
    if (response.status === 401 || response.status === 403) return null;
    if (!response.ok)
      throw new RequestError(
        "Could not renew the session. Please try again.",
        "SESSION_REFRESH_FAILED",
      );
    const data = await response.json();
    const access = data.access_token ?? data.data?.access_token;
    const rotated = data.refresh_token ?? data.data?.refresh_token;
    if (typeof access !== "string" || typeof rotated !== "string") {
      throw new RequestError(
        "Could not renew the session. Please try again.",
        "SESSION_REFRESH_FAILED",
      );
    }
    // Do not restore a session that was signed out or replaced while the request was in flight.
    if (
      getAdminToken() !== expiredToken ||
      localStorage.getItem(STORAGE_KEY_REFRESH) !== refreshToken
    )
      return getAdminToken();
    setAdminSession(access, rotated);
    return access as string;
  };
  refreshPromise = (async () =>
    navigator.locks
      ? await navigator.locks.request("ryno-admin-session-refresh", refresh)
      : await refresh())().finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}

/**
 * Dev convenience only: signs in as the seeded admin through the backend's dev OTP lookup. Off unless
 * NEXT_PUBLIC_CMS_DEV_AUTOLOGIN=true in a non-production build, so a normal run always asks for sign-in.
 */
const DEV_AUTOLOGIN =
  process.env.NODE_ENV !== "production" &&
  process.env.NEXT_PUBLIC_CMS_DEV_AUTOLOGIN === "true";

export async function ensureAdminToken(): Promise<string | null> {
  const current = getAdminToken();
  if (current) return current;
  if (!DEV_AUTOLOGIN) return null;

  if (autoLoginPromise) return autoLoginPromise;

  autoLoginPromise = (async () => {
    try {
      const defaultPhone = "+919900000001";
      await fetch("/api/v1/auth/otp/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: defaultPhone, app_type: "ADMIN" }),
      });
      const devOtpRes = await fetch(
        `/api/v1/dev/otp?phone=${encodeURIComponent(defaultPhone)}`,
      );
      if (devOtpRes.ok) {
        const { code } = await devOtpRes.json();
        if (code) {
          return await loginWithOtp(defaultPhone, code);
        }
      }
    } catch {
      // In production or when dev OTP is disabled, manual sign-in is required
    } finally {
      autoLoginPromise = null;
    }
    return null;
  })();

  return autoLoginPromise;
}
