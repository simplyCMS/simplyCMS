import { describe, expect, it } from 'vitest';
import {
  DETACHED_DB_READ_EXEMPTIONS,
  INSTANT_CHECK_EXEMPTIONS,
} from './live-smoke-no-instant-checks/data';
import {
  findInstantReads,
  keyOf,
  scanLiveSmoke,
  uncovered,
} from './live-smoke-no-instant-checks/scan';
import {
  findDetachedDbReads,
  scanDetachedDbReads,
} from './live-smoke-no-instant-checks/scan-db-reads';

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
const found = scanLiveSmoke();
const allowed = new Map<string, number>();
for (const e of INSTANT_CHECK_EXEMPTIONS)
  allowed.set(keyOf(e), (allowed.get(keyOf(e)) ?? 0) + 1);

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

  describe('читання БД після очікування зникнення (структурний гард)', () => {
    const dbAllowed = new Map<string, number>();
    for (const e of DETACHED_DB_READ_EXEMPTIONS)
      dbAllowed.set(keyOf(e), (dbAllowed.get(keyOf(e)) ?? 0) + 1);
    const hits = scanDetachedDbReads();

    it('поза списком виїмок читань БД після detached/expectGone без pollUntil немає', () => {
      expect(
        uncovered(hits, dbAllowed),
        'рядок зник з UI до COMMIT: опитуй БД через pollUntil (admin-shipping-sql.mjs) або додай виїмку з причиною',
      ).toEqual([]);
    });

    it('виїмки без мертвих записів і з причинами', () => {
      const seen = new Map<string, number>();
      for (const h of hits) seen.set(keyOf(h), (seen.get(keyOf(h)) ?? 0) + 1);
      expect([...dbAllowed].filter(([k, n]) => (seen.get(k) ?? 0) < n)).toEqual(
        [],
      );
      expect(
        DETACHED_DB_READ_EXEMPTIONS.filter((e) => e.reason.trim().length < 10),
      ).toEqual([]);
    });

    const run = (src: string, extra: Record<string, string> = {}) =>
      findDetachedDbReads({ 'x.mjs': src, ...extra });
    const wait = `await page.getByRole('row').waitFor({ state: 'detached' });`;

    it('негативні контролі: усі форми читання після detached червоні', () => {
      // 1. замикання без dbUrl в аргументах (форма реального пропуску admin-shipping-final)
      expect(
        run(`export async function f({ page, dbUrl }) {
  const read = () => sql(dbUrl, 'select 1');
  ${wait}
  const after = await read();
}`),
      ).toHaveLength(1);
      // 2. читач-хелпер з іншого файлу без dbUrl в аргументах
      expect(
        run(
          `import { countRows } from './h.mjs';
export async function f({ page }) {
  ${wait}
  return countRows('x');
}`,
          {
            'h.mjs': `export async function countRows(t) { return sql(url(), t); }`,
          },
        ),
      ).toHaveLength(1);
      // 3. { dbUrl } в об'єкті
      expect(
        run(`const facts = async (o) => sql(o.dbUrl, 'select 1');
export async function f({ page, dbUrl }) {
  ${wait}
  return facts({ dbUrl });
}`),
      ).toHaveLength(1);
      // 4. dbUrl не першим аргументом
      expect(
        run(`const byId = async (id, url) => sql(url, 'select 1', [id]);
export async function f({ page, dbUrl }) {
  ${wait}
  return byId(1, dbUrl);
}`),
      ).toHaveLength(1);
      // 5. читання далеко (понад 20 рядків) після detached
      expect(
        run(`const q = async () => sql(u, 'select 1');
export async function f({ page }) {
  ${wait}
${'  await page.waitForTimeout(1);\n'.repeat(25)}  return q();
}`),
      ).toHaveLength(1);
      // 6. detached усередині хелпера, читання у викликача
      expect(
        run(`const del = async (page) => { ${wait} };
const q = async () => sql(u, 'select 1');
export async function f({ page }) {
  await del(page);
  return q();
}`),
      ).toHaveLength(1);
      // 7. транзитивний читач (читач викликає читача)
      expect(
        run(`const a = async () => sql(u, 'select 1');
const b = async () => a();
export async function f({ page }) {
  ${wait}
  return b();
}`),
      ).toHaveLength(1);
    });

    it('🔴 очікувачі транзитивні: очікування на другому рівні хелперів — червоне', () => {
      // Негативний контроль Task 18 п. 10.2: `wait` прямо, `step` — лише через `wait`.
      const src = `const wait = async (page) => { ${wait} };
const step = async (page) => { await wait(page); };
const q = async () => sql(u, 'select 1');
export async function top(page) {
  await step(page);
  return q();
}`;
      expect(run(src).map((h) => h.call)).toEqual(['top: q після step']);
      // третій рівень — те саме
      const deeper = src.replace(
        'export async function top(page) {\n  await step(page);',
        'const outer = async (page) => { await step(page); };\nexport async function top(page) {\n  await outer(page);',
      );
      expect(run(deeper).map((h) => h.call)).toEqual(['top: q після outer']);
    });

    it('обмеження гарда: функція з page не читач — strict її вмикає', () => {
      const withPage = `const q = async () => sql(u, 'select 1');
const stepWithPage = async (page) => { await q(); await page.goto('x'); };
export async function top(page) {
  ${wait}
  return stepWithPage(page);
}`;
      expect(run(withPage)).toHaveLength(0);
      expect(
        findDetachedDbReads({ 'x.mjs': withPage }, { strict: true }),
      ).toHaveLength(1);
    });

    it('мітка очікувача — найближчий попередній, а не перший у функції', () => {
      const hit = run(`const q = async () => sql(u, 'select 1');
const del = async (page) => { ${wait} };
export async function top(page) {
  await del(page);
  await page.goto('x');
  ${wait}
  return q();
}`);
      expect(hit.map((h) => h.call)).toEqual(['top: q після detached']);
    });

    it('негативні контролі: pollUntil, читання до очікування й крок із page не червоніють', () => {
      expect(
        run(`const q = async () => sql(u, 'select 1');
export async function f({ page }) {
  ${wait}
  return pollUntil(() => q(), Boolean);
}`),
      ).toHaveLength(0);
      expect(
        run(`const q = async () => sql(u, 'select 1');
export async function f({ page }) {
  const before = await q();
  ${wait}
}`),
      ).toHaveLength(0);
    });
  });
});
