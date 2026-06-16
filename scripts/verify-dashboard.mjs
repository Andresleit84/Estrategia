import { chromium } from '../frontend/node_modules/playwright/index.mjs';
import { mkdirSync } from 'fs';
import { join } from 'path';

const BASE = 'http://localhost:3001';
const SS_DIR = 'D:\\estrategia\\scripts\\screenshots';
try { mkdirSync(SS_DIR, { recursive: true }); } catch {}
const ss = (name) => join(SS_DIR, `${name}.png`);

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

const errors = [];
page.on('pageerror', e => errors.push(e.message));

// 1. Login
console.log('1. Abriendo login...');
await page.goto(BASE + '/auth/login', { waitUntil: 'networkidle', timeout: 30000 });
await page.screenshot({ path: ss('01-login') });

await page.fill('input[type="email"]', 'maria.gonzalez@demo.com');
await page.fill('input[type="password"]', 'Demo2026#');
await page.screenshot({ path: ss('02-login-filled') });

await page.click('button[type="submit"]');
await page.waitForURL(url => !url.toString().includes('/login'), { timeout: 20000 });
await page.waitForLoadState('networkidle', { timeout: 20000 });
console.log('   Autenticado. URL:', page.url());
await page.screenshot({ path: ss('03-post-login'), fullPage: true });

const go = async (path, label, file) => {
  console.log(`  → ${label}`);
  try {
    await page.goto(BASE + path, { waitUntil: 'load', timeout: 30000 });
  } catch (e) {
    console.log('    TIMEOUT/ERROR — tomando screenshot de lo que hay');
  }
  await page.waitForTimeout(2500);
  await page.screenshot({ path: ss(file), fullPage: true });
  console.log('    URL:', page.url());
};

await go('/welcome',   '2. Welcome / Inicio',          '04-welcome');
await go('/strategic', '3. OKRs estratégicos',          '05-strategic');
await go('/reports',   '4. Reports / Executive',        '06-reports');
await go('/my-okrs',   '5. Mis OKRs',                   '07-my-okrs');
await go('/traceability', '6. Trazabilidad',             '08-traceability');

if (errors.length > 0) {
  console.log('\n⚠ Errores JS:');
  errors.slice(0, 5).forEach(e => console.log('  -', e.slice(0, 250)));
} else {
  console.log('\n✅ Sin errores JS en browser');
}

await browser.close();
console.log('Screenshots guardados en:', SS_DIR);
