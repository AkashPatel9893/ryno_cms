import { expect, test } from "@playwright/test";

test("filters orders and exports the matching selection", async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem("ryno_admin_access_token", "test-token"),
  );
  let exportedFilters: Record<string, string> | undefined;
  let exportedPeriod: { from_date: string; to_date: string } | undefined;
  await page.route("**/api/v1/admin/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    if (path.endsWith("/workspace"))
      return route.fulfill({
        json: {
          user: { name: "Test Admin" },
          server_time: "2026-01-01T00:00:00Z",
          markets: [],
        },
      });
    if (path.endsWith("/alerts")) return route.fulfill({ json: { items: [] } });
    if (path.endsWith("/order-register/summary"))
      return route.fulfill({
        json: {
          total_count: 0,
          counts_by_group: {},
          delivered_count: 0,
          in_progress_count: 0,
          cancelled_count: 0,
          cancellation_rate_percent: null,
        },
      });
    if (path.endsWith("/order-register"))
      return route.fulfill({
        json: {
          items: [],
          next_cursor: null,
          total_count: 0,
          as_of: "2026-01-01T00:00:00Z",
        },
      });
    if (path.endsWith("/data/exports") && route.request().method() === "POST") {
      const body = route.request().postDataJSON();
      expect(body.dataset).toBe("order_register");
      exportedFilters = body.filters;
      exportedPeriod = body;
      return route.fulfill({
        json: {
          download_url: "/api/v1/admin/data/exports/test/download",
          record_count: 0,
        },
      });
    }
    if (path.endsWith("/download"))
      return route.fulfill({
        contentType: "text/csv",
        headers: { "Content-Disposition": 'attachment; filename="orders.csv"' },
        body: "order_number\n",
      });
    return route.fulfill({
      status: 404,
      json: { message: "Unexpected endpoint" },
    });
  });
  await page.goto("/orders");
  const search = page.getByRole("textbox", { name: "Search orders" });
  const trigger = page.getByRole("button", { name: /Reporting period/ });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Choose reporting period" });
  await dialog.getByLabel("From date").fill("2025-01-01");
  await dialog.getByLabel("To date").fill("2026-01-02");
  await dialog.getByRole("button", { name: "Apply dates" }).click();
  await expect(dialog.getByRole("alert")).toHaveText(
    "Choose a date range of 366 days or less.",
  );
  await dialog.getByLabel("From date").fill("2026-05-01");
  await dialog.getByLabel("To date").fill("2026-05-31");
  const filteredRequest = page.waitForRequest((request) => {
    const url = new URL(request.url());
    return (
      url.pathname.endsWith("/admin/order-register") &&
      url.searchParams.get("from") === "2026-05-01" &&
      url.searchParams.get("to") === "2026-05-31"
    );
  });
  await dialog.getByRole("button", { name: "Apply dates" }).click();
  await filteredRequest;
  await expect(dialog).toBeHidden();
  await expect(trigger).toContainText("1 May");
  await trigger.click();
  await expect(dialog.getByLabel("From date")).toHaveValue("2026-05-01");
  await dialog.getByRole("button", { name: /Sunday, May 10th, 2026/ }).click();
  await dialog.getByRole("button", { name: /Friday, May 15th, 2026/ }).click();
  await expect(dialog.getByLabel("From date")).toHaveValue("2026-05-10");
  await expect(dialog.getByLabel("To date")).toHaveValue("2026-05-15");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await dialog.getByLabel("From date").fill("2026-05-03");
  await dialog.getByRole("button", { name: "Close", exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await expect(dialog.getByLabel("From date")).toHaveValue("2026-05-01");
  await dialog.getByRole("button", { name: "Close", exact: true }).click();
  await search.fill("RY-123");
  await expect.poll(async () => search.inputValue()).toBe("RY-123");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export matching orders" }).click();
  expect((await download).suggestedFilename()).toBe("orders.csv");
  expect(exportedFilters).toMatchObject({ q: "RY-123" });
  expect(exportedPeriod).toMatchObject({
    from_date: "2026-05-01",
    to_date: "2026-05-31",
  });
  let releaseOrders!: () => void;
  const pendingOrders = new Promise<void>((resolve) => {
    releaseOrders = resolve;
  });
  await page.route("**/api/v1/admin/order-register?**", async (route) => {
    await pendingOrders;
    await route.fulfill({
      json: {
        items: [],
        next_cursor: null,
        total_count: 0,
        as_of: "2026-01-01T00:00:00Z",
      },
    });
  });
  await expect(page.getByText("Total bookings", { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: /Delivered/ }).click();
  await expect(
    page.getByRole("status", { name: "Loading data" }),
  ).toBeVisible();
  await expect(page.getByText("Total bookings", { exact: true })).toBeVisible();
  releaseOrders();
  await expect(page.getByRole("status", { name: "Loading data" })).toHaveCount(
    0,
  );

  await page.evaluate(() => {
    (window as typeof window & { savedHeader?: Element | null }).savedHeader =
      document.querySelector(".main-shell > header");
  });
  await page.getByRole("link", { name: "Reports", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Reports", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        (window as typeof window & { savedHeader?: Element | null })
          .savedHeader === document.querySelector(".main-shell > header"),
    ),
  ).toBe(true);
});

test("reporting calendar fits and remains usable on a narrow screen", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() =>
    localStorage.setItem("ryno_admin_access_token", "test-token"),
  );
  await page.route("**/api/v1/admin/**", (route) =>
    route.fulfill({
      status: 503,
      json: { message: "Unavailable in this test" },
    }),
  );
  await page.goto("/orders");
  const trigger = page.getByRole("button", { name: /Reporting period/ });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Choose reporting period" });
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Go to the Next Month" }),
  ).toBeVisible();
  const bounds = await dialog.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
  await dialog.getByRole("button", { name: "Yesterday" }).click();
  await dialog.getByRole("button", { name: "Apply dates" }).click();
  await expect(dialog).toBeHidden();
  await expect(trigger).toContainText("Yesterday");
});
