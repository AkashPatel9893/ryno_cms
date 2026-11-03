import { expect, test } from "@playwright/test";

for (const viewport of [
  { width: 1280, height: 800 },
  { width: 375, height: 667 },
]) {
  test(`record dialog remains usable at ${viewport.width}px`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
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
      if (path.endsWith("/alerts"))
        return route.fulfill({ json: { items: [] } });
      if (path.endsWith("/order-register/summary"))
        return route.fulfill({
          json: {
            total_count: 1,
            counts_by_group: {},
            delivered_count: 1,
            in_progress_count: 0,
            cancelled_count: 0,
          },
        });
      if (path.endsWith("/order-register"))
        return route.fulfill({
          json: {
            total_count: 1,
            items: [
              {
                id: "test",
                order_number: "ORD-TEST",
                vehicle_type: { name: "Bike" },
                customer: {
                  display_name: "Customer",
                  phone: "+919900000001",
                  customer_type: "INDIVIDUAL",
                },
                route: { pickup_label: "A", drop_label: "B" },
                fare: { final_amount: "89.67" },
                status_group: "DELIVERED",
                status: "DELIVERED",
                payment: {
                  status: "PAID",
                  method: "CASH",
                  timing: "POST_DELIVERY",
                },
                created_at: "2026-11-03T00:00:00Z",
              },
            ],
          },
        });
      if (path.endsWith("/orders/test"))
        return route.fulfill({
          json: {
            order: {
              phone: "+919900000001",
              phone_masked: "+91******0001",
              id: "1539f074-1234-4567-89ab-123456789abc",
              ...Object.fromEntries(
                Array.from({ length: 30 }, (_, i) => [
                  `field_${i}`,
                  `Value ${i}`,
                ]),
              ),
            },
          },
        });
      return route.fulfill({ status: 404, json: {} });
    });
    await page.goto("/orders");
    await page
      .getByRole("button", { name: "View", exact: true })
      .first()
      .click();
    const dialog = page.getByRole("dialog", { name: "ORD-TEST" });
    await expect(dialog.getByText("+919900000001")).toBeVisible();
    await expect(dialog.getByText("+91******0001")).toHaveCount(0);
    await expect(
      dialog.getByText("1539f074-1234-4567-89ab-123456789abc"),
    ).toBeVisible();
    await expect(dialog.getByText("Value 0", { exact: true })).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: "Close dialog" }),
    ).toBeVisible();
    const bounds = await dialog.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.width).toBeLessThanOrEqual(viewport.width);
    await dialog.evaluate((element) => {
      element.scrollTop = element.scrollHeight;
    });
    await expect(dialog.getByText("Value 29", { exact: true })).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: "Close dialog" }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });
}
