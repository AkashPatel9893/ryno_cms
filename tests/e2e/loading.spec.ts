import { expect, test } from "@playwright/test";

test("shows a loading indicator until screen data responds", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem("ryno_admin_access_token", "test-token"),
  );
  let finishRequest!: () => void;
  const waitForResponse = new Promise<void>((resolve) => {
    finishRequest = resolve;
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
    if (path.endsWith("/alerts") || path.endsWith("/web-enquiries"))
      return route.fulfill({ json: { items: [] } });
    if (path.endsWith("/dashboard")) {
      await waitForResponse;
      return route.fulfill({
        status: 503,
        json: { message: "Data unavailable" },
      });
    }
    return route.fulfill({ status: 404, json: {} });
  });
  await page.goto("/");
  await expect(
    page.getByRole("status", { name: "Loading data" }),
  ).toBeVisible();
  finishRequest();
  await expect(page.getByText("Data unavailable")).toBeVisible();
  await expect(page.getByRole("status", { name: "Loading data" })).toHaveCount(
    0,
  );
});
