import { test, expect } from '@playwright/test';

test.describe('Role-Based Access & Portal Routing', () => {

  test('Access Customer portal', async ({ page }) => {
    await page.goto('/customer');
    await expect(page).toHaveURL(/\/customer/);
    await expect(page.getByText(/Home|Categories|Trending|Profile/i).first()).toBeVisible();
  });

  test('Access Seller hub portal', async ({ page }) => {
    await page.goto('/seller');
    await expect(page).toHaveURL(/\/seller/);
    await expect(page.getByText(/Dashboard|Categories|Products|Live Orders|Profile/i).first()).toBeVisible();
  });

  test('Access Rider delivery portal', async ({ page }) => {
    await page.goto('/rider');
    await expect(page).toHaveURL(/\/rider/);
    await expect(page.getByText(/Dashboard|Active Order|Attendance|History|Profile/i).first()).toBeVisible();
  });

  test('Access Super Admin portal', async ({ page }) => {
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/admin/);
    await expect(page.getByText(/Admin|Users|Orders|Partners|Catalog/i).first()).toBeVisible();
  });

});
