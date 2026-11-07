const BACKEND_BASE = (
  process.env.BACKEND_API_URL || "https://54-252-167-25.sslip.io"
).replace(/\/+$/, "");

type Context = { params: Promise<{ path?: string[] }> };

async function route(request: Request, context: Context) {
  const { path = [] } = await context.params;
  const requestUrl = new URL(request.url);
  const targetUrl = `${BACKEND_BASE}/api/v1/${path.join("/")}${requestUrl.search}`;

  const headers = new Headers(request.headers);
  headers.delete("host");

  const init: RequestInit = {
    method: request.method,
    headers,
  };

  if (!["GET", "HEAD"].includes(request.method)) {
    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const text = await request.text();
      if (text) init.body = text;
    } else {
      init.body = await request.blob();
    }
  }

  try {
    const backendResponse = await fetch(targetUrl, init);
    const responseHeaders = new Headers(backendResponse.headers);
    responseHeaders.delete("content-encoding");
    // fetch may decompress the body, so the upstream byte count is no longer valid.
    responseHeaders.delete("content-length");

    return new Response(backendResponse.body, {
      status: backendResponse.status,
      statusText: backendResponse.statusText,
      headers: responseHeaders,
    });
  } catch (err) {
    return Response.json(
      {
        message: `FastAPI backend is offline or unreachable at ${BACKEND_BASE}. Please ensure the backend server is running.`,
        code: "BACKEND_UNAVAILABLE",
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 503 },
    );
  }
}

export {
  route as GET,
  route as POST,
  route as PATCH,
  route as PUT,
  route as DELETE,
  route as OPTIONS,
};
