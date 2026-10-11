import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const DIR = join(ROOT, 'scripts/live-smoke');

/**
 * Ратчет миттєвих читань UI у кроках `live:smoke`.
 *
 * Що стереже і чому: `locator.count()`, `.isVisible()`, `.isHidden()`, `.isChecked()`, `.isEnabled()`,
 * `.isDisabled()`, `.isEditable()`, `.textContent()`, `.innerText()`, `.inputValue()`,
 * `.allTextContents()`, `.allInnerTexts()` читають DOM ОДРАЗУ, без очікування. Інтерфейс сходиться асинхронно (мутація →
 * інвалідація → рендер), тож на повільнішому прогоні вони дають хибний
 * «нуль»/«невидимий». Так вийшов флейк Е6д «доставка: setDefault» — миттєвий
 * `count()` разом із нестрогим вибором рядка. Умову чекають помічниками з
 * `scripts/live-smoke/wait.mjs` (`expectVisible`/`expectGone`/`expectCount`/
 * `expectSome`, короткий таймаут, не пауза).
 *
 * 🔴 Це НЕ тотальна заборона: є читання, де стан уже дочекано (рядок/блок
 * видно) і далі береться саме значення. Вони перелічені нижче з причиною біля
 * кожного — за зразком `STORAGE_DIRECT_CALL_EXEMPTIONS`. Список лише
 * скорочується: новий миттєвий виклик поза списком червоніє, а запис, чий
 * вжиток зник, теж червоніє — прибери його.
 *
 * Ключ запису — файл + НОРМАЛІЗОВАНИЙ ТЕКСТ виклику (голова ланцюжка `.a().b()`
 * разом із рядком виклику), а не лічильник: підміна дозволеного виклику новим
 * у тому ж файлі змінює текст і червоніє. Скануються `scripts/live-smoke/**`
 * та `scripts/live-smoke.mjs`.
 */
export const INSTANT_CHECK_EXEMPTIONS: readonly {
  /** Шлях відносно `scripts/live-smoke/` (або `../live-smoke.mjs`). */
  file: string;
  /** Нормалізований текст виклику: голова ланцюжка + рядок з читанням. */
  call: string;
  reason: string;
}[] = [
  {
    file: 'admin-catalog-verify.mjs',
    call: "const text = (await page.locator('main').textContent()) ?? '';",
    reason:
      'текст вітринної картки читається після `goto` з `networkidle` (SSR, сторінка вже відрендерена); далі перевіряється наявність назви',
  },
  {
    file: 'admin-content-moderation.mjs',
    call: "(await badge.textContent({ timeout: 10_000 }).catch(() => '0')) ?? '0',",
    reason:
      '`textContent` сам чекає появи бейджа до 10 с; лічильник сторінки читається після `networkidle`, перевірка ≥ 2 не залежить від порядку оновлення',
  },
  {
    file: 'admin-customers-owner.mjs',
    call: 'const found = await row.count();',
    reason:
      'після `row.first().waitFor`; число повертається викликачу для строгої перевірки «рівно 1» (дубль-рядок — дефект)',
  },
  {
    file: 'admin-dictionaries-properties.mjs',
    call: "const text = (await page.locator('main').textContent()) ?? '';",
    reason:
      'текст вітринної сторінки після `goto` (SSR), перевіряється наявність назви опції',
  },
  {
    file: 'admin-dictionaries.mjs',
    call: "const catalogText = (await page.locator('main').textContent()) ?? '';",
    reason:
      'текст вітринної сторінки після `goto` (SSR), перевіряється наявність нового розділу',
  },
  {
    file: 'admin-dictionaries.mjs',
    call: "const offered = await page .getByRole('option', { name: new RegExp(PROP.name) }) .count();",
    reason:
      'спершу `listbox` дочекано (інакше нуль був би «ще не відрендерилось»); очікуваний результат — нуль опцій',
  },
  {
    file: 'admin-discounts-buyer.mjs',
    call: "? parseMoney(((await unit.textContent()) ?? '').split('×')[0] ?? '')",
    reason:
      'читається лише коли `unit.waitFor` вже підтвердив наявність рядка кошика',
  },
  {
    file: 'admin-discounts-buyer.mjs',
    call: 'const named = await items.getByText(discountName, { exact: true }).count();',
    reason:
      'читається після дочеканого `unit` (рядок кошика видно); «назви немає» — на вже відрендереному рядку',
  },
  {
    file: 'admin-discounts-buyer.mjs',
    call: 'const displayed = parseMoney(await page.locator(FIELD.total).textContent());',
    reason:
      'перед читанням `FIELD.total.waitFor()`: підсумок зʼявляється, коли квота вляглась',
  },
  {
    file: 'admin-discounts-owner.mjs',
    call: "const warning = (await dialog.textContent()) ?? '';",
    reason:
      'діалог щойно відкритий кліком і містить статичний текст каскаду; його присутність далі перевіряє клік по кнопці всередині',
  },
  {
    file: 'admin-lists-pagination.mjs',
    call: 'if (!(await button.isEnabled().catch(() => false))) {',
    reason:
      'опитування в циклі після `expectVisible(button)`; помилка читання трактується як «ще disabled» і цикл ретраїть',
  },
  {
    file: 'admin-lists-pagination.mjs',
    call: "rowKeys: (p) => p.locator('tbody tr td.font-medium').allTextContents(),",
    reason:
      'ключі рядків читаються після `waitRows`/дочеканих підвантажень сторінки, читання — предмет перевірки повноти списку',
  },
  {
    file: 'admin-order-edit-ui.mjs',
    call: 'return parseMoney(await cell.textContent());',
    reason: 'читається після `cell.waitFor` на тій самій клітинці',
  },
  {
    file: 'admin-orders-buyer.mjs',
    call: "(await page .locator('text=/В наявності|Немає в наявності|Під замовлення/') .first() .textContent()) ?? '';",
    reason:
      '`textContent` чекає появи бейджа; картка товару — SSR після `networkidle`',
  },
  {
    file: 'admin-orders.mjs',
    call: 'const amount = parseMoney(await cells.nth(2).textContent());',
    reason:
      'клітинки читаються після `row.waitFor` на рядку замовлення; сума й бейдж уже відрендерені разом з рядком',
  },
  {
    file: 'admin-orders.mjs',
    call: "const badge = ((await cells.nth(3).textContent()) ?? '').trim();",
    reason:
      'клітинки читаються після `row.waitFor` на рядку замовлення; сума й бейдж уже відрендерені разом з рядком',
  },
  {
    file: 'admin-save-return-orders.mjs',
    call: "const rowText = await page .locator('tbody tr', { hasText: `SR-${tag}-1` }) .first() .innerText();",
    reason:
      'читається після `waitRows` і свідомої паузи; перевіряється, що рядки на місці',
  },
  {
    file: 'admin-save-return.mjs',
    call: "const names = await page .locator('tbody tr td.font-medium') .allTextContents();",
    reason:
      'читається після `waitRows` і свідомої паузи: перевіряється ВІДСУТНІСТЬ усічення списку',
  },
  {
    file: 'admin-shipping-buyer.mjs',
    call: 'const displayed = parseMoney(await page.locator(FIELD.total).textContent());',
    reason: 'перед читанням `FIELD.total.waitFor()`',
  },
  {
    file: 'admin-shipping-buyer.mjs',
    call: 'const fresh = await page.getByText(newName).count();',
    reason:
      'відсутність нової назви читається після дочеканого `waitText(oldName)` — сторінка вже відрендерена',
  },
  {
    file: 'admin-shipping-orders.mjs',
    call: 'const cardNew = await page.getByText(fx.point.renamed).count();',
    reason:
      'відсутність нової назви точки на картці читається після дочеканого `waitText` старої',
  },
  {
    file: 'admin-system-themes.mjs',
    call: 'return (await page.locator(SOLAR_HEADER).count()) > 0;',
    reason:
      'після `header.w-full` і (для solar) дочекання `SOLAR_HEADER`; негативний випадок «не solar» не має чекати таймаут',
  },
  {
    file: 'admin-validation-errors.mjs',
    call: "const body = (await page.locator('body').innerText()).toString();",
    reason:
      'текст сторінки читається після `field.waitFor` і `expectCount`; перевірка — що повідомлення не дублюється в тілі',
  },
  {
    file: 'funnel.mjs',
    call: "(await page .locator('text=/В наявності|Немає в наявності|Під замовлення/') .first() .textContent()) ?? '';",
    reason:
      '`textContent` чекає появи бейджа; картка товару — SSR після `goto`',
  },
  {
    file: 'funnel.mjs',
    call: "(await page .locator('script[type=\"application/ld+json\"]') .first() .textContent()) ?? '';",
    reason:
      'JSON-LD — частина SSR-розмітки картки, `textContent` чекає елемента',
  },
  {
    file: 'funnel.mjs',
    call: 'const firstName = await page.locator(FIELD.firstName).inputValue();',
    reason: 'після `waitForFunction`, що дочекався непорожнього значення поля',
  },
  {
    file: 'funnel.mjs',
    call: 'const pickedPoint = await page.locator(FIELD.pickupPoint).inputValue();',
    reason:
      'поле пункту видачі читається після дочеканого чекауту (префіл відбувся раніше, `firstName`)',
  },
  {
    file: 'funnel.mjs',
    call: 'const totalText = await page.locator(FIELD.total).textContent();',
    reason: 'перед читанням `FIELD.total.waitFor()`',
  },
  {
    file: 'place-order.mjs',
    call: "const orderNumber = ((await numberEl.textContent()) ?? '').trim();",
    reason: 'після `waitForURL(/order-success/)` і `networkidle`',
  },
];

const INSTANT =
  /\.(?:isVisible|isHidden|isChecked|isEnabled|isDisabled|isEditable|textContent|innerText|inputValue|allTextContents|allInnerTexts)\(|\.count\(\)/;

/** Лише код: коментарі з поясненням «чому не isVisible» не рахуються. */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ''))
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

/** Миттєві читання тексту: `{file, call}` на кожен збіг (з повторами). */
export function findInstantReads(
  file: string,
  src: string,
): { file: string; call: string }[] {
  const lines = stripComments(src).split('\n');
  const out: { file: string; call: string }[] = [];
  lines.forEach((line, i) => {
    if (!INSTANT.test(line)) return;
    // Ланцюжок `.a()\n.b()` — разом із головою, інакше `.textContent()) ?? ''`
    // однаковий у різних місцях файла.
    const parts = [line.trim()];
    for (let j = i; j > 0 && (lines[j] as string).trim().startsWith('.'); j--)
      parts.unshift((lines[j - 1] as string).trim());
    out.push({ file, call: parts.join(' ').replace(/\s+/g, ' ') });
  });
  return out;
}

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? walk(join(dir, e.name))
      : /\.(mjs|mts|ts|js)$/.test(e.name)
        ? [join(dir, e.name)]
        : [],
  );
}

const files = [...walk(DIR), join(ROOT, 'scripts/live-smoke.mjs')].filter(
  (f) => !f.endsWith('/wait.mjs'),
);
const found = files.flatMap((f) =>
  findInstantReads(
    relative(DIR, f).replaceAll('\\', '/'),
    readFileSync(f, 'utf8'),
  ),
);
const keyOf = (e: { file: string; call: string }): string =>
  `${e.file} :: ${e.call}`;
const allowed = new Map<string, number>();
for (const e of INSTANT_CHECK_EXEMPTIONS)
  allowed.set(keyOf(e), (allowed.get(keyOf(e)) ?? 0) + 1);

/** Збіги, яких не покриває список (кратність враховано). */
export function uncovered(
  hits: readonly { file: string; call: string }[],
  list: ReadonlyMap<string, number>,
): string[] {
  const left = new Map(list);
  const bad: string[] = [];
  for (const h of hits) {
    const k = keyOf(h);
    const n = left.get(k) ?? 0;
    if (n > 0) left.set(k, n - 1);
    else bad.push(k);
  }
  return bad;
}

describe('миттєві читання UI у live-smoke', () => {
  it('поза списком виїмок миттєвих читань немає', () => {
    expect(
      uncovered(found, allowed),
      'миттєве читання DOM на асинхронному UI — флейк; використай expectVisible/expectGone/expectCount/expectSome/expectDisabled з scripts/live-smoke/wait.mjs або додай виїмку з причиною (стан уже дочекано)',
    ).toEqual([]);
  });

  it('список виїмок не містить мертвих записів', () => {
    const seen = new Map<string, number>();
    for (const h of found) seen.set(keyOf(h), (seen.get(keyOf(h)) ?? 0) + 1);
    const dead = [...allowed]
      .filter(([k, n]) => (seen.get(k) ?? 0) < n)
      .map(([k]) => k);
    expect(
      dead,
      'вжиток зник або змінився — прибери/онови запис, список лише скорочується',
    ).toEqual([]);
  });

  it('кожна виїмка має причину', () => {
    expect(
      INSTANT_CHECK_EXEMPTIONS.filter((e) => e.reason.trim().length < 10),
    ).toEqual([]);
  });

  it('негативні контролі: підміна виклику й новий textContent червоніють', () => {
    const hit = (call: string) => [{ file: 'x.mjs', call }];
    const list = new Map([['x.mjs :: const a = await row.count();', 1]]);
    expect(uncovered(hit('const a = await row.count();'), list)).toEqual([]);
    // підміна дозволеного виклику іншим у тому ж файлі
    expect(uncovered(hit('const b = await other.count();'), list)).toHaveLength(
      1,
    );
    // новий textContent
    expect(
      uncovered(
        findInstantReads('x.mjs', 'const t = await el.textContent();'),
        list,
      ),
    ).toHaveLength(1);
    // кратність: другий однаковий виклик понад список
    expect(
      uncovered(
        [
          ...hit('const a = await row.count();'),
          ...hit('const a = await row.count();'),
        ],
        list,
      ),
    ).toHaveLength(1);
    // миттєві читання знаходяться з розширеного набору
    for (const m of ['isChecked', 'isEditable', 'inputValue', 'allInnerTexts'])
      expect(findInstantReads('x.mjs', `await l.${m}();`)).toHaveLength(1);
  });
});
