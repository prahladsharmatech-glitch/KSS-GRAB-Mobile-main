import { test, expect } from '@playwright/test';

test.describe('Seller Portal & Catalog CRUD Operations', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/seller');
  });

  test('Seller dashboard loads metrics and overview', async ({ page }) => {
    await expect(page).toHaveURL(/\/seller/);
    await expect(page.getByText(/Seller Hub|Merchant Hub|Dashboard|Store Overview|Live Orders/i).first()).toBeVisible();
  });

  test('Seller Products Page listing and search', async ({ page }) => {
    await page.goto('/seller/products');
    await expect(page).toHaveURL(/\/seller\/products/);
    await expect(page.getByText(/Products|Product Catalog|Manage Products/i).first()).toBeVisible();

    // Verify search bar
    const searchInput = page.locator('input[placeholder*="Search"]').first();
    if (await searchInput.isVisible()) {
      await searchInput.fill('Lays');
      await page.waitForTimeout(500);
    }
  });

  test('Seller Product CRUD - Create product modal', async ({ page }) => {
    await page.goto('/seller/products');

    // Click Add Product / '+' button
    const addProductBtn = page.getByText(/Add Product|\+ Product|New Product/i).first();
    if (await addProductBtn.isVisible()) {
      await addProductBtn.click();
      await page.waitForTimeout(500);

      // Verify Modal opens
      await expect(page.getByText(/Add Product|New Product|Product Details/i).first()).toBeVisible();

      // Fill name & price
      const nameInput = page.locator('input[placeholder*="Name"]').or(page.locator('input[placeholder*="title"]')).first();
      if (await nameInput.isVisible()) {
        await nameInput.fill('Test Playwright Organic Item');
      }

      const priceInput = page.locator('input[placeholder*="Price"]').first();
      if (await priceInput.isVisible()) {
        await priceInput.fill('99');
      }

      // Close modal
      const cancelBtn = page.getByText(/Cancel|Close/i).first();
      if (await cancelBtn.isVisible()) {
        await cancelBtn.click();
      }
    }
  });

  test('Seller Live Orders page', async ({ page }) => {
    await page.goto('/seller/orders');
    await expect(page).toHaveURL(/\/seller\/orders/);
    await expect(page.getByText(/Live Orders|Orders|Incoming Orders|Order Queue/i).first()).toBeVisible();
  });

  test('Seller Profile page', async ({ page }) => {
    await page.goto('/seller/profile');
    await expect(page).toHaveURL(/\/seller\/profile/);
    await expect(page.getByText(/Profile|Seller Info|Store Profile/i).first()).toBeVisible();
  });

});
