import type { Page } from '@playwright/test';

export interface OverflowScanOptions {
  /**
   * `true` — сторінка адмінки на вузькому viewport: горизонтальний
   * скрол/скролюваний контейнер (`overflow-x: auto|scroll`) там — НОРМА, не
   * дефект. Поріг узятий з живого ручного прогону
   * (`docs/architecture/test-contours.md` §8.6, 2026-08-09): широкі таблиці
   * адмінки на 390px ширші за екран на обох локалях, і це очікувано.
   * Контейнери, що РІЖУТЬ вміст (`overflow-x: hidden|clip`), лишаються
   * падінням завжди — там немає скролбару, яким можна дістатись до решти.
   */
  allowScrollableOverflow: boolean;
}

/**
 * Вимірює переповнення верстки поточного документа:
 *  (a) елемент із власним текстовим вузлом, що не влазить у себе;
 *  (b) дитина, що виходить за праву межу батька з `overflow-x`, який ховає
 *      (`hidden`/`clip`) або мав би скролити (`auto`/`scroll`) вміст;
 *  (c) горизонтальний скрол усієї сторінки.
 * `span.sr-only` виключено з (a)/(b): обрізається НАВМИСНО
 * (`width:1px; overflow:hidden`) і дає хибні спрацювання (спіймано §8.6).
 */
export async function scanForOverflow(
  page: Page,
  options: OverflowScanOptions,
): Promise<string[]> {
  return page.evaluate((opts) => {
    const violations: string[] = [];
    const isSrOnly = (el: Element): boolean =>
      el.classList.contains('sr-only') || el.closest('.sr-only') !== null;
    const describe = (el: Element): string => `<${el.tagName.toLowerCase()}>`;

    const all = Array.from(document.querySelectorAll('body *'));

    for (const el of all) {
      if (isSrOnly(el)) continue;
      const hasOwnText = Array.from(el.childNodes).some(
        (node) =>
          node.nodeType === Node.TEXT_NODE &&
          (node.textContent ?? '').trim().length > 0,
      );
      if (!hasOwnText) continue;
      if (el.scrollWidth > el.clientWidth + 1) {
        const text = (el.textContent ?? '').trim().slice(0, 60);
        violations.push(
          `clipped-text ${describe(el)} scrollWidth=${el.scrollWidth} ` +
            `clientWidth=${el.clientWidth} text="${text}"`,
        );
      }
    }

    const clipping = new Set(['hidden', 'clip']);
    const scrollable = new Set(['auto', 'scroll']);
    for (const el of all) {
      const overflowX = getComputedStyle(el).overflowX;
      const isClipping = clipping.has(overflowX);
      const isScrollable = scrollable.has(overflowX);
      if (!isClipping && !isScrollable) continue;
      if (isScrollable && opts.allowScrollableOverflow) continue;

      const parentRect = el.getBoundingClientRect();
      for (const child of Array.from(el.children)) {
        if (isSrOnly(child)) continue;
        const rect = child.getBoundingClientRect();
        if (rect.width > 0 && rect.right > parentRect.right + 1) {
          violations.push(
            `escapes-parent overflow-x=${overflowX} parent=${describe(el)} ` +
              `child=${describe(child)}`,
          );
          break;
        }
      }
    }

    const docEl = document.documentElement;
    if (
      docEl.scrollWidth > docEl.clientWidth + 1 &&
      !opts.allowScrollableOverflow
    ) {
      violations.push(
        `page-scroll scrollWidth=${docEl.scrollWidth} clientWidth=${docEl.clientWidth}`,
      );
    }

    return violations;
  }, options);
}
