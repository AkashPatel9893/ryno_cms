import { expect, test } from "@playwright/test";

test("shows a useful 404 page for missing routes", async ({ page }) => {
  for (const path of ["/help", "/missing/nested"]) {
    await page.goto(path);
    await expect(
      page.getByRole("heading", { name: "Page not found" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Back to dashboard" }),
    ).toHaveAttribute("href", "/");
  }
});
