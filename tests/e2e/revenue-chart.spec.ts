import { expect, test } from "@playwright/test";

test("renders revenue points and makes their values accessible", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem("ryno_admin_access_token", "test-token"),
  );
  await page.route("**/api/v1/admin/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/workspace"))
      return route.fulfill({
        json: {
          user: { name: "Test Admin" },
          server_time: "2026-11-03T00:00:00Z",
          markets: [],
        },
      });
    if (path.endsWith("/alerts") || path.endsWith("/web-enquiries"))
      return route.fulfill({ json: { items: [], total_count: 0 } });
    if (path.endsWith("/dashboard"))
      return route.fulfill({
        json: {
          data: {
            gross_fare_revenue: "1735.37",
            today_date: "2026-11-03",
            today_gross_fare_revenue: "1735.37",
            bookings_count: 1,
            today_bookings_count: 1,
            bookings_by_customer_type: {},
            counts_by_group: {},
            today_counts_by_group: {},
            rides_by_customer_type_and_group: [],
            revenue_series: [
              { date: "2026-11-01", amount: "0" },
              { date: "2026-11-03", amount: "1735.37" },
            ],
          },
        },
      });
    return route.fulfill({ status: 404, json: {} });
  });
  await page.goto("/");
  const chart = page.getByRole("img", { name: /Delivered fare revenue/ });
  await expect(chart.locator("svg")).toBeVisible();
  await expect(chart.locator("circle").first()).toBeVisible();
  await chart.locator("circle").last().hover({ force: true });
  await expect(page.locator(".revenue-tooltip")).toContainText("₹1,735.37");
  await page.getByText("View revenue by date").click();
  await expect(page.locator(".revenue-chart-details li").last()).toContainText(
    "₹1,735.37",
  );
});
