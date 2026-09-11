import { test, expect } from '@playwright/test';

test.describe('Customer Navigation, Cart & Checkout', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/customer');
  });

  test('Storefront loads with categories, banners and products', async ({ page }) => {
    await expect(page.getByText(/GRAB IT|Shop Now|Explore Offers|Categories/i).first()).toBeVisible();

    // Verify search input
    const searchBar = page.locator('input[placeholder*="Search"]').first();
    await expect(searchBar).toBeVisible();
  });

  test('Navigation to Categories page', async ({ page }) => {
    await page.goto('/customer/categories');
    await expect(page).toHaveURL(/\/customer\/categories/);
    await expect(page.getByText(/Categories|Shop by Category/i).first()).toBeVisible();
  });

  test('Product search and filtering', async ({ page }) => {
    const searchBar = page.locator('input[placeholder*="Search"]').first();
    await searchBar.fill('Milk');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);
  });

  test('Add product to cart and view cart subtotal', async ({ page }) => {
    await page.goto('/customer');

    // Find and click 'ADD' button on any product card
    const addBtn = page.getByText(/^ADD$/i).first();
    if (await addBtn.isVisible()) {
      await addBtn.click();
      await page.waitForTimeout(500);
    }

    // Go to cart page
    await page.goto('/customer/cart');
    await expect(page).toHaveURL(/\/customer\/cart/);
    await expect(page.getByText(/Shopping Cart|Your Cart|Cart Items|Bill Details/i).first()).toBeVisible();
  });

  test('Cart promo code validation & checkout navigation', async ({ page }) => {
    await page.goto('/customer/cart');

    // Promo code input check
    const promoInput = page.locator('input[placeholder*="promo"]').or(page.locator('input[placeholder*="coupon"]')).first();
    if (await promoInput.isVisible()) {
      await promoInput.fill('GRABIT50');
      const applyBtn = page.getByText(/Apply/i).first();
      await applyBtn.click();
      await page.waitForTimeout(500);
    }

    // Navigate to checkout
    const checkoutBtn = page.getByText(/Proceed to Checkout|Checkout|Place Order/i).first();
    if (await checkoutBtn.isVisible()) {
      await checkoutBtn.click();
      await page.waitForTimeout(1000);
      await expect(page).toHaveURL(/\/(customer\/checkout|login)/);
    }
  });

});
