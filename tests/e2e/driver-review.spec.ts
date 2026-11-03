import { expect, test } from "@playwright/test";

test("reviews a pending driver verification", async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem("ryno_admin_access_token", "test-token"),
  );
  let decision: unknown;
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
    if (path.endsWith("/alerts") || path.endsWith("/driver-invitations"))
      return route.fulfill({
        json: { items: [], total_count: 0, next_cursor: null },
      });
    if (path.endsWith("/partners/summary"))
      return route.fulfill({
        json: {
          data: {
            registered_riders: 1,
            online_riders: 0,
            on_delivery_riders: 0,
            registered_customers: 0,
            live_b2b_partners: 0,
            advertising_brands: 0,
          },
        },
      });
    if (path.endsWith("/drivers"))
      return route.fulfill({
        json: {
          items: [
            {
              id: "driver-1",
              first_name: "Asha",
              last_name: "Rao",
              driver_number: "D-1",
              phone_masked: "***123",
              current_vehicle: null,
              compliance_status: "PENDING",
              availability: "OFFLINE",
              period_delivered_count: 0,
              rating: null,
            },
          ],
          total_count: 1,
          next_cursor: null,
        },
      });
    if (path.endsWith("/drivers/driver-1/verification"))
      return route.fulfill({
        json: {
          driver_number: "D-1",
          onboarding_status: "SUBMITTED",
          account_status: "PENDING",
          documents: [],
          vehicle_documents: [],
          bank_accounts: [],
          vehicles: [],
          eligibility: { online_allowed: false, reasons: [] },
        },
      });
    if (path.endsWith("/drivers/driver-1"))
      return route.fulfill({ json: { first_name: "Asha", last_name: "Rao" } });
    if (path.endsWith("/verifications/pending"))
      return route.fulfill({
        json: [
          {
            verification_id: "check-1",
            subject: "DRIVER",
            subject_id: "driver-1",
            verification_type: "DOCUMENT",
            status: "PENDING",
            requested_at: "2026-01-01T00:00:00Z",
          },
        ],
      });
    if (
      path.endsWith("/verifications/check-1/approve") &&
      route.request().method() === "POST"
    ) {
      decision = route.request().postDataJSON();
      return route.fulfill({ json: {} });
    }
    return route.fulfill({
      status: 404,
      json: { message: "Unexpected endpoint" },
    });
  });
  await page.goto("/partners");
  await page.getByRole("button", { name: "Verification" }).click();
  await expect(page).toHaveURL(/\/partners\/drivers\/driver-1\/verification$/);
  await expect(
    page.getByRole("heading", { name: "Verification · Asha Rao" }),
  ).toBeVisible();
  for (const width of [1440, 375]) {
    await page.setViewportSize({ width, height: 800 });
    const panel = page
      .getByRole("heading", { name: "Verification · Asha Rao" })
      .locator("xpath=ancestor::section[contains(@class, 'panel')]");
    const back = page.getByRole("link", { name: "Back to partners" });
    const [panelBox, backBox, mainBox] = await Promise.all([
      panel.boundingBox(),
      back.boundingBox(),
      page.locator("main").boundingBox(),
    ]);
    expect(panelBox!.y).toBeGreaterThan(backBox!.y);
    expect(panelBox!.width).toBeGreaterThan(mainBox!.width * 0.8);
  }
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Verification · Asha Rao" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Approve", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Approve verification" });
  await dialog
    .getByLabel("Reason code (at least 2 characters)")
    .fill("VERIFIED");
  await dialog.getByRole("button", { name: "Approve verification" }).click();
  await expect(dialog).toBeHidden();
  expect(decision).toMatchObject({ reason_code: "VERIFIED" });
  await page.getByRole("link", { name: "Back to partners" }).click();
  await expect(page).toHaveURL(/\/partners$/);
});
