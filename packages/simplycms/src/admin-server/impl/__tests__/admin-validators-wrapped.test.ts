// Тема 12: механізм конвертації Zod → ValidationError живе у валідаторі, тож
// його слід застосувати до КОЖНОГО serverFn адмінки. Голий `.validator(schema)`
// мовчки повернув би сирий JSON у тост (Start кидає
// `Error(JSON.stringify(issues))` для будь-якої Standard-схеми) — гейт тут.
//
// Гард А: УСІ не-тестові файли `admin-server/**` — кожен `.validator(...)` це
// `adminInput(...)` або ім'я з явного списку `NON_SCHEMA_VALIDATORS`.
// Гард Б: УСІ файли пакета з `.validator(` — або `admin-server`, або в явному
// переліку `UNWRAPPED_BY_DESIGN` (з причиною): новий файл не вислизне тихо.
import { describe, expect, it } from 'vitest';

const raw = (glob: Record<string, string>) => glob;
const sources = raw(
  import.meta.glob(['../../**/*.ts', '!../../**/__tests__/**'], {
    query: '?raw',
    import: 'default',
    eager: true,
  }) as Record<string, string>,
);
const allSources = raw(
  import.meta.glob(['../../../**/*.{ts,tsx}', '!../../../**/__tests__/**'], {
    query: '?raw',
    import: 'default',
    eager: true,
  }) as Record<string, string>,
);

/** Ключ glob (відносно `__tests__`) → шлях від `src/`: `admin-server/impl/…`. */
const rel = (key: string) =>
  new URL(key, 'file:///src/admin-server/impl/__tests__/').pathname.replace(
    '/src/',
    '',
  );

/** Валідатори не на Zod-схемі: ім'я функції, а не регекс по тексту. */
const NON_SCHEMA_VALIDATORS = ['uploadFormInput'];

/** Файли ПОЗА `admin-server` із голими валідаторами — свідомо, з причиною. */
const UNWRAPPED_BY_DESIGN: Record<string, string> = {
  'themes/server/index.ts': 'bootstrap-синхронізація тем, не форма адмінки',
  'plugins/server/index.ts':
    'bootstrap-синхронізація плагінів, не форма адмінки',
  'plugin-sdk/server/index.ts':
    'зовнішній контракт plugin-sdk: помилки віддаються плагінам як Error',
};
/** Вітрина й кабінет: не адмін-форми, помилки полів там не розкладаються. */
const STOREFRONT = /^(core\/lib|storefront-routes\/server)\//;

/** Усі аргументи `.validator(...)` — до відповідної `)` на рівні дужок. */
function validatorArgs(src: string): string[] {
  const out: string[] = [];
  const re = /\.validator\(/g;
  while (re.exec(src)) {
    let depth = 1;
    let i = re.lastIndex;
    while (depth > 0 && i < src.length) {
      if (src[i] === '(') depth++;
      else if (src[i] === ')') depth--;
      i++;
    }
    out.push(src.slice(re.lastIndex, i - 1).trim());
  }
  return out;
}

const isWrapped = (a: string) => a.startsWith('adminInput(') && a.endsWith(')');

describe('admin-server: валідатори serverFn', () => {
  const files = Object.entries(sources).filter(
    ([, src]) => validatorArgs(src).length > 0,
  );
  // `validation.ts` описує валідатор у коментарі й сигнатурі — не серверFn.
  const serverFnFiles = files.filter(
    ([path]) => !path.endsWith('/validation.ts'),
  );

  it('гард бачить файл із serverFn (не порожній)', () => {
    const index = serverFnFiles.find(([p]) => p === '../../index.ts');
    expect(validatorArgs(index![1]).length).toBeGreaterThan(50);
  });

  it('кожен валідатор у КОЖНОМУ файлі admin-server — adminInput(...) або явне ім’я', () => {
    const bad = serverFnFiles.flatMap(([path, src]) =>
      validatorArgs(src)
        .filter((a) => !isWrapped(a) && !NON_SCHEMA_VALIDATORS.includes(a))
        .map((a) => `${path}: ${a}`),
    );
    expect(bad).toEqual([]);
  });

  it('явні винятки справді вжиті (список не застарів)', () => {
    const used = new Set(
      serverFnFiles.flatMap(([, src]) => validatorArgs(src)),
    );
    for (const name of NON_SCHEMA_VALIDATORS) expect(used.has(name)).toBe(true);
  });
});

describe('пакет: файли з `.validator(` поза admin-server', () => {
  const outside = Object.entries(allSources)
    .map(([path, src]) => [rel(path), src] as const)
    .filter(
      ([path, src]) =>
        !path.startsWith('admin-server/') && validatorArgs(src).length > 0,
    );

  it('кожен — у переліку свідомо не загорнутих (або це вітрина)', () => {
    const unknown = outside
      .map(([path]) => path)
      .filter((p) => !(p in UNWRAPPED_BY_DESIGN) && !STOREFRONT.test(p));
    expect(unknown).toEqual([]);
  });

  it('перелік не містить застарілих записів', () => {
    const present = new Set(outside.map(([p]) => p));
    for (const p of Object.keys(UNWRAPPED_BY_DESIGN))
      expect(present.has(p), p).toBe(true);
  });
});
