import { chromium } from '../frontend/node_modules/playwright/index.mjs';
import { mkdirSync } from 'fs';
import { join } from 'path';

const BASE = 'http://localhost:3001';
const API  = 'http://localhost:3021/api/v1';
const SS_DIR = 'D:\\estrategia\\scripts\\screenshots';
try { mkdirSync(SS_DIR, { recursive: true }); } catch {}

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
  return { name: name?.trim(), value: value?.trim() ?? '', domain: 'localhost', path: '/', httpOnly, sameSite: 'Lax' };
}).filter(c => c.name && c.value);

console.log('Login API:', loginRes.status);

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addCookies(cookies);
const page = await ctx.newPage();

const go = async (path, file, timeoutMs = 120000) => {
  process.stdout.write(`${path} ... `);
  const t0 = Date.now();
  try { await page.goto(BASE + path, { waitUntil: 'load', timeout: timeoutMs }); }
  catch { process.stdout.write(`[timeout] `); }
  await page.waitForTimeout(3000);
  await page.screenshot({ path: join(SS_DIR, file), fullPage: true, animations: 'disabled', timeout: 10000 }).catch(async () => {
    // fallback: viewport-only si fullPage cuelga
    await page.screenshot({ path: join(SS_DIR, file), fullPage: false, animations: 'disabled', timeout: 8000 }).catch(() => {
      console.log('[screenshot fallido]');
    });
  });
  console.log(`${page.url()} (${Math.round((Date.now()-t0)/1000)}s)`);
};

// Páginas en orden de compilación — cada una registra la siguiente en caché de Turbopack
await go('/welcome',     'A-welcome.png');
await go('/my-okrs',     'B-my-okrs.png');
await go('/strategic',   'C-strategic.png');
await go('/reports',     'D-reports.png');
await go('/traceability','E-traceability.png');

await browser.close();
console.log('\nScreenshots listos en:', SS_DIR);
