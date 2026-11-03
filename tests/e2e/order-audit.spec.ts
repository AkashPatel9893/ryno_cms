import { expect, test } from "@playwright/test";

test("loads audit actions only after choosing an order ID", async ({
  page,
}) => {
  const orderId = "1539f074-1234-4567-89ab-123456789abc";
  const queries: string[] = [];
  await page.addInitScript(() =>
    localStorage.setItem("ryno_admin_access_token", "test-token"),
  );
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
    if (url.pathname.endsWith("/order-register/summary"))
      return route.fulfill({ json: { total_count: 0, counts_by_group: {} } });
    if (url.pathname.endsWith("/order-register"))
      return route.fulfill({
        json: { items: [], total_count: 0, next_cursor: null },
      });
    if (url.pathname.endsWith("/admin-actions")) {
      queries.push(url.search);
      return route.fulfill({
        json: [
          {
            id: "action",
            entity_type: "order",
            entity_id: orderId,
            admin_user_id: "admin-id",
            action_type: "ORDER_CANCELLED",
            reason: "Requested",
            created_at: "2026-11-03T00:00:00Z",
          },
        ],
      });
    }
    return route.fulfill({ status: 404, json: {} });
  });
  await page.goto("/orders");
  await page.getByRole("tab", { name: "Admin actions audit" }).click();
  await expect(
    page.getByRole("heading", { name: "Order actions audit" }),
  ).toBeVisible();
  expect(queries).toHaveLength(0);
  await page.getByLabel("Order record ID").fill(orderId);
  await page.getByRole("button", { name: "Find actions" }).click();
  await expect(page.getByText("Requested")).toBeVisible();
  expect(new URLSearchParams(queries[0]).get("entity_type")).toBe("order");
  expect(new URLSearchParams(queries[0]).get("entity_id")).toBe(orderId);
});
