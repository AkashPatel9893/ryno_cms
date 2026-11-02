import axios, {
  AxiosHeaders,
  type AxiosError,
  type InternalAxiosRequestConfig,
} from "axios";
import {
  clearAdminSession,
  ensureAdminToken,
  getAdminToken,
  refreshAdminToken,
} from "@/lib/cms/auth";
import { RequestError } from "@/lib/cms/error";

type RetriableRequest = InternalAxiosRequestConfig & {
  retried?: boolean;
  accessToken?: string | null;
};
const client = axios.create({
  baseURL: "/api/v1",
  headers: { "Cache-Control": "no-cache" },
});

client.interceptors.request.use(async (config: RetriableRequest) => {
  const token =
    getAdminToken() ||
    (typeof window !== "undefined" ? await ensureAdminToken() : null);
  config.accessToken = token;
  if (token) config.headers.set("Authorization", `Bearer ${token}`);
  return config;
});

client.interceptors.response.use(
  undefined,
  async (error: AxiosError<{ message?: string; code?: string }>) => {
    const config = error.config as RetriableRequest | undefined;
    const token = config?.accessToken;
    if (
      error.response?.status === 401 &&
      config &&
      !config.retried &&
      token &&
      typeof window !== "undefined"
    ) {
      config.retried = true;
      const refreshed = await refreshAdminToken(token);
      if (refreshed) {
        config.headers.set("Authorization", `Bearer ${refreshed}`);
        return client(config);
      }
    }
    if (
      error.response?.status === 401 &&
      typeof window !== "undefined" &&
      (!token || getAdminToken() === token)
    ) {
      clearAdminSession();
      window.dispatchEvent(new CustomEvent("ryno:admin_unauthorized"));
    }
    if (axios.isCancel(error)) return Promise.reject(error);
    const data = error.response?.data;
    throw new RequestError(
      data?.message ||
        (error.response
          ? `Request failed (${error.response.status}). Try again.`
          : "Could not connect. Try again."),
      data?.code || "REQUEST_FAILED",
    );
  },
);

export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new AxiosHeaders();
  new Headers(options.headers).forEach((value, key) => headers.set(key, value));
  if (
    options.body &&
    !(options.body instanceof FormData) &&
    !headers.has("Content-Type")
  )
    headers.set("Content-Type", "application/json");
  const response = await client<T>({
    url: path,
    method: options.method,
    data: options.body,
    headers,
    signal: options.signal ?? undefined,
  });
  return response.status === 204 ? (undefined as T) : response.data;
}

export async function downloadResponse(path: string) {
  return client<Blob>({ url: path, responseType: "blob" });
}

export function post<T>(path: string, body: unknown = {}, idempotent = false) {
  return api<T>(path, {
    method: "POST",
    body: JSON.stringify(body),
    headers: idempotent
      ? { "Idempotency-Key": crypto.randomUUID() }
      : undefined,
  });
}
