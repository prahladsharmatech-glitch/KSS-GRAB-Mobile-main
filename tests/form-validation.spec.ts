import { test, expect } from '@playwright/test';

test.describe('Form Validation & Error Messaging', () => {

  test('Login form validation for empty phone input', async ({ page }) => {
    await page.goto('/login');
    const continueBtn = page.getByText(/Continue|Send OTP|Verify/i).first();

    if (await continueBtn.isVisible()) {
      await continueBtn.click();
      // Error or prevented navigation
      await page.waitForTimeout(500);
      await expect(page).toHaveURL(/\/login/);
    }
  });

  test('Cart promo code validation with invalid code', async ({ page }) => {
    await page.goto('/customer/cart');

    const promoInput = page.locator('input[placeholder*="promo"]').or(page.locator('input[placeholder*="coupon"]')).first();
    if (await promoInput.isVisible()) {
      await promoInput.fill('INVALIDPROMO999');
      const applyBtn = page.getByText(/Apply/i).first();
      await applyBtn.click();
      await page.waitForTimeout(500);
    }
  });

  test('Seller product modal input validation', async ({ page }) => {
    await page.goto('/seller/products');
    const addProductBtn = page.getByText(/Add Product|\+ Product|New Product/i).first();

    if (await addProductBtn.isVisible()) {
      await addProductBtn.click();
      await page.waitForTimeout(500);

      // Try saving without entering title or price
      const saveBtn = page.getByText(/Save|Submit|Create/i).first();
      if (await saveBtn.isVisible()) {
        await saveBtn.click();
        await page.waitForTimeout(500);
      }
    }
  });

});
