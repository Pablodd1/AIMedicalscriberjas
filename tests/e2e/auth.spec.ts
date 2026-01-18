import { test, expect } from '@playwright/test';

async function login(page: any) {
  page.on('console', (msg: any) => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', (err: any) => console.log('PAGE ERROR:', err.message));

  // Ensure default users exist
  await page.request.post('/api/setup');

  // Bypass disclaimer modal
  await page.addInitScript(() => {
    window.sessionStorage.setItem("aims_demo_agreed", "true");
  });

  await page.goto('/login');

  // Try demo button first
  const demoButton = page.getByRole('button', { name: '🩺 Doctor' });
  const quickSkipButton = page.getByRole('button', { name: 'Quick Skip' });

  if (await demoButton.isVisible()) {
      await demoButton.click();
  } else if (await quickSkipButton.isVisible()) {
      await quickSkipButton.click();
  } else {
      console.log('Using credential login...');
      // Fallback to credential login
      await page.fill('input[name="username"]', 'doctor');
      await page.fill('input[name="password"]', 'doctor123');

      // Wait for button to be enabled
      const loginBtn = page.locator('button[type="submit"]');
      await expect(loginBtn).toBeVisible();
      await loginBtn.click();
  }

  await expect(page).toHaveURL('/dashboard');
}

test.describe('Authentication Flow', () => {
  test('should allow user to login', async ({ page }) => {
    await login(page);
    await expect(page.getByText('Welcome back')).toBeVisible();
  });

  test('should allow user to logout', async ({ page }) => {
    await login(page);

    // Find logout button (usually in sidebar or header)
    await page.getByRole('button', { name: 'Logout' }).click();

    // Should redirect back to landing page or login page
    // Based on previous failure it was http://localhost:5000/
    await expect(page).toHaveURL(/(\/login|\/$)/);
  });
});
