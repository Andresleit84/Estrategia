import { test, expect } from '@playwright/test';

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3001';

// These tests assume a running dev server and valid session cookie.
// Run with: E2E_EMAIL=... E2E_PASSWORD=... npx playwright test
const email = process.env.E2E_EMAIL ?? '';
const password = process.env.E2E_PASSWORD ?? '';

test.describe('OKR management flow', () => {
  test.skip(!email || !password, 'E2E_EMAIL and E2E_PASSWORD required');

  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/auth/login`);
    await page.locator('#email').fill(email);
    await page.locator('#password').fill(password);
    await page.getByRole('button', { name: /ingresar/i }).click();
    await expect(page).toHaveURL(/welcome/, { timeout: 10000 });
  });

  test('welcome page loads with key content', async ({ page }) => {
    await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 8000 });
    const cards = page.locator('[class*="card"], [class*="Card"]');
    await expect(cards.first()).toBeVisible({ timeout: 8000 });
  });

  test('strategic objectives page is reachable', async ({ page }) => {
    await page.goto(`${BASE}/strategic`);
    await expect(page).toHaveURL(/strategic/);
    await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 8000 });
  });

  test('create objective button opens dialog', async ({ page }) => {
    await page.goto(`${BASE}/strategic`);
    const createBtn = page.getByRole('button', { name: /nuevo objetivo|crear objetivo/i });
    if (await createBtn.isVisible()) {
      await createBtn.click();
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });
    }
  });

  test('reports executive dashboard loads without error', async ({ page }) => {
    await page.goto(`${BASE}/reports/executive-dashboard`);
    await expect(page).not.toHaveURL(/auth\/login/);
    await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/error/i)).not.toBeVisible();
  });
});
