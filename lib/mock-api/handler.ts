import { getStore, SNAPSHOT, TOKEN } from "@/lib/mock-api/data";
import {
  ApiError,
  bodyOf,
  fail,
  headers,
  invalid,
  json,
} from "@/lib/mock-api/http";
import { createHash } from "node:crypto";

import { endpoints } from "@/lib/mock-api/endpoints";
import { mutateActions } from "@/lib/mock-api/mutate-actions";
import { mutateAuth } from "@/lib/mock-api/mutate-auth";
import { mutateCreate } from "@/lib/mock-api/mutate-create";
import { mutateTransfers } from "@/lib/mock-api/mutate-transfers";
import { ReadAnalytics } from "@/lib/mock-api/read-analytics";
import { ReadOverview } from "@/lib/mock-api/read-overview";
import { ReadResources } from "@/lib/mock-api/read-resources";
export { endpoints } from "@/lib/mock-api/endpoints";
async function read(path: string, p: URLSearchParams): Promise<Response> {
  return (
    ReadOverview(path, p) ??
    ReadAnalytics(path, p) ??
    ReadResources(path, p) ??
    fail(
      404,
      "NOT_FOUND",
      "Mock endpoint not found. GET /api/v1 lists available endpoints.",
    )
  );
}
async function mutate(request: Request, path: string): Promise<Response> {
  const auth = await mutateAuth(request, path);
  if (auth) return auth;
  const b = await bodyOf(request);
  return (
    mutateCreate(request, path, b) ??
    mutateTransfers(request, path, b) ??
    mutateActions(request, path, b) ??
    fail(404, "NOT_FOUND", "Mock write endpoint not found")
  );
}

const pending = new Map<
  string,
  { fingerprint: string; promise: Promise<{ body: unknown; status: number }> }
>();
export async function handle(
  request: Request,
  segments: string[] = [],
): Promise<Response> {
  const path = segments.join("/");
  const p = new URL(request.url).searchParams;
  try {
    if (request.method === "OPTIONS")
      return new Response(null, { status: 204, headers });
    if (!path && request.method === "GET")
      return json({
        name: "Ryno CMS mock API",
        mock: true,
        base_url: "/api/v1",
        authentication: `Bearer ${TOKEN}`,
        snapshot: SNAPSHOT,
        notice:
          "Illustrative in-memory data. No connection to FastAPI, database, SMS, bank, or payment provider. State resets on process restart. CMS screens use this mock API.",
        endpoints,
      });
    const matching = endpoints.filter((endpoint) => {
      const parts = endpoint.path.replace(/^\/api\/v1\/?/, "").split("/");
      return (
        parts.length === segments.length &&
        parts.every((part, i) => part.startsWith("{") || part === segments[i])
      );
    });
    if (
      matching.length &&
      !matching.some((endpoint) => endpoint.method === request.method)
    )
      fail(
        405,
        "METHOD_NOT_ALLOWED",
        "Method not available for this mock endpoint",
      );
    const publicAuth = ["auth/otp/request", "auth/otp/verify", "auth/refresh"];
    if (
      !publicAuth.includes(path) &&
      request.headers.get("authorization") !== `Bearer ${TOKEN}`
    )
      fail(
        401,
        "UNAUTHORIZED",
        `Use Authorization: Bearer ${TOKEN} for this mock API`,
      );
    if (request.method === "GET") return await read(path, p);
    if (!["POST", "PATCH"].includes(request.method))
      fail(
        405,
        "METHOD_NOT_ALLOWED",
        "Supported mock methods: GET, POST, PATCH, OPTIONS",
      );
    const key = request.headers.get("idempotency-key");
    const needsKey =
      request.method === "POST" &&
      (path === "admin/payout-batches" ||
        path === "admin/data/exports" ||
        /^admin\/data\/imports\/[^/]+\/commit$/.test(path));
    if (needsKey && !key) invalid("Idempotency-Key header is required");
    if (key && (key.length < 4 || key.length > 128))
      invalid("Idempotency-Key must contain 4–128 characters");
    if (!key) return await mutate(request, path);
    const fingerprint = createHash("sha256")
      .update(request.method + path + (await request.clone().text()))
      .digest("hex");
    const cacheKey = request.method + ":" + path + ":" + key;
    const existing = getStore().idempotency.get(cacheKey);
    const active = pending.get(cacheKey);
    if (existing) {
      if (existing.fingerprint !== fingerprint)
        fail(
          409,
          "IDEMPOTENCY_KEY_REUSED",
          "Key was used with a different request body",
        );
      return existing.status === 204
        ? new Response(null, { status: 204, headers })
        : json(existing.body, existing.status);
    }
    if (active) {
      if (active.fingerprint !== fingerprint)
        fail(
          409,
          "IDEMPOTENCY_KEY_REUSED",
          "Key is in use with a different request body",
        );
      const result = await active.promise;
      return result.status === 204
        ? new Response(null, { status: 204, headers })
        : json(result.body, result.status);
    }
    const promise = (async () => {
      const result = await mutate(request, path);
      const body = result.status === 204 ? null : await result.json();
      const cached = { body, status: result.status };
      getStore().idempotency.set(cacheKey, { fingerprint, ...cached });
      return cached;
    })();
    pending.set(cacheKey, { fingerprint, promise });
    try {
      const result = await promise;
      return result.status === 204
        ? new Response(null, { status: 204, headers })
        : json(result.body, result.status);
    } finally {
      pending.delete(cacheKey);
    }
  } catch (error) {
    if (error instanceof ApiError)
      return json(
        { code: error.code, message: error.message, details: error.details },
        error.status,
      );
    console.error(
      "Mock API request failed:",
      error instanceof Error ? error.message : "unknown error",
    );
    return json(
      {
        code: "INTERNAL_ERROR",
        message: "Mock API request failed",
        details: {},
      },
      500,
    );
  }
}
