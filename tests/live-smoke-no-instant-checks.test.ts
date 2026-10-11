import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const DIR = join(ROOT, 'scripts/live-smoke');

/**
 * Ратчет миттєвих читань UI у кроках `live:smoke`.
 *
 * Що стереже і чому: `locator.count()`, `.isVisible()`, `.isHidden()` читають
 * DOM ОДРАЗУ, без очікування. Інтерфейс сходиться асинхронно (мутація →
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
 * вжиток зник (або поменшав), теж червоніє — прибери/зменш його.
 */
export const INSTANT_CHECK_EXEMPTIONS: readonly {
  file: string;
  /** Скільки миттєвих викликів у файлі дозволено. */
  count: number;
  reason: string;
}[] = [
  {
    file: 'admin-discounts-buyer.mjs',
    count: 1,
    reason:
      'читається після дочеканого `unit` (рядок кошика видно); і «назва є», і «назви немає» — на вже відрендереному рядку',
  },
  {
    file: 'admin-dictionaries.mjs',
    count: 1,
    reason:
      'спершу `listbox` дочекано (інакше нуль був би «ще не відрендерилось»); очікуваний результат — нуль опцій',
  },
  {
    file: 'admin-system-themes.mjs',
    count: 1,
    reason:
      'після `header.w-full` і (для solar) дочекання `SOLAR_HEADER`; негативний випадок «не solar» не має чекати таймаут',
  },
  {
    file: 'admin-customers-owner.mjs',
    count: 1,
    reason:
      'після `row.first().waitFor`; число повертається викликачу для строгої перевірки «рівно 1» (дубль-рядок — дефект)',
  },
  {
    file: 'admin-shipping-buyer.mjs',
    count: 1,
    reason:
      'відсутність нової назви читається після дочеканого `waitText(oldName)` — сторінка вже відрендерена',
  },
  {
    file: 'admin-shipping-orders.mjs',
    count: 1,
    reason:
      'відсутність нової назви точки на картці читається після дочеканого `waitText` старої',
  },
];

const INSTANT = /\.isVisible\(|\.isHidden\(|\.count\(\)/g;

/** Лише код: коментарі з поясненням «чому не isVisible» не рахуються. */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
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

const files = walk(DIR).filter((f) => !f.endsWith('/wait.mjs'));
const counts = new Map<string, number>();
for (const f of files) {
  const n = (stripComments(readFileSync(f, 'utf8')).match(INSTANT) ?? [])
    .length;
  if (n > 0) counts.set(relative(DIR, f).replaceAll('\\', '/'), n);
}

describe('миттєві читання UI у live-smoke', () => {
  it('поза списком виїмок миттєвих .count()/.isVisible()/.isHidden() немає', () => {
    const over = [...counts]
      .filter(
        ([file, n]) =>
          n >
          (INSTANT_CHECK_EXEMPTIONS.find((e) => e.file === file)?.count ?? 0),
      )
      .map(([file, n]) => `${file}: ${n}`);
    expect(
      over,
      'миттєве читання DOM на асинхронному UI — флейк; використай expectVisible/expectGone/expectCount/expectSome з scripts/live-smoke/wait.mjs',
    ).toEqual([]);
  });

  it('список виїмок не містить мертвих записів', () => {
    const dead = INSTANT_CHECK_EXEMPTIONS.filter(
      (e) => (counts.get(e.file) ?? 0) !== e.count,
    ).map(
      (e) =>
        `${e.file}: у списку ${e.count}, у файлі ${counts.get(e.file) ?? 0}`,
    );
    expect(
      dead,
      'вжиток зник або поменшав — прибери/зменш запис, список лише скорочується',
    ).toEqual([]);
  });

  it('кожна виїмка має причину', () => {
    expect(
      INSTANT_CHECK_EXEMPTIONS.filter((e) => e.reason.trim() === ''),
    ).toEqual([]);
  });
});
