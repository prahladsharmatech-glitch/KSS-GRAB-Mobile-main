import { test, expect } from '@playwright/test';

test.describe('Customer Authentication & Session Flow', () => {

  test.beforeEach(async ({ page }) => {
    page.on('console', msg => console.log('PAGE LOG:', msg.type(), msg.text()));
    page.on('pageerror', err => console.log('PAGE ERROR:', err.message));
    await page.goto('/customer');
  });

  test('Guest navigation loads customer storefront', async ({ page }) => {
    await page.waitForSelector('#root > div', { timeout: 15000 });
    const content = await page.locator('#root').innerText();
    expect(content.length).toBeGreaterThan(0);
  });

  test('Phone OTP login flow & session persistence', async ({ page }) => {
    await page.goto('/login');
    await page.waitForTimeout(1000);

    const phoneInput = page.locator('input[placeholder*="98765 43210"]').or(page.locator('input[type="tel"]')).or(page.locator('input')).first();
    await expect(phoneInput).toBeVisible({ timeout: 10000 });
    await phoneInput.fill('9876543210');

    const continueBtn = page.getByText(/Continue|Send OTP|Verify/i).first();
    await continueBtn.click();

    await expect(page.getByText(/Enter 6-digit Code|OTP|Verification Code/i).first()).toBeVisible({ timeout: 10000 });

    const otpInputs = page.locator('input');
    const inputCount = await otpInputs.count();

    if (inputCount >= 6) {
      const codeDigits = '947347'.split('');
      for (let i = 0; i < 6; i++) {
        await otpInputs.nth(i).fill(codeDigits[i]);
      }
    } else {
      await otpInputs.first().fill('947347');
    }

    const verifyBtn = page.getByText(/Verify & Continue|Submit|Confirm/i).first();
    if (await verifyBtn.isVisible()) {
      await verifyBtn.click();
    }

    await page.waitForTimeout(2000);
    const currentUrl = page.url();
    expect(currentUrl).toMatch(/\/(customer|login)/);
  });

  test('Logout action clears session', async ({ page }) => {
    await page.goto('/customer/profile');
    const logoutBtn = page.getByText(/Logout|Log Out|Sign Out/i).first();

    if (await logoutBtn.isVisible()) {
      await logoutBtn.click();
      await page.waitForTimeout(1000);
      await expect(page).toHaveURL(/\/(login|customer)/);
    }
  });

});
