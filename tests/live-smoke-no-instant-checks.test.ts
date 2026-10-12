import { describe, expect, it } from 'vitest';
import { INSTANT_CHECK_EXEMPTIONS } from './live-smoke-no-instant-checks/data';
import {
  findInstantReads,
  keyOf,
  scanLiveSmoke,
  uncovered,
} from './live-smoke-no-instant-checks/scan';

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
});
