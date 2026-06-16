# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: auth.spec.ts >> Authentication flow >> redirects unauthenticated users to /auth/login
- Location: e2e\auth.spec.ts:6:7

# Error details

```
Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:3001/dashboard
Call log:
  - navigating to "http://localhost:3001/dashboard", waiting until "load"

```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
  4  | 
  5  | test.describe('Authentication flow', () => {
  6  |   test('redirects unauthenticated users to /auth/login', async ({ page }) => {
> 7  |     await page.goto(`${BASE}/dashboard`);
     |                ^ Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:3001/dashboard
  8  |     await expect(page).toHaveURL(/\/auth\/login/);
  9  |   });
  10 | 
  11 |   test('login page renders key elements', async ({ page }) => {
  12 |     await page.goto(`${BASE}/auth/login`);
  13 |     await expect(page.getByRole('heading', { name: /bienvenido/i })).toBeVisible();
  14 |     await expect(page.locator('#email')).toBeVisible();
  15 |     await expect(page.locator('#password')).toBeVisible();
  16 |     await expect(page.getByRole('button', { name: /ingresar/i })).toBeVisible();
  17 |   });
  18 | 
  19 |   test('shows required field behaviour on empty submit', async ({ page }) => {
  20 |     await page.goto(`${BASE}/auth/login`);
  21 |     // HTML5 required prevents form submit — verify the submit button is present and email is required
  22 |     const emailInput = page.locator('#email');
  23 |     await expect(emailInput).toBeVisible();
  24 |     const required = await emailInput.getAttribute('required');
  25 |     expect(required).not.toBeNull();
  26 |   });
  27 | 
  28 |   test('shows error on invalid credentials', async ({ page }) => {
  29 |     await page.goto(`${BASE}/auth/login`);
  30 |     await page.locator('#email').fill('invalid@nonexistent.com');
  31 |     await page.locator('#password').fill('wrongpassword');
  32 |     await page.getByRole('button', { name: /ingresar/i }).click();
  33 |     await expect(page.getByRole('alert').first()).toBeVisible({ timeout: 8000 });
  34 |   });
  35 | 
  36 |   test('register page renders key elements', async ({ page }) => {
  37 |     await page.goto(`${BASE}/auth/register`);
  38 |     await expect(page.getByRole('heading', { name: /crear organización/i })).toBeVisible();
  39 |     await expect(page.locator('#orgName')).toBeVisible();
  40 |     await expect(page.getByRole('button', { name: /crear organización/i })).toBeVisible();
  41 |   });
  42 | });
  43 | 
```