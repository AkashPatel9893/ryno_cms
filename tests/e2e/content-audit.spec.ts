import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem("ryno_admin_access_token", "test-token"),
  );
});

test("marketing shows actual campaign data without invented previews or reward totals", async ({
  page,
}) => {
  await page.route("**/api/v1/admin/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/workspace"))
      return route.fulfill({
        json: {
          user: { name: "Admin" },
          server_time: "2026-11-03T00:00:00Z",
          markets: [],
        },
      });
    if (path.endsWith("/alerts")) return route.fulfill({ json: { items: [] } });
    if (path.endsWith("/marketing/summary"))
      return route.fulfill({
        json: {
          data: {
            live_campaigns: 0,
            impressions: 0,
            coupon_redemptions: 0,
            cashback_credited: null,
            incentives_credited: null,
          },
        },
      });
    if (path.endsWith("/coupons")) return route.fulfill({ json: [] });
    return route.fulfill({
      json: { items: [], total_count: 0, as_of: "2026-11-03T00:00:00Z" },
    });
  });
  await page.goto("/marketing");
  await expect(
    page.getByRole("heading", { name: "Campaign schedule" }),
  ).toBeVisible();
  await expect(page.getByText("Big plans.")).toHaveCount(0);
  await expect(page.getByText("Rewards credited")).toHaveCount(0);
  await expect(page.getByRole("tab", { name: "Rider incentives" })).toHaveCount(
    0,
  );
});

test("support status filters use the API and do not invent a hotline or totals", async ({
  page,
}) => {
  const paths: string[] = [];
  await page.route("**/api/v1/admin/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("/workspace"))
      return route.fulfill({
        json: {
          user: { name: "Admin" },
          server_time: "2026-11-03T00:00:00Z",
          markets: [],
        },
      });
    if (url.pathname.endsWith("/alerts"))
      return route.fulfill({ json: { items: [] } });
    if (url.pathname.endsWith("/support/inbox")) {
      paths.push(url.search);
      return route.fulfill({
        json: {
          items: [],
          next_cursor: null,
          total_count: 0,
          as_of: "2026-11-03T00:00:00Z",
          status_counts: {},
        },
      });
    }
    if (url.pathname.endsWith("/support/chats/queue"))
      return route.fulfill({ json: [] });
    return route.fulfill({ status: 404, json: {} });
  });
  await page.goto("/support");
  await expect(
    page.getByRole("heading", { name: "Customer & Driver Support Tickets" }),
  ).toBeVisible();
  await expect(page.getByText("Total support tickets")).toHaveCount(0);
  await expect(page.getByText("+91 1800 120 120")).toHaveCount(0);
  await page.getByRole("tab", { name: "Open", exact: true }).click();
  await expect
    .poll(() => paths.some((path) => path.includes("status=OPEN")))
    .toBe(true);
});
