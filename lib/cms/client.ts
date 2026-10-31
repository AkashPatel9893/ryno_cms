"use client";
import { useEffect, useState } from "react";

export type Row = { id: string; [key: string]: unknown };
export type Order = {
  id: string;
  order_number: string;
  market_id: string;
  status: string;
  status_group: string;
  created_at: string;
  completed_at: string | null;
  customer: { id: string; customer_number: string; display_name: string; customer_type: string; phone_masked: string };
  route: { pickup_label: string; drop_label: string; stop_count: number };
  vehicle_type: { id: string; code: string; name: string };
  fare: { quoted_amount: string; final_amount: string | null; currency: string };
  payment: {
    payment_id: string;
    method: string;
    timing: string;
    status: string;
    gateway_status: string;
    paid_at: string | null;
    refunded_amount: string;
  };
  assigned_driver_id: string | null;
};

export type Page<T> = { items: T[]; next_cursor: string | null; total_count: number; as_of: string };
export type Aggregate<T> = { market_id: string; from_date: string; to_date: string; as_of: string; currency: string; timezone: string; data: T };
export type Period = { from: string; to: string };
export type Point = { date: string; amount: string; bookings_count: number; comparison_amount: string | null };
export type Dashboard = {
  gross_fare_revenue: string;
  today_date: string;
  today_gross_fare_revenue: string;
  bookings_count: number;
  today_bookings_count: number;
  counts_by_group: Record<string, number>;
  today_counts_by_group: Record<string, number>;
  bookings_by_customer_type: Record<string, number>;
  revenue_series: Point[];
  rides_by_customer_type_and_group: { status_group: string; individual_count: number; business_count: number }[];
  open_web_enquiries_count: number;
};
export type FormField = { name: string; label: string; type?: string; required?: boolean; options?: { value: string; label: string }[]; value?: string; min?: string; max?: string };
export type Dialog = { title: string; body?: React.ReactNode; fields?: FormField[]; submit?: (data: FormData) => Promise<void>; submitLabel?: string; secondary?: { label: string; run: (data: FormData) => Promise<void> } };
export type Actions = { notify: (message: string) => void; dialog: (value: Dialog) => void; inspect: (title: string, path: string) => void; refresh: () => void };

export class RequestError extends Error {
  constructor(message: string, public code: string) {
    super(message);
  }
}

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
}

export async function requestAdminOtp(phone: string): Promise<void> {
  const res = await fetch("/api/v1/auth/otp/request", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone, app_type: "ADMIN" }),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { message?: string; code?: string };
    throw new RequestError(err.message || "Could not request a code", err.code || "OTP_REQUEST_FAILED");
  }
}

export async function loginWithOtp(phone: string, code: string): Promise<string> {
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
    const err = (await res.json().catch(() => ({}))) as { message?: string; code?: string };
    throw new RequestError(err.message || "Failed to verify OTP", err.code || "OTP_VERIFY_FAILED");
  }
  const data = await res.json();
  const token = (data.access_token || data.data?.access_token) as string;
  const refreshToken = (data.refresh_token || data.data?.refresh_token) as string | undefined;
  setAdminSession(token, refreshToken);
  return token;
}

let autoLoginPromise: Promise<string | null> | null = null;
let refreshPromise: Promise<string | null> | null = null;

async function refreshAdminToken(expiredToken: string): Promise<string | null> {
  if (refreshPromise) return refreshPromise;
  const refresh = async () => {
    // Another request or tab may already have rotated the token while we waited.
    const current = getAdminToken();
    if (!current) return null;
    if (current !== expiredToken) return current;
    const refreshToken = localStorage.getItem(STORAGE_KEY_REFRESH);
    if (!refreshToken) return null;
    const response = await fetch('/api/v1/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
      cache: 'no-store',
    });
    if (response.status === 401 || response.status === 403) return null;
    if (!response.ok) throw new RequestError('Could not renew the session. Please try again.', 'SESSION_REFRESH_FAILED');
    const data = await response.json();
    const access = data.access_token ?? data.data?.access_token;
    const rotated = data.refresh_token ?? data.data?.refresh_token;
    if (typeof access !== 'string' || typeof rotated !== 'string') {
      throw new RequestError('Could not renew the session. Please try again.', 'SESSION_REFRESH_FAILED');
    }
    // Do not restore a session that was signed out or replaced while the request was in flight.
    if (getAdminToken() !== expiredToken || localStorage.getItem(STORAGE_KEY_REFRESH) !== refreshToken) return getAdminToken();
    setAdminSession(access, rotated);
    return access as string;
  };
  refreshPromise = (async () => navigator.locks
    ? await navigator.locks.request('ryno-admin-session-refresh', refresh)
    : await refresh())().finally(() => { refreshPromise = null; });
  return refreshPromise;
}

/**
 * Dev convenience only: signs in as the seeded admin through the backend's dev OTP lookup. Off unless
 * NEXT_PUBLIC_CMS_DEV_AUTOLOGIN=true in a non-production build, so a normal run always asks for sign-in.
 */
const DEV_AUTOLOGIN =
  process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_CMS_DEV_AUTOLOGIN === "true";

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
      const devOtpRes = await fetch(`/api/v1/dev/otp?phone=${encodeURIComponent(defaultPhone)}`);
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

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  let token = getAdminToken();
  if (!token && typeof window !== "undefined") {
    token = await ensureAdminToken();
  }

  const send = (accessToken: string | null) => fetch("/api/v1" + path, {
    ...options,
    cache: "no-store",
    headers: {
      ...(options.body instanceof FormData ? {} : options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
  });

  let response = await send(token);
  if (response.status === 401 && token && typeof window !== "undefined") {
    const refreshed = await refreshAdminToken(token);
    if (refreshed) {
      token = refreshed;
      response = await send(token);
    }
  }

  if (response.status === 401 && typeof window !== "undefined") {
    if (!token || getAdminToken() === token) {
      clearAdminSession();
      window.dispatchEvent(new CustomEvent("ryno:admin_unauthorized"));
    }
  }

  if (!response.ok) {
    let error: { message?: string; code?: string } = {};
    try {
      error = await response.json();
    } catch {}
    throw new RequestError(error.message || `Request failed (${response.status}). Try again.`, error.code || "REQUEST_FAILED");
  }

  if (response.status === 204) return undefined as T;
  return response.json();
}

export function post<T>(path: string, body: unknown = {}, idempotent = false) {
  return api<T>(path, {
    method: "POST",
    body: JSON.stringify(body),
    headers: idempotent ? { "Idempotency-Key": crypto.randomUUID() } : undefined,
  });
}

export function useApi<T>(paths: string[], revision = 0) {
  const key = JSON.stringify([paths, revision]);
  const [state, setState] = useState<{ key: string; data: T | null; error: string | null }>({
    key: "",
    data: null,
    error: null,
  });

  useEffect(() => {
    const controller = new AbortController();
    const urls = JSON.parse(key)[0] as string[];
    Promise.all(urls.map((path) => api(path, { signal: controller.signal })))
      .then((data) => setState({ key, data: data as T, error: null }))
      .catch((error) => {
        if (!controller.signal.aborted)
          setState({ key, data: null, error: error instanceof Error ? error.message : "Could not load records" });
      });
    return () => controller.abort();
  }, [key]);

  return state.key === key ? { ...state, loading: false } : { data: null, error: null, loading: true };
}

export function query(period: Period, extra: Record<string, string> = {}) {
  return new URLSearchParams({
    ...period,
    ...Object.fromEntries(Object.entries(extra).filter(([, value]) => value)),
  }).toString();
}

export function rupees(value: unknown) {
  return value == null
    ? "Not available"
    : new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 2,
        minimumFractionDigits: 0,
      }).format(Number(value));
}

export function number(value: unknown) {
  return Number(value || 0).toLocaleString("en-IN");
}

export function label(value: unknown) {
  return value == null
    ? "Not available"
    : String(value)
        .toLowerCase()
        .split("_")
        .map((s) => s[0]?.toUpperCase() + s.slice(1))
        .join(" ");
}

export function dateTime(value: unknown) {
  if (!value) return "Not available";
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  }).format(new Date(String(value)));
}

export function dateLabel(period: Period) {
  return (
    new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" }).format(
      new Date(period.from)
    ) +
    " – " +
    new Intl.DateTimeFormat("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "Asia/Kolkata",
    }).format(new Date(period.to))
  );
}

export async function download(path: string, fallback = "export.csv") {
  const token = getAdminToken();
  const authHeaders: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
  const response = await fetch("/api/v1" + path, { headers: authHeaders, cache: "no-store" });
  if (!response.ok) {
    const error = (await response.json().catch(() => ({}))) as { message?: string };
    throw new Error(error.message || "Download failed");
  }
  const url = URL.createObjectURL(await response.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = response.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1] || fallback;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function exportData(dataset: string, period: Period, filters: Record<string, string> = {}) {
  const job = await post<{ download_url: string; record_count: number }>(
    "/admin/data/exports",
    { dataset, format: "csv", from_date: period.from, to_date: period.to, filters },
    true
  );
  await download(job.download_url.replace("/api/v1", ""));
  return job.record_count;
}
