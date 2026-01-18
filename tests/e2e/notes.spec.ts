import { test, expect } from '@playwright/test';

test.describe('Quick Notes', () => {
  test.beforeEach(async ({ page }) => {
    // Bypass disclaimer modal
    await page.addInitScript(() => {
        window.sessionStorage.setItem("aims_demo_agreed", "true");
    });

    // Login before each test
    await page.goto('/login');

    // Try demo button first
    const demoButton = page.getByRole('button', { name: '🩺 Doctor' });
    const quickSkipButton = page.getByRole('button', { name: 'Quick Skip' });

    if (await demoButton.isVisible()) {
        await demoButton.click();
    } else if (await quickSkipButton.isVisible()) {
        await quickSkipButton.click();
    } else {
        // Fallback to credential login
        await page.fill('input[name="username"]', 'doctor');
        await page.fill('input[name="password"]', 'doctor123');
        const loginBtn = page.locator('button[type="submit"]');
        await loginBtn.click();
    }

    await expect(page).toHaveURL('/dashboard');
  });

  test('should create a quick note', async ({ page }) => {
    await page.goto('/quick-notes');

    // Fill note title and content
    const timestamp = Date.now();
    await page.fill('input#noteTitle', `Test Note ${timestamp}`);
    await page.fill('textarea', 'This is a test note content.');

    // Save note
    await page.getByRole('button', { name: 'Save Note' }).click();

    // Expect success toast
    // Use .first() to handle strict mode violation if multiple "Success" texts exist
    await expect(page.getByText('Success').first()).toBeVisible();
    await expect(page.getByText('Quick note saved successfully').first()).toBeVisible();
  });
});
