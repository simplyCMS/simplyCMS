import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from '@playwright/test';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { resolveChromium } from '../.agents/skills/redesign-from-reference/scripts/lib/browser.mjs';
import {
  expectVisible,
  toastText,
  waitToast,
} from '../scripts/live-smoke/wait.mjs';

/**
 * Тости у `live:smoke` (Р30-флейк). Radix Toast за кадр-два після тосту додає
 * visually-hidden a11y-анонс (`role="status"`) з ТИМ САМИМ текстом, портований в
 * `body` поза регіоном сповіщень. `getByText(текст)` тоді дає два збіги, а
 * strict mode violation `expectVisible` раніше мовчки перетворював на «не видно».
 * Фікстура відтворює розмітку, виміряну на живому прогоні (звіт r30-flaky):
 * `region[aria-label="Notifications (F8)"]` з видимим тостом + анонс у `body`.
 */
const TEXT = 'Пошту ще не підтверджено';
const HTML = `
  <section role="region" aria-label="Notifications (F8)" tabindex="-1">
    <ol><li role="status"><div class="grid"><div>Помилка входу</div>
      <div class="text-sm opacity-90">${TEXT}, перевірте лист</div></div></li></ol>
  </section>
  <span role="status" style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap">
    Notification Помилка входу${TEXT}, перевірте лист</span>`;

let browser: import('@playwright/test').Browser | null = null;
let skip = '';
try {
  browser = await chromium.launch({
    headless: true,
    ...resolveChromium(chromium),
  });
} catch (e) {
  skip = e instanceof Error ? e.message : String(e);
}
afterAll(async () => {
  await browser?.close();
});

const page = async (html = HTML) => {
  const p = await (browser as NonNullable<typeof browser>).newPage();
  await p.setContent(html);
  return p;
};

describe.skipIf(skip !== '')(
  `тости live-smoke (chromium${skip && ': ' + skip})`,
  () => {
    beforeAll(() => {
      expect(browser).not.toBeNull();
    });

    it('фікстура реалістична: голий getByText дає два збіги', async () => {
      const p = await page();
      expect(await p.getByText(TEXT).count()).toBe(2);
      await p.close();
    });

    it('toastText знаходить рівно видимий тост у регіоні сповіщень', async () => {
      const p = await page();
      const t = toastText(p, TEXT);
      // `.first()` без звуження обрав би будь-який з двох, тож порівнюємо предка
      expect(
        await t.evaluate((el: Element) => !!el.closest('[role="region"]')),
      ).toBe(true);
      expect(await waitToast(p, TEXT, 1_000)).toBe(true);
      await p.close();
    });

    it('текст лише поза регіоном (a11y-анонс) тостом не вважається', async () => {
      const p = await page(
        `<span role="status" style="position:absolute;width:1px;height:1px;overflow:hidden">${TEXT}</span>`,
      );
      expect(await waitToast(p, TEXT, 500)).toBe(false);
      await p.close();
    });

    it('expectVisible: неоднозначний локатор кидається, а не дає мовчазний false', async () => {
      const p = await page();
      await expect(expectVisible(p.getByText(TEXT), 1_000)).rejects.toThrow(
        /strict mode violation/,
      );
      await p.close();
    });

    it('expectVisible: невалідний селектор кидається; таймаут → false', async () => {
      const p = await page();
      await expect(expectVisible(p.locator('css=[['), 500)).rejects.toThrow();
      expect(await expectVisible(p.getByText('немає такого'), 300)).toBe(false);
      await p.close();
    });
  },
);

describe('ратчет: тексти тостів лише через waitToast/toastText', () => {
  const DIR = resolve(import.meta.dirname, '../scripts/live-smoke');
  const files = readdirSync(DIR)
    .filter((f) => f.endsWith('.mjs'))
    .map((f) => [f, readFileSync(join(DIR, f), 'utf8')] as const);

  /** Літерали, які крок чекає як тост (`waitToast(page, '…')`). */
  const toastLiterals = (src: string) =>
    [...src.matchAll(/waitToast\(\s*page,\s*'([^']+)'/g)].map((m) => m[1]);
  /** `getByText('<літерал>'` поза хелпером. */
  const rawUses = (src: string, texts: string[]) =>
    texts.filter((t) => src.includes(`getByText('${t}'`));

  const texts = [...new Set(files.flatMap(([, s]) => toastLiterals(s)))];

  it('є що стерегти', () => {
    expect(texts.length).toBeGreaterThan(10);
  });

  it('жоден текст тосту не шукається голим getByText', () => {
    const bad = files
      .filter(([f]) => f !== 'wait.mjs')
      .flatMap(([f, s]) => rawUses(s, texts).map((t) => `${f}: «${t}»`));
    expect(bad, 'використай waitToast/toastText з wait.mjs').toEqual([]);
  });

  it('негативний контроль: голий getByText тосту ловиться', () => {
    expect(
      rawUses("page.getByText('Тему активовано')", ['Тему активовано']),
    ).toHaveLength(1);
  });
});
