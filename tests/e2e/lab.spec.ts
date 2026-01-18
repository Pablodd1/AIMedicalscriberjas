import { test, expect } from '@playwright/test';

test.describe('Lab Interpreter', () => {
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

  test('should navigate to lab interpreter', async ({ page }) => {
    // Click on "Lab Interpreter" in sidebar or navigate directly
    await page.goto('/lab-interpreter');
    await expect(page.locator('h1')).toContainText('Lab Interpreter');
  });

  test('should show upload area', async ({ page }) => {
    await page.goto('/lab-interpreter');

    // Click Upload Report to open dialog
    await page.getByRole('button', { name: 'Upload Report' }).click();

    // Check for upload area text inside dialog
    await expect(page.getByText('Click to upload or drag and drop')).toBeVisible();
    await expect(page.getByText('PDF or Image files')).toBeVisible();
  });
});
