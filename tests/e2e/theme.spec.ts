import { expect, test } from "@playwright/test";

test("supports system, light and dark appearance and remembers selection", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.addInitScript(() =>
    localStorage.setItem("ryno_admin_access_token", "test-token"),
  );
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
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.getByRole("button", { name: "Open admin account" }).click();
  await expect(
    page.getByRole("menuitemradio", { name: "System" }),
  ).toHaveAttribute("data-state", "checked");
  await page.getByRole("menuitemradio", { name: "Light" }).click();
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  await page.reload();
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  await page.getByRole("button", { name: "Open admin account" }).click();
  await page.getByRole("menuitemradio", { name: "Dark" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.getByRole("menuitemradio", { name: "System" }).click();
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.goto("/missing-page");
  await expect(
    page.getByRole("heading", { name: "Page not found" }),
  ).toBeVisible();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await expect(page.getByRole("main")).toHaveCSS(
    "background-color",
    "rgb(21, 21, 21)",
  );
});

test("uses the system theme on the sign-in screen", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await expect(page.locator(".login-shell")).toHaveCSS(
    "background-color",
    "rgb(34, 34, 34)",
  );
  await expect(page.getByLabel("Admin phone number")).toHaveCSS(
    "color",
    "rgb(242, 241, 238)",
  );
});
