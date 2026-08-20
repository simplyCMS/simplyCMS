/**
 * Hover-sweep інспекції (план Р5, Фаза 2): детерміністичний прохід Playwright
 * `hover()` по обмеженому списку інтерактивних елементів із фіксацією дельти
 * computed styles. Результат їде в `motion.hover`. Окремий модуль, а не
 * доважок до `inspect-page.mjs` (канон ≤150 рядків: там і так уже reveal,
 * скріншоти, два семпли палітри й запис файлу).
 */
import { browserHoverMeta, browserNeutralPoint } from './browser-hover.mjs';

/**
 * Що взагалі ховеримо. `querySelectorAll` зі списком селекторів віддає вузли в
 * DOM-порядку і БЕЗ дублікатів (`<button role="button">` матчиться двома
 * селекторами, а в наборі буде раз) — на цьому тримається детермінізм.
 */
export const HOVER_SELECTOR = 'header a, nav a, button, [role="button"]';

/**
 * Властивості, дельту яких фіксуємо (Р5). Список навмисно за абеткою: він же
 * задає порядок `changes` у виводі, тож окреме сортування не потрібне.
 * 🔴 `border-color` за замовчуванням дорівнює `currentColor`, тож зміна
 * `color` тягне його за собою навіть при `border-style: none` — це не шум
 * капчера, а реальний computed-стан.
 */
export const HOVER_PROPERTIES = [
  'background-color',
  'border-color',
  'box-shadow',
  'color',
  'transform',
];

/**
 * Стеля кандидатів. Саме СТЕЛЯ, а не «скільки є»: кожен елемент коштує
 * `hover()` плюс settle-паузу, тож мега-меню з двох сотень посилань
 * перетворило б інспекцію однієї сторінки на хвилини. Ховер-палітра сайту —
 * стилістичний ЗРАЗОК, а не інвентаризація: перші два десятки вузлів у
 * DOM-порядку (шапка, навігація, перший екран) уже містять усі типові стани.
 */
export const HOVER_LIMIT = 20;

/**
 * Пауза між `hover()` і зняттям стану «після», мс. Має перекривати типову
 * UI-транзицію (150–300 мс), інакше семпл ловить СЕРЕДИНУ переходу — значення,
 * яке в наступному прогоні буде іншим, і глибока рівність двох прогонів
 * розсиплеться. 400 мс — запас над 300 мс і все ще ≤8 с на повну стелю.
 */
export const HOVER_SETTLE_MS = 400;

/**
 * Таймаут actionability-очікування `hover()`, мс. 🔴 Дефолт Playwright — 30 с:
 * сторінка з cookie-оверлеєм поверх шапки повісила б прохід на десять хвилин
 * замість чесно порахувати перекриті елементи як пропущені.
 */
export const HOVER_ACTION_TIMEOUT_MS = 2000;

/** Порівняння рядків для стабільного сортування. */
const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * Значущі зміни між станом спокою і станом під курсором.
 * @returns {Array<{ property: string, from: string, to: string }>}
 */
function diffStyles(before, after) {
  return HOVER_PROPERTIES.filter((p) => before[p] !== after[p]).map((p) => ({
    property: p,
    from: before[p],
    to: after[p],
  }));
}

/**
 * Відібрати видимих кандидатів у DOM-порядку й зняти їхній стан СПОКОЮ одним
 * проходом, ДО першого `hover()`: читати «до» безпосередньо перед ховером
 * кожного було б крихко — курсор на той момент ще стоїть на попередньому
 * елементі, і якщо той предок/нащадок поточного, «до» містило б чужий ховер.
 */
async function selectCandidates(page, limit) {
  const handles = await page.$$(HOVER_SELECTOR);
  const selected = [];

  for (const handle of handles) {
    if (selected.length >= limit) break;
    const meta = await handle.evaluate(browserHoverMeta, HOVER_PROPERTIES);
    if (!meta.visible) continue;
    selected.push({
      handle,
      index: selected.length,
      selector: meta.selector,
      before: meta.styles,
    });
  }
  return selected;
}

/**
 * Прохід ховером по сторінці. У виводі — лише елементи з РЕАЛЬНОЮ дельтою;
 * `skipped` — чесний лічильник тих, на кому ховер не вдався (вузол
 * відʼєднався від DOM, перекритий оверлеєм, не дочекався actionability). Форма
 * «дані + лічильник втрат» — та сама, що в `keyframes.inaccessibleSheets`:
 * мовчазного дропу в секції `motion` немає.
 *
 * 🔴 Викликати ПІСЛЯ скріншотів (курсор не має потрапити в кадр) і ДО
 * семплу палітри — слід ховера прибирає завершальний `mouse.move`.
 *
 * @param {import('@playwright/test').Page} page
 * @param {{ limit?: number, settleMs?: number }} [options]
 * @returns {Promise<{ entries: Array<{ index: number, selector: string,
 *   changes: Array<{ property: string, from: string, to: string }> }>,
 *   skipped: number }>}
 */
export async function sweepHover(page, options = {}) {
  const limit = options.limit ?? HOVER_LIMIT;
  const settleMs = options.settleMs ?? HOVER_SETTLE_MS;

  const candidates = await selectCandidates(page, limit);
  const entries = [];
  let skipped = 0;

  for (const candidate of candidates) {
    try {
      await candidate.handle.hover({ timeout: HOVER_ACTION_TIMEOUT_MS });
      await page.waitForTimeout(settleMs);
      const after = await candidate.handle.evaluate(
        browserHoverMeta,
        HOVER_PROPERTIES,
      );
      const changes = diffStyles(candidate.before, after.styles);
      if (changes.length > 0)
        entries.push({
          index: candidate.index,
          selector: candidate.selector,
          changes,
        });
    } catch {
      // Один проблемний вузол не валить прохід — лише збільшує лічильник.
      skipped += 1;
    }
  }

  // `hover()` сам скролить елемент у в'юпорт — повертаємо сторінку на верх,
  // щоб подальші кроки інспекції бачили ту саму позицію, що й до проходу.
  await page.evaluate(() => window.scrollTo(0, 0));
  const neutral = await page.evaluate(browserNeutralPoint);
  await page.mouse.move(neutral.x, neutral.y);
  // Hover-out теж транзиція: без паузи семпл палітри читав би її середину.
  await page.waitForTimeout(settleMs);

  entries.sort((a, b) => cmp(a.selector, b.selector) || a.index - b.index);
  return { entries, skipped };
}
