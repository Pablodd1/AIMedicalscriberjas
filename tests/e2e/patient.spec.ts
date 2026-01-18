import { test, expect } from '@playwright/test';

test.describe('Patient Management', () => {
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

  test('should navigate to patients list', async ({ page }) => {
    await page.goto('/patients');
    await expect(page.locator('h1')).toContainText('Patients');
  });

  test('should be able to create a new patient', async ({ page }) => {
    await page.goto('/patients');

    // Click "Add Patient" button
    await page.getByRole('button', { name: 'Add Patient' }).click();

    // Fill form
    await page.fill('input[name="firstName"]', 'John');
    await page.fill('input[name="lastName"]', 'Doe_Test');
    await page.fill('input[name="email"]', `john.doe.${Date.now()}@example.com`);
    await page.fill('input[name="phone"]', '555-0123');

    // Submit
    await page.getByRole('button', { name: 'Create Patient' }).click();

    // Verify success message or redirection
    // Usually it closes the modal and refreshes the list
    // Or redirects to patient details

    // We expect to see the new patient in the list or filtered
    await expect(page.getByText('John Doe_Test').first()).toBeVisible();
  });
});
