/**
 * Чесність reveal-каналу в headless chromium (інкремент Б.3, Фаза 4, план Р6 /
 * знахідка V-5): корінь вибірки на розмітці БЕЗ `<main>` і три стани
 * `jsDrivenSuspected`.
 *
 * Окремий файл, а не доважок до `design-import-motion.test.ts` (той уже 330+
 * рядків): там фіксуються всі пʼять каналів руху разом на одній фікстурі, тут —
 * рівно один канал і рівно одне питання «чи інструмент бачить, що міряє».
 * Патерн browser-гейту той самий (TOP-LEVEL AWAIT + реальний launch-probe:
 * async-функція всередині `skipIf` повертає Promise, тобто вічний skip).
 */
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from '@playwright/test';
import { afterAll, describe, expect, it } from 'vitest';
import { resolveChromium } from '../.agents/skills/redesign-from-reference/scripts/lib/browser.mjs';
import { inspectPage } from '../.agents/skills/redesign-from-reference/scripts/inspect.mjs';

interface RevealMotion {
  motion: {
    reveal: { selector: string; animated: boolean }[];
    revealSampled: number;
    revealRoot: string;
    jsDrivenSuspected: boolean | 'unknown';
  };
}

const NOMAIN = readFileSync(
  join(process.cwd(), 'tests/fixtures/design-import/motion-nomain.html'),
  'utf8',
);

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

/** Прогін `inspectPage` по довільній розмітці в одноразовій tmp-теці. */
async function inspectHtml(html: string): Promise<RevealMotion> {
  const outDir = mkdtempSync(join(tmpdir(), 'design-import-reveal-'));
  try {
    const page = await browser!.newPage();
    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    const inspection = (await inspectPage(page, {
      url: 'https://reveal.example/',
      out: outDir,
      dark: false,
    })) as unknown as RevealMotion;
    await page.close();
    return inspection;
  } finally {
    rmSync(outDir, { recursive: true, force: true });
  }
}

describe.skipIf(!browser)(
  browser
    ? 'inspect.mjs — reveal-корінь і обсяг вибірки (Р6)'
    : `inspect.mjs reveal-корінь — SKIP: ${skipReason}`,
  () => {
    // 🔴 Негативний контроль Р6: поверніть старий корінь (`main` → плаский
    // `body > section`) — і цей тест почервоніє на першому ж асерті, бо
    // вибірка стисне до однієї статичної секції, а `animated` стане порожнім.
    it('без <main> вибірка бере й секції верхнього рівня, й ярус глибше', async () => {
      const { motion } = await inspectHtml(NOMAIN);

      expect(motion.revealRoot).toBe('body-fallback');
      // Секція верхнього рівня + сім дітей обгортки, мінус інлайн-`<script>`
      // (фільтр невізуальних тегів) = 8. Число точне навмисно: «більше нуля»
      // не відрізнило б fallback-ярус від старого плаского кореня.
      expect(motion.revealSampled).toBe(8);
      expect(motion.revealSampled).toBe(motion.reveal.length);
      expect(
        motion.reveal.some((entry) => entry.selector.startsWith('script')),
      ).toBe(false);

      // Рух знайдено саме на глибокому ярусі — три `.reveal`-секції.
      const animated = motion.reveal.filter((entry) => entry.animated);
      expect(animated).toHaveLength(3);
      expect(animated.every((r) => r.selector === 'section.reveal')).toBe(true);
      // Секція верхнього рівня в вибірці є, але нерухома — обидва яруси разом.
      expect(
        motion.reveal.find((r) => r.selector === 'section.hero')?.animated,
      ).toBe(false);

      // Вибірка непорожня і механізм видно → чесний `false`.
      expect(motion.jsDrivenSuspected).toBe(false);
    }, 120_000);

    // Третій стан наскрізно, а не лише в юніті: сторінка без жодного
    // структурного кандидата дає нульову вибірку, і саме це має бути видно в
    // `inspection.json` — інакше «нема на чому міряти» знову читалось би як
    // «перевірено, підозри немає» (V-5).
    it('нульова вибірка → revealSampled 0 і jsDrivenSuspected "unknown"', async () => {
      const { motion } = await inspectHtml(
        '<p>Суцільний текст без секцій і без обгорток із дітьми.</p>',
      );

      expect(motion.revealSampled).toBe(0);
      expect(motion.reveal).toEqual([]);
      expect(motion.jsDrivenSuspected).toBe('unknown');
      expect(motion.jsDrivenSuspected).not.toBe(false);
    }, 120_000);
  },
);
