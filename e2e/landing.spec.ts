import { test, expect } from "@playwright/test";

test.describe("Landing page — first visit", () => {
  test("displays headline and redirects to sign-up on CTA click", async ({
    page,
  }) => {
    // 1. Navigate to landing
    await page.goto("/");

    // 2. Verify main headline is visible
    await expect(page.getByText("Build it.")).toBeVisible();
    await expect(page.getByText("Own it.")).toBeVisible();

    // 3. Click "Start building" CTA → should redirect to /sign-up
    const ctaLink = page.getByRole("link", { name: /start building/i }).first();
    await expect(ctaLink).toBeVisible();
    await ctaLink.click();

    await page.waitForURL("**/sign-up**");
    expect(page.url()).toContain("/sign-up");
  });
});
