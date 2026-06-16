import { chromium } from '../frontend/node_modules/playwright/index.mjs';
import { mkdirSync } from 'fs';
import { join } from 'path';

const BASE = 'http://localhost:3001';
const API  = 'http://localhost:3021/api/v1';
const SS_DIR = 'D:\\estrategia\\scripts\\screenshots';
try { mkdirSync(SS_DIR, { recursive: true }); } catch {}

// Login via API, inject cookies
const loginRes = await fetch(`${API}/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'maria.gonzalez@demo.com', password: 'Demo2026#' }),
});
const setCookie = loginRes.headers.get('set-cookie') ?? '';
const cookies = setCookie.split(/,(?=[^;]+ *=)/).map(c => {
  const [nameVal, ...attrs] = c.trim().split(';');
  const [name, value] = nameVal.trim().split('=');
  const httpOnly = attrs.some(a => a.trim().toLowerCase() === 'httponly');
  return { name: name.trim(), value: value?.trim() ?? '', domain: 'localhost', path: '/', httpOnly, sameSite: 'Lax' };
}).filter(c => c.name && c.value);
console.log('Login:', loginRes.status, '| cookies:', cookies.map(c => c.name).join(', '));

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addCookies(cookies);
const page = await ctx.newPage();

const go = async (path, file, timeout = 90000) => {
  console.log(`Navegando a ${path}...`);
  try {
    await page.goto(BASE + path, { waitUntil: 'load', timeout });
  } catch (e) {
    console.log(`  TIMEOUT/ERROR en ${path}: ${e.message.slice(0, 80)}`);
  }
  await page.waitForTimeout(3000);
  await page.screenshot({ path: join(SS_DIR, file), fullPage: true });
  console.log(`  → ${page.url()}`);
};

await go('/welcome',      '04-welcome-data.png');
await go('/my-okrs',      '07-my-okrs.png', 90000);
await go('/strategic',    '05-strategic-v2.png');

await browser.close();
console.log('Listo.');
