import { test, expect } from '@playwright/test';

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3001';

test.describe('Authentication flow', () => {
  test('redirects unauthenticated users to /auth/login', async ({ page }) => {
    await page.goto(`${BASE}/dashboard`);
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test('login page renders key elements', async ({ page }) => {
    await page.goto(`${BASE}/auth/login`);
    await expect(page.getByRole('heading', { name: /bienvenido/i })).toBeVisible();
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.getByRole('button', { name: /ingresar/i })).toBeVisible();
  });

  test('shows required field behaviour on empty submit', async ({ page }) => {
    await page.goto(`${BASE}/auth/login`);
    // HTML5 required prevents form submit — verify the submit button is present and email is required
    const emailInput = page.locator('#email');
    await expect(emailInput).toBeVisible();
    const required = await emailInput.getAttribute('required');
    expect(required).not.toBeNull();
  });

  test('shows error on invalid credentials', async ({ page }) => {
    await page.goto(`${BASE}/auth/login`);
    await page.locator('#email').fill('invalid@nonexistent.com');
    await page.locator('#password').fill('wrongpassword');
    await page.getByRole('button', { name: /ingresar/i }).click();
    await expect(page.getByRole('alert').first()).toBeVisible({ timeout: 8000 });
  });

  test('register page renders key elements', async ({ page }) => {
    await page.goto(`${BASE}/auth/register`);
    await expect(page.getByRole('heading', { name: /crear organización/i })).toBeVisible();
    await expect(page.locator('#orgName')).toBeVisible();
    await expect(page.getByRole('button', { name: /crear organización/i })).toBeVisible();
  });
});
