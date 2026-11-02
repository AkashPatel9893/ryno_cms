const backendBase = (
  process.env.BACKEND_API_URL || "http://localhost:8000"
).replace(/\/+$/, "");

export async function GET() {
  try {
    const response = await fetch(`${backendBase}/health/ready`, {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    const data: unknown = await response.json();
    if (typeof data !== "object" || data === null || !("status" in data))
      throw new Error("Invalid health response");
    if (response.ok && data.status === "ok")
      return Response.json(
        { status: "healthy" },
        { headers: { "Cache-Control": "no-store" } },
      );
    if (response.status === 503 && data.status === "degraded")
      return Response.json(
        { status: "degraded" },
        { headers: { "Cache-Control": "no-store" } },
      );
    throw new Error("Unexpected health response");
  } catch {
    return Response.json(
      { status: "unavailable" },
      { headers: { "Cache-Control": "no-store" } },
    );
  }
}
