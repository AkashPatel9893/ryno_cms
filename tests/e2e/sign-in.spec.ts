import { test, expect } from "@playwright/test";

test("validates the phone number before requesting an OTP", async ({
  page,
}) => {
  let requests = 0;
  await page.route("**/api/v1/auth/otp/request", async (route) => {
    requests++;
    await route.fulfill({ json: {} });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Send code" }).click();
  await expect(page.locator("#phone-error")).toHaveText(
    "Enter the 10-digit admin phone number.",
  );
  expect(requests).toBe(0);
});

test("requests an OTP, signs in, and signs out", async ({ page }) => {
  await page.route("**/api/v1/auth/otp/request", async (route) => {
    expect(route.request().postDataJSON()).toMatchObject({
      phone: "+919876543210",
      app_type: "ADMIN",
    });
    await route.fulfill({ json: {} });
  });
  await page.route("**/api/v1/auth/otp/verify", async (route) => {
    expect(route.request().postDataJSON()).toMatchObject({
      phone: "+919876543210",
      code: "123456",
      app_type: "ADMIN",
    });
    await route.fulfill({
      json: { access_token: "test-token", refresh_token: "test-refresh" },
    });
  });
  await page.route("**/api/v1/admin/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/workspace"))
      return route.fulfill({
        json: {
          user: { name: "Test Admin" },
          server_time: "2026-01-01T00:00:00Z",
          markets: [],
        },
      });
    if (path.endsWith("/alerts")) return route.fulfill({ json: { items: [] } });
    return route.fulfill({
      status: 503,
      json: { message: "Unavailable in this test" },
    });
  });
  await page.goto("/");
  await page.getByLabel("Admin phone number").fill("9876543210");
  await page.getByRole("button", { name: "Send code" }).click();
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.locator("#code-error")).toHaveText(
    "Enter the code you received.",
  );
  await page.getByLabel("One-time code").fill("123456");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(
    page.getByRole("button", { name: "Open admin account" }),
  ).toBeVisible();
  await page.evaluate(() => {
    const state = window as typeof window & { sessionFlashed?: boolean };
    state.sessionFlashed = false;
    new MutationObserver(() => {
      if (document.body.textContent?.includes("Checking your session…"))
        state.sessionFlashed = true;
    }).observe(document.body, { childList: true, subtree: true });
  });
  await page.getByRole("link", { name: "Orders", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Orders", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        (window as typeof window & { sessionFlashed?: boolean }).sessionFlashed,
    ),
  ).toBe(false);
  const account = page.getByRole("button", { name: "Open admin account" });
  await account.click();
  await expect(page.getByRole("menu")).toContainText("Test Admin");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).toBeHidden();
  await expect(account).toBeFocused();
  await account.click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  expect(
    await page.evaluate(() => localStorage.getItem("ryno_admin_access_token")),
  ).toBeNull();
});

test("sign-in fits on a narrow screen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await expect(page.getByLabel("Admin phone number")).toBeVisible();
  await expect(page.getByRole("button", { name: "Send code" })).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
});

test("removes credentials from the URL and preserves other parameters", async ({
  page,
}) => {
  await page.goto("/?phone=1234567890&code=123456&view=dashboard#overview");
  await expect(page).toHaveURL(/\?view=dashboard#overview$/);
  await expect(page.locator("form.login-card")).toHaveAttribute(
    "method",
    "post",
  );
});

test("does not render the sign-in form before checking the session", async ({
  request,
}) => {
  const response = await request.get("/");
  const html = await response.text();
  expect(html).toContain("Checking your session");
  expect(html).not.toContain('aria-labelledby="login-title"');
});
