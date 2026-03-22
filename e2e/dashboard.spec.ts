import { test, expect } from "@playwright/test";

/**
 * Dashboard E2E test.
 *
 * Clerk auth is required for /app. In CI or without a Clerk testing token,
 * the middleware redirects to /sign-in.
 *
 * This test uses Clerk's testing token approach:
 * Set CLERK_TESTING_TOKEN env var to bypass auth in test mode.
 * See: https://clerk.com/docs/testing/overview
 *
 * Without the token, the test validates the auth redirect flow instead.
 */

test.describe("Dashboard — authenticated", () => {
  const hasTestingToken = !!process.env["CLERK_TESTING_TOKEN"];

  test("shows dashboard or redirects to sign-in", async ({ page }) => {
    if (hasTestingToken) {
      // Inject Clerk testing token via cookie/header
      await page.goto(
        `/app?__clerk_testing_token=${process.env["CLERK_TESTING_TOKEN"]}`
      );

      // Verify dashboard renders
      await expect(page.getByRole("heading", { name: "Projects" })).toBeVisible();

      // Click "New project" → should navigate to /app/new
      const newProjectLink = page
        .getByRole("link", { name: /new project/i })
        .first();
      await expect(newProjectLink).toBeVisible();
      await newProjectLink.click();

      await page.waitForURL("**/app/new**");
      expect(page.url()).toContain("/app/new");

      // Verify the new project form is displayed
      await expect(
        page.getByRole("heading", { name: /nouveau projet/i })
      ).toBeVisible();
      await expect(page.getByLabel(/nom du projet/i)).toBeVisible();

      // Fill project name and submit
      await page.getByLabel(/nom du projet/i).fill("Test Project E2E");
      await page.getByRole("button", { name: /start building/i }).click();

      // Should redirect to /app/project/[id]
      await page.waitForURL("**/app/project/**", { timeout: 10000 });
      expect(page.url()).toMatch(/\/app\/project\/[\w-]+/);
    } else {
      // Without auth token, /app redirects to /sign-in
      await page.goto("/app");
      await page.waitForURL("**/sign-in**");
      expect(page.url()).toContain("/sign-in");
    }
  });
});
