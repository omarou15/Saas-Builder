import { test, expect } from "@playwright/test";

/**
 * Workspace E2E test.
 *
 * Requires Clerk auth + a valid project ID.
 * Set CLERK_TESTING_TOKEN and TEST_PROJECT_ID env vars.
 *
 * Without these, the test validates the auth redirect flow.
 */

test.describe("Workspace — project view", () => {
  const hasTestingToken = !!process.env["CLERK_TESTING_TOKEN"];
  const projectId = process.env["TEST_PROJECT_ID"];

  test("shows workspace panels or redirects to sign-in", async ({ page }) => {
    if (hasTestingToken && projectId) {
      await page.goto(
        `/app/project/${projectId}?__clerk_testing_token=${process.env["CLERK_TESTING_TOKEN"]}`
      );

      // Verify workspace header shows the project name
      const header = page.locator("header");
      await expect(header).toBeVisible();

      // Chat panel should be visible (contains message input area)
      const chatPanel = page.getByText(/message|chat|conversation/i).first();
      await expect(chatPanel).toBeVisible({ timeout: 10000 });

      // Preview panel should be visible (iframe or preview container)
      const previewPanel = page.locator(
        '[data-testid="preview-panel"], iframe, [class*="preview"]'
      );
      await expect(previewPanel.first()).toBeVisible({ timeout: 10000 });

      // Header should display project name (h1 in header)
      const projectName = page.locator("header h1");
      await expect(projectName).toBeVisible();
      await expect(projectName).not.toBeEmpty();

      // Deploy button should be present
      await expect(
        page.getByRole("button", { name: /deploy/i })
      ).toBeVisible();
    } else {
      // Without auth, should redirect to sign-in
      await page.goto("/app/project/test-id");
      await page.waitForURL("**/sign-in**");
      expect(page.url()).toContain("/sign-in");
    }
  });
});
