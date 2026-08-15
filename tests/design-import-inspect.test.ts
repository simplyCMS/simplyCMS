/**
 * Смок `inspect.mjs` у headless chromium (Фаза 2, задача §2.A/E.2, план Р3).
 *
 * Детект наявності браузера — TOP-LEVEL AWAIT + реальний launch-probe (НЕ
 * async-функція всередині `skipIf` — Promise там truthy і давав би вічний
 * skip, TS цього не зловить). У GitHub Actions (без встановленого Chromium)
 * describe чесно скіпається з причиною в назві; у цьому середовищі —
 * `PLAYWRIGHT_BROWSERS_PATH`-фолбек (`lib/browser.mjs`, Р2) резолвить
 * chromium-1194, і смок ганяється насправді.
 *
 * Друга частина файлу (контракт мапінгу) — БЕЗ browserAvailable-гейту: вона
 * має лишатись зеленою незалежно від того, чи доступний chromium (задача
 * §2, Фаза 2 Step 3 — «контракт між скриптами незалежно від skipIf»).
 */
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from '@playwright/test';
import { afterAll, describe, expect, it } from 'vitest';
import { resolveChromium } from '../scripts/design-import/lib/browser.mjs';
import { inspectPage } from '../scripts/design-import/inspect.mjs';
import { mapTokens } from '../scripts/design-import/lib/map.mjs';
import { sampleInspection } from './fixtures/design-import/inspection.fixture.mjs';

// `inspect.mjs` — чистий .mjs без JSDoc-типів на кожне поле (канон ≤150
// рядків не лишає на це місця), тож TS інферить `any`-ланцюжок від
// `Page.evaluate`; локальний тип-каст ТІЛЬКИ для того, що реально читає тест.
interface InspectionResult {
  colors: Array<{ value: string; role: string }>;
  fonts: {
    heading: { family: string; sizePx: number } | null;
    body: { family: string } | null;
  };
  radius: Array<{ valuePx: number }>;
  fontStylesheets: string[];
}

let browser: import('@playwright/test').Browser | null = null;
let skipReason = '';
try {
  const launchOptions = resolveChromium(chromium);
  browser = await chromium.launch({ headless: true, ...launchOptions });
} catch (error) {
  skipReason = error instanceof Error ? error.message : String(error);
}

afterAll(async () => {
  await browser?.close();
});

describe('lib/map.mjs — контракт mapTokens незалежно від наявності браузера (Step 3)', () => {
  it('mapTokens(sampleInspection) — валідна пропозиція без chromium', () => {
    const proposal = mapTokens(sampleInspection);
    expect(proposal.schemaVersion).toBe(1);
    expect(proposal.tokens.background).toBeDefined();
    expect(proposal.tokens.primary).toBeDefined();
    expect(proposal.tokens['font-sans']).toBeDefined();
  });
});

describe.skipIf(!browser)(
  browser
    ? 'inspect.mjs — смок у headless chromium'
    : `inspect.mjs — SKIP: ${skipReason}`,
  () => {
    it('скріншоти + inspection.json відповідають фікстурі reference.html', async () => {
      const fixtureHtml = readFileSync(
        join(process.cwd(), 'tests/fixtures/design-import/reference.html'),
        'utf8',
      );
      const outDir = mkdtempSync(join(tmpdir(), 'design-import-'));
      try {
        const page = await browser!.newPage();
        await page.setContent(fixtureHtml);

        const inspection = (await inspectPage(page, {
          url: 'https://reference.example/',
          out: outDir,
          dark: false,
        })) as InspectionResult;

        expect(existsSync(join(outDir, 'desktop.png'))).toBe(true);
        expect(existsSync(join(outDir, 'tablet.png'))).toBe(true);
        expect(existsSync(join(outDir, 'mobile.png'))).toBe(true);

        const colorValues = inspection.colors.map((c) => c.value);
        expect(colorValues).toContain('#2563eb'); // primary-кнопка
        expect(colorValues).toContain('#18181b'); // body текст
        expect(colorValues).toContain('#ffffff'); // фон
        expect(colorValues).toContain('#e4e4e7'); // border картки

        expect(inspection.fonts.heading?.family).toMatch(/Manrope/);
        expect(inspection.fonts.body?.family).toMatch(/Inter/);
        expect(inspection.fonts.heading?.sizePx).toBe(32);

        expect(inspection.radius.some((r) => r.valuePx === 8)).toBe(true);

        expect(inspection.fontStylesheets).toEqual(
          expect.arrayContaining([
            'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
            'https://fonts.googleapis.com/css2?family=Manrope:wght@700;800&display=swap',
          ]),
        );

        // Контракт кінець-в-кінець: те, що реально семплив браузер,
        // проходить той самий mapTokens, що й синтетична фікстура вище.
        const proposal = mapTokens(inspection);
        expect(proposal.tokens.background).toBeDefined();
        expect(proposal.tokens.primary).toBeDefined();
      } finally {
        rmSync(outDir, { recursive: true, force: true });
      }
    }, 60_000);
  },
);
