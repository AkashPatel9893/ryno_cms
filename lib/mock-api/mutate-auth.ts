import { TOKEN, user } from "@/lib/mock-api/data";
import { bodyOf, choice, fail, headers, json, text } from "@/lib/mock-api/http";

import { uploadAsset, uploadImport } from "@/lib/mock-api/uploads";

export async function mutateAuth(
  request: Request,
  path: string,
): Promise<Response | undefined> {
  if (path === "auth/otp/request") {
    const b = await bodyOf(request);
    text(b, "phone", 6, 20);
    choice(b, "app_type", ["ADMIN"]);
    return json(
      {
        phone_masked: "+91 99•••••001",
        expires_in_seconds: 300,
        mock: true,
        demo_code: "000000",
      },
      202,
    );
  }
  if (path === "auth/otp/verify") {
    const b = await bodyOf(request);
    text(b, "phone", 6, 20);
    choice(b, "app_type", ["ADMIN"]);
    if (b.code !== "000000")
      fail(401, "INVALID_OTP", "Use the mock OTP 000000; no SMS is sent");
    return json({
      access_token: TOKEN,
      refresh_token: "mock-refresh-token-for-demo-only",
      token_type: "bearer",
      expires_in_seconds: 86400,
      is_new_user: false,
      user,
    });
  }
  if (path === "auth/refresh") {
    const b = await bodyOf(request);
    if (b.refresh_token !== "mock-refresh-token-for-demo-only")
      fail(401, "UNAUTHORIZED", "Invalid mock refresh token");
    return json({
      access_token: TOKEN,
      refresh_token: b.refresh_token,
      token_type: "bearer",
      expires_in_seconds: 86400,
      is_new_user: false,
      user,
    });
  }
  if (path === "auth/logout")
    return new Response(null, { status: 204, headers });
  if (path === "admin/data/imports") return uploadImport(request);
  if (path === "admin/creative-assets") return uploadAsset(request);
}
