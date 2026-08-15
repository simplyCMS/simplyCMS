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
import { execFile, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { chromium } from '@playwright/test';
import { afterAll, describe, expect, it } from 'vitest';
import { resolveChromium } from '../.agents/skills/redesign-from-reference/scripts/lib/browser.mjs';
import { inspectPage } from '../.agents/skills/redesign-from-reference/scripts/inspect.mjs';
import { mapTokens } from '../.agents/skills/redesign-from-reference/scripts/lib/map.mjs';
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
  radiusDropped: number;
  sampleViewport: { width: number; height: number };
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

  // Регресія Фази 1 (Р1b/Р2): нові поля контракту `inspection.json` — не
  // просто присутні, а мають форму, яку реально пише `inspectPage`.
  it('sampleInspection несе radiusDropped і sampleViewport (Р1b/Р2)', () => {
    expect(sampleInspection.radiusDropped).toBeGreaterThan(0);
    expect(sampleInspection.sampleViewport).toEqual({
      width: 1440,
      height: 900,
    });
  });
});

const INSPECT_CLI = join(
  process.cwd(),
  '.claude/skills/redesign-from-reference/scripts/inspect.mjs',
);

// Регресія ревʼю: невалідний URL має падати каналом `failLoud` («❌ …»),
// а не сирим TypeError-стектрейсом. Браузер для цього шляху не потрібен —
// pre-launch валідація відпрацьовує до `chromium.launch`.
describe('inspect.mjs — pre-launch валідація (без браузера)', () => {
  it('невалідний URL → exit 1 у форматі failLoud', () => {
    const run = spawnSync(process.execPath, [INSPECT_CLI, 'not a valid url'], {
      encoding: 'utf8',
    });
    expect(run.status).toBe(1);
    expect(run.stderr).toContain('❌');
    expect(run.stderr).not.toContain('at slugify'); // не сирий стектрейс
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

        // Регресія Р1: `scrollThrough` доводить IntersectionObserver до
        // спрацювання — колір лінивої секції зʼявляється в семплі, а не
        // лишається білим (як до реального скролу).
        expect(colorValues).toContain('#10b981'); // .lazy-desktop.revealed

        // Регресія Р1b: семплінг явно десктопний (`sampleViewport`), а НЕ з
        // останнього viewport циклу скріншотів (мобільний, 390px) — на 390px
        // `.desktop-only` мав би `display:none` і взагалі не потрапив у DOM-
        // вибірку зі `area>0`.
        expect(colorValues).toContain('#0ea5e9'); // .desktop-only
        expect(inspection.sampleViewport).toEqual({ width: 1440, height: 900 });
        // `.lazy-mobile` видима лише на 390px — семпл десктопний, тож її
        // колір (#f43f5e) семплом навмисно НЕ перевіряється (документовано
        // планом Р1b); скріншот `mobile.png` — окремий доказ.

        expect(inspection.fonts.heading?.family).toMatch(/Manrope/);
        expect(inspection.fonts.body?.family).toMatch(/Inter/);
        expect(inspection.fonts.heading?.sizePx).toBe(32);

        expect(inspection.radius.some((r) => r.valuePx === 8)).toBe(true);

        // Регресія Р2: pill-радіус (`.pill-button`, 9999px) не потрапляє в
        // кластери токена — ні буквальне значення, ні Tailwind-еквівалент
        // `calc(infinity*1px)` (33554400), — а лічильник відкинутих ненульовий.
        expect(inspection.radius.some((r) => r.valuePx === 9999)).toBe(false);
        expect(inspection.radius.some((r) => r.valuePx === 33554400)).toBe(
          false,
        );
        expect(inspection.radiusDropped).toBeGreaterThan(0);

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

    // Регресія ревʼю: `page.goto` не кидає на 4xx/5xx — без перевірки статусу
    // 403/бот-заглушка давала б «успішний» inspection.json з кольорами
    // сторінки-відмови. CLI ганяємо async-execFile, щоб event loop лишався
    // вільним для локального http-сервера.
    it('HTTP 403 від референсу → гучна відмова, без inspection.json', async () => {
      const server = createServer((_req, res) => {
        res.writeHead(403, { 'Content-Type': 'text/html' });
        res.end('<h1 style="color:#ef4444">Access denied</h1>');
      });
      await new Promise<void>((resolve) => server.listen(0, resolve));
      const { port } = server.address() as { port: number };
      const outDir = mkdtempSync(join(tmpdir(), 'design-import-403-'));
      try {
        const run = await promisify(execFile)(
          process.execPath,
          [INSPECT_CLI, `http://127.0.0.1:${port}/`, '--out', outDir],
          { encoding: 'utf8' },
        ).then(
          (ok) => ({ code: 0, stderr: ok.stderr }),
          (error: { code?: number; stderr?: string }) => ({
            code: error.code ?? -1,
            stderr: error.stderr ?? '',
          }),
        );

        expect(run.code).toBe(1);
        expect(run.stderr).toContain('❌');
        expect(run.stderr).toContain('HTTP 403');
        expect(existsSync(join(outDir, 'inspection.json'))).toBe(false);
      } finally {
        rmSync(outDir, { recursive: true, force: true });
        await new Promise<void>((resolve, reject) =>
          server.close((err) => (err ? reject(err) : resolve())),
        );
      }
    }, 60_000);
  },
);
