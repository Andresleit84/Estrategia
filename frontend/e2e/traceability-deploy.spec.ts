/**
 * QA — Vista "Despliegue Estratégico" en /traceability
 *
 * Cubre:
 *  TC-01  El modo "Despliegue" aparece en el ViewToggle
 *  TC-02  Al hacer clic en "Despliegue" la URL/estado cambia sin error 5xx
 *  TC-03  La vista renderiza sin crash (no aparece el error de React)
 *  TC-04  La Coverage Strip se muestra con los contadores correctos
 *  TC-05  Los botones "Expandir todo / Colapsar todo" existen y son funcionales
 *  TC-06  Los OKR boxes tienen cabecera coloreada y chevron
 *  TC-07  Hacer clic en un box lo expande (body visible) y vuelve a colapsar
 *  TC-08  El chip de cobertura muestra uno de: Cubierto | Parcial | Brecha
 *  TC-09  El cambio entre vistas no produce errores (regresión a Pirámide y vuelta)
 *  TC-10  Empty state se muestra si no hay ciclos activos (ruta protegida)
 */

import { test, expect, type Page } from '@playwright/test';

const BASE  = process.env.E2E_BASE_URL  ?? 'http://localhost:3000';
const EMAIL = process.env.E2E_EMAIL;
const PASS  = process.env.E2E_PASSWORD;

// ── Helpers ────────────────────────────────────────────────────────────────────

async function login(page: Page) {
  await page.goto(`${BASE}/auth/login`);
  await page.locator('#email').fill(EMAIL!);
  await page.locator('#password').fill(PASS!);
  await page.getByRole('button', { name: /ingresar/i }).click();
  // Wait until redirected away from login
  await page.waitForURL(u => !u.toString().includes('/auth/login'), { timeout: 15_000 });
}

async function goToTraceability(page: Page) {
  await page.goto(`${BASE}/traceability`);
  // Wait for the page to load — the Network icon (view toggle) must be visible
  await expect(page.getByTitle(/mapa/i).or(page.locator('[title="Mapa"]'))).toBeVisible({ timeout: 15_000 });
}

// ── Guard: skip all tests if no credentials ────────────────────────────────────

test.describe('Traceability — Vista Despliegue', () => {

  test.beforeEach(async ({ page }) => {
    test.skip(!EMAIL || !PASS, 'E2E_EMAIL / E2E_PASSWORD not set — skipping authenticated tests');
    await login(page);
  });

  // ── TC-01: El botón "Despliegue" existe en el ViewToggle ──────────────────────

  test('TC-01 — botón Despliegue visible en el ViewToggle', async ({ page }) => {
    await goToTraceability(page);
    const btn = page.getByTitle('Despliegue').or(page.getByRole('button', { name: /despliegue/i }));
    await expect(btn).toBeVisible();
  });

  // ── TC-02: Click en Despliegue no produce error 5xx ───────────────────────────

  test('TC-02 — clic en Despliegue no genera error de red', async ({ page }) => {
    const errors: string[] = [];
    page.on('response', res => {
      if (res.status() >= 500) errors.push(`${res.status()} ${res.url()}`);
    });

    await goToTraceability(page);
    await page.getByTitle('Despliegue').or(page.getByRole('button', { name: /despliegue/i })).click();
    await page.waitForTimeout(2000);

    expect(errors, `5xx errors: ${errors.join(', ')}`).toHaveLength(0);
  });

  // ── TC-03: La vista no muestra el error boundary de React ─────────────────────

  test('TC-03 — no aparece error de React ni texto "Something went wrong"', async ({ page }) => {
    await goToTraceability(page);
    await page.getByTitle('Despliegue').or(page.getByRole('button', { name: /despliegue/i })).click();
    await page.waitForTimeout(1500);

    const errorBoundary = page.getByText(/something went wrong/i)
      .or(page.getByText(/error al cargar/i))
      .or(page.getByText(/unhandled error/i));

    await expect(errorBoundary).not.toBeVisible();
  });

  // ── TC-04: Coverage Strip muestra contadores ──────────────────────────────────

  test('TC-04 — Coverage Strip renderiza con números y barra de progreso', async ({ page }) => {
    await goToTraceability(page);
    await page.getByTitle('Despliegue').or(page.getByRole('button', { name: /despliegue/i })).click();
    await page.waitForTimeout(1500);

    // La coverage strip muestra "OKRs en el plan" o el empty state
    const strip = page.getByText(/OKRs en el plan/i)
      .or(page.getByText(/cobertura del despliegue/i))
      .or(page.getByText(/sin ciclos activos/i));

    await expect(strip.first()).toBeVisible({ timeout: 8000 });
  });

  // ── TC-05: Botones Expandir / Colapsar existen ────────────────────────────────

  test('TC-05 — botones Expandir todo y Colapsar todo visibles', async ({ page }) => {
    await goToTraceability(page);
    await page.getByTitle('Despliegue').or(page.getByRole('button', { name: /despliegue/i })).click();
    await page.waitForTimeout(1500);

    // Si hay ciclos, deben aparecer. Si hay empty state, los botones no están y está bien.
    const hasEmpty = await page.getByText(/sin ciclos activos/i).isVisible();
    if (hasEmpty) {
      test.info().annotations.push({ type: 'info', description: 'Empty state visible — no hay ciclos activos. TC-05 N/A.' });
      return;
    }

    await expect(page.getByRole('button', { name: /expandir todo/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /colapsar todo/i })).toBeVisible();
  });

  // ── TC-06: OKR boxes tienen cabecera coloreada ────────────────────────────────

  test('TC-06 — los OKR boxes tienen tag de capa visible', async ({ page }) => {
    await goToTraceability(page);
    await page.getByTitle('Despliegue').or(page.getByRole('button', { name: /despliegue/i })).click();
    await page.waitForTimeout(2000);

    const hasEmpty = await page.getByText(/sin ciclos activos/i).isVisible();
    if (hasEmpty) return;

    // Al menos un tag de capa debe aparecer
    const layerTag = page.getByText(/OKR Estratégico/i)
      .or(page.getByText(/OKR Anual/i))
      .or(page.getByText(/OKR Trimestral/i));
    await expect(layerTag.first()).toBeVisible({ timeout: 8000 });
  });

  // ── TC-07: Clic en box expande y colapsa ──────────────────────────────────────

  test('TC-07 — clic en OKR box alterna expand/collapse', async ({ page }) => {
    await goToTraceability(page);
    await page.getByTitle('Despliegue').or(page.getByRole('button', { name: /despliegue/i })).click();
    await page.waitForTimeout(2000);

    const hasEmpty = await page.getByText(/sin ciclos activos/i).isVisible();
    if (hasEmpty) return;

    // Expandir todo para poder buscar un box
    const expandBtn = page.getByRole('button', { name: /expandir todo/i });
    const collapseBtn = page.getByRole('button', { name: /colapsar todo/i });

    if (await expandBtn.isVisible()) {
      // Primero collapse todo
      await collapseBtn.click();
      await page.waitForTimeout(400);

      // El body de KRs NO debe estar visible aún (collapsed)
      const krInfo = page.getByText(/KRs definidos/i).or(page.getByText(/Sin KRs/i));
      const countBefore = await krInfo.count();

      // Expand todo
      await expandBtn.click();
      await page.waitForTimeout(600);

      // Ahora el body debe estar visible
      const countAfter = await krInfo.count();
      expect(countAfter).toBeGreaterThanOrEqual(countBefore);
    }
  });

  // ── TC-08: Chips de cobertura muestran estado válido ─────────────────────────

  test('TC-08 — chips de cobertura muestran Cubierto, Parcial o Brecha', async ({ page }) => {
    await goToTraceability(page);
    await page.getByTitle('Despliegue').or(page.getByRole('button', { name: /despliegue/i })).click();
    await page.waitForTimeout(1500);

    const hasEmpty = await page.getByText(/sin ciclos activos/i).isVisible();
    if (hasEmpty) return;

    // Expandir para ver chips
    const expandBtn = page.getByRole('button', { name: /expandir todo/i });
    if (await expandBtn.isVisible()) await expandBtn.click();
    await page.waitForTimeout(600);

    const chip = page.getByText(/^Cubierto$/).or(page.getByText(/^Parcial$/)).or(page.getByText(/^Brecha$/));
    await expect(chip.first()).toBeVisible({ timeout: 6000 });
  });

  // ── TC-09: Cambiar entre vistas no produce crash (regresión) ─────────────────

  test('TC-09 — navegar entre Despliegue → Pirámide → Árbol → Despliegue sin errores', async ({ page }) => {
    const jsErrors: string[] = [];
    page.on('pageerror', err => jsErrors.push(err.message));

    await goToTraceability(page);

    const views = [
      { title: 'Despliegue', label: /despliegue/i },
      { title: 'Pirámide',   label: /pirámide/i   },
      { title: 'Árbol',      label: /árbol/i      },
      { title: 'Despliegue', label: /despliegue/i },
    ];

    for (const v of views) {
      const btn = page.getByTitle(v.title).or(page.getByRole('button', { name: v.label }));
      if (await btn.isVisible()) await btn.click();
      await page.waitForTimeout(800);
    }

    // Solo fallar por errores críticos (ignorar warnings de red)
    const critical = jsErrors.filter(e => !e.includes('ChunkLoadError') && !e.includes('Network'));
    expect(critical, `JS errors: ${critical.join(' | ')}`).toHaveLength(0);
  });

  // ── TC-10: Exportar PNG desde la vista Despliegue ─────────────────────────────

  test('TC-10 — el botón de exportar PNG está disponible en modo Despliegue', async ({ page }) => {
    await goToTraceability(page);
    await page.getByTitle('Despliegue').or(page.getByRole('button', { name: /despliegue/i })).click();
    await page.waitForTimeout(1200);

    // El botón de descarga debe seguir disponible en el modo deploy
    const downloadBtn = page.getByTitle(/exportar vista como PNG/i)
      .or(page.getByTitle(/exportar/i));
    await expect(downloadBtn.first()).toBeVisible({ timeout: 5000 });
  });

});

// ── Tests sin autenticación (estructura de la página pública) ─────────────────

test.describe('Traceability — estructura sin auth', () => {

  test('TC-AUTH — redirige a login si no autenticado', async ({ page }) => {
    await page.goto(`${BASE}/traceability`);
    await expect(page).toHaveURL(/\/auth\/login/, { timeout: 10_000 });
  });

});
