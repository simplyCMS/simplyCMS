/**
 * Смок шрифт-евристики в headless chromium (інкремент Б.2, Фаза 3, план Р7).
 * Кейс із беклогу лайв-тесту: численні короткі моно-мітки перебивали кілька
 * довгих body-абзаців, бо вага сімʼї була ЧАСТОТОЮ елементів, — і
 * `fonts.body` віддавав шрифт бейджів замість шрифту читання.
 *
 * Окремий файл, а не доважок до `design-import-inspect.test.ts` (той уже 220+
 * рядків при каноні ≤150). Патерн browser-гейту звідти: TOP-LEVEL AWAIT +
 * реальний launch-probe, бо async-функція всередині `skipIf` повертає Promise
 * (завжди truthy) і дала б вічний skip, якого TS не ловить.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';
import { afterAll, describe, expect, it } from 'vitest';
import { resolveChromium } from '../.agents/skills/redesign-from-reference/scripts/lib/browser.mjs';
import {
  samplePalette,
  VIEWPORTS,
  VIEWPORT_HEIGHT,
} from '../.agents/skills/redesign-from-reference/scripts/lib/sample.mjs';

// `sample.mjs` — чистий .mjs без пофіледних JSDoc-типів, тож TS інферить
// `any`-ланцюжок від `Page.evaluate`; каст лише на те, що читає тест.
interface FontSample {
  fonts: {
    heading: { family: string; sizePx: number } | null;
    body: { family: string } | null;
  };
}

let browser: import('@playwright/test').Browser | null = null;
let skipReason = '';
try {
  browser = await chromium.launch({
    headless: true,
    ...resolveChromium(chromium),
  });
} catch (error) {
  skipReason = error instanceof Error ? error.message : String(error);
}

afterAll(async () => {
  await browser?.close();
});

describe.skipIf(!browser)(
  browser
    ? 'browser-fonts.mjs — вага сімʼї за довжиною тексту (Р7)'
    : `browser-fonts.mjs — SKIP: ${skipReason}`,
  () => {
    it('body-сімʼя виграє в чисельніших, але коротших моно-міток', async () => {
      const fixture = readFileSync(
        join(process.cwd(), 'tests/fixtures/design-import/fonts.html'),
        'utf8',
      );
      const page = await browser!.newPage();
      try {
        await page.setViewportSize({
          width: VIEWPORTS.desktop,
          height: VIEWPORT_HEIGHT,
        });
        await page.setContent(fixture);

        const { fonts } = (await samplePalette(page)) as FontSample;

        // 🔴 Суть Р7: моно-мітки чисельніші (26 вузлів проти 3), але сумарно
        // коротші (120 символів проти ~650) — перемагає сімʼя читання.
        expect(fonts.body?.family).toMatch(/BodySans/);
        expect(fonts.body?.family).not.toMatch(/TagMono/);

        // Заголовкова карта рахується окремо й лишається незачепленою.
        expect(fonts.heading?.family).toMatch(/HeadingSerif/);
        expect(fonts.heading?.sizePx).toBe(32);
      } finally {
        await page.close();
      }
    }, 60_000);
  },
);
