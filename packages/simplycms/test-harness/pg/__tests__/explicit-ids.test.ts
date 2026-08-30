import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import {
  ID_FIELD,
  callArgument,
  hasIdField,
  sourceFiles,
} from '../insert-scan';

const SRC = resolve(import.meta.dirname, '../../../src');
const SCHEMA = resolve(SRC, 'schema');

/**
 * Гейт інваріанта Е0: **кожна** вставка в коді ядра передає `id` явно.
 *
 * 🔴 Це ДИСКАВЕРІ, а не список. Попередня редакція перелічувала десять пар
 * «файл → таблиця» і мовчала про одинадцяту: новий серверний insert, доданий
 * в Е1–Е6 (а Е1–Е6 — це і є хвилі нових серверних шляхів), не ловився нічим,
 * крім рантайм-`23502` у продакшні. Для етапу, чия цінність — «трек отримує
 * інваріант, на який спираються всі подальші етапи», знімок не годиться.
 * Тому: сканується вся тека `src/`, знайдені вставки — вимога, а виїмки
 * названі поіменно й обґрунтовані.
 *
 * 🔴 «Категорія» тут і в `id-defaults.test.ts` означає РІЗНІ речі, і плутати
 * їх не можна:
 *   • тут — площина КОДУ: «чи шлях вставки ПЕРЕДАЄ `id`»;
 *   • там — площина СХЕМИ: «чи колонка `id` має DEFAULT у БД».
 * До Е1а `orders` стояла в обох гейтах по РІЗНІ боки: сервер передавав
 * ключ явно (код — вимога виконана), а DEFAULT у БД лишався (схема —
 * виняток). Ревізія Е1а це закрила: `orders` перейшла в Категорію A і в
 * площині коду, і в площині схеми, тож сьогодні жодна таблиця не
 * демонструє асиметрії між ними — розрізнення лишається на випадок
 * майбутніх виїмок.
 */

/**
 * Єдина виїмка за ІМЕНЕМ ТАБЛИЦІ: рядки, чий `id` кладе БД, бо код його не
 * бачить. Better Auth із `generateId: 'uuid'` + `supportsUUIDs` драйвера не
 * кладе `id` в INSERT узагалі (`auth/instance.ts`), тож вимагати від нього
 * ключ ніде.
 *
 * 🔴 `orders` тут НЕМАЄ (і з Е1а вже не була б потрібна): сервер шле їй
 * ключ явно, а з Е1а й DEFAULT у БД знято — вона Категорія A в обох
 * площинах.
 */
const ID_FROM_DB = new Set(['users', 'sessions', 'accounts', 'verifications']);

/**
 * Єдина виїмка за ТЕКОЮ: застарілий шар адмінки на `supabase-js`. Він не
 * виконується на чистому Postgres і повністю переписується в Е1–Е6 (рішення
 * власника 2026-08-29). Його НЕ залишено без нагляду: кількість вставок без
 * `id` там зафіксована окремим ратчетом `tests/admin-inserts-need-id.test.ts`
 * і може лише зменшуватись.
 */
const EXEMPT_DIRS = ['admin/'];

/** Мапа «експорт Drizzle-таблиці → імʼя таблиці в SQL». */
function drizzleTables(): Map<string, string> {
  const map = new Map<string, string>();
  for (const file of sourceFiles(SCHEMA)) {
    if (file.includes('__tests__')) continue;
    const src = readFileSync(file, 'utf8');
    const re =
      /export\s+const\s+([A-Za-z_$][\w$]*)\s*=\s*pgTable\(\s*['"]([^'"]+)['"]/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(src)) !== null) map.set(m[1], m[2]);
  }
  return map;
}

interface InsertSite {
  /** Шлях відносно `src/`. */
  file: string;
  /** Імʼя таблиці в SQL. */
  table: string;
  /** Текст того, що реально їде в БД. */
  payload: string;
  /** Форма виклику — для читабельного повідомлення про падіння. */
  kind: 'drizzle' | 'supabase';
  offset: number;
}

/**
 * Дискаверить вставки двох форм, які тільки й існують у ядрі:
 *   • Drizzle — `.insert(<таблиця>)…values(<payload>)`, де `<таблиця>` є
 *     експортом Drizzle-схеми (звірка з мапою відсікає `.insert(payload)`
 *     адмінки — там `payload` не таблиця). Приймається і кваліфікована
 *     форма `.insert(schema.products)`;
 *   • supabase-js — `.from('<таблиця>').insert(<payload>)`.
 *
 * 🔴 Третя форма — сирий SQL — свідомо поза скану, і вона рівно одна:
 * `plugin-sdk/server/table-db.ts` збирає `insert into <plg_*>` через
 * `sql.identifier`. Там діє СИЛЬНІШИЙ гард — рантайм-перевірка `row.id`, що
 * кидає до звернення в БД (`plugin-table-id.test.ts`), а таблиця належить
 * плагіну, не ядру. Якщо в ядрі зʼявиться сирий INSERT у core-таблицю —
 * додавати сюди третій дискавер, а не мовчки покладатись на ревʼю.
 */
function discoverInserts(root: string): InsertSite[] {
  const tables = drizzleTables();
  const sites: InsertSite[] = [];

  for (const path of sourceFiles(root)) {
    if (path.includes('__tests__')) continue;
    const file = relative(root, path);
    const src = readFileSync(path, 'utf8');

    const drizzleRe =
      /\.insert\(\s*(?:[A-Za-z_$][\w$]*\.)?([A-Za-z_$][\w$]*)\s*\)/g;
    let m: RegExpExecArray | null;
    while ((m = drizzleRe.exec(src)) !== null) {
      const table = tables.get(m[1]);
      if (table === undefined) continue;
      // 🔴 `.values(` шукається ЛИШЕ до наступного `.insert(`: інакше
      // вставка без значень позичила б `values` наступної й тихо пройшла.
      const nextInsert = src.indexOf('.insert(', m.index + 1);
      const valuesAt = src.indexOf('.values(', m.index);
      const chained =
        valuesAt >= 0 && (nextInsert < 0 || valuesAt < nextInsert);
      sites.push({
        file,
        table,
        kind: 'drizzle',
        offset: m.index,
        // Немає свого `.values(` — це не «безпечно», це невідомо: payload
        // порожній, і гейт червоніє.
        payload: chained
          ? callArgument(src, valuesAt + '.values('.length - 1)
          : '',
      });
    }

    const supabaseRe = /\.from\(\s*['"]([^'"]+)['"]\s*\)\s*\.insert\(/g;
    while ((m = supabaseRe.exec(src)) !== null) {
      sites.push({
        file,
        table: m[1],
        kind: 'supabase',
        offset: m.index,
        payload: callArgument(src, m.index + m[0].length - 1),
      });
    }
  }
  return sites;
}

const isExempt = (site: InsertSite): boolean =>
  ID_FROM_DB.has(site.table) ||
  EXEMPT_DIRS.some((dir) => site.file.startsWith(dir));

describe('Е0: інваріант явного id у вставках ядра', () => {
  const sites = discoverInserts(SRC);

  it('скан узагалі щось знаходить — інакше гейт зелений через поламаний скан', () => {
    // Нижня межа, а не точне число: нові вставки в Е1–Е6 законні (гейт має
    // вимагати від них id, а не падати від їхньої появи), а от зникнення
    // всіх — ознака зламаного дискаверу, не чистого коду. На 2026-08-30
    // виміряно 12 drizzle-вставок у `src/`.
    expect(
      sites.filter((s) => s.kind === 'drizzle').length,
    ).toBeGreaterThanOrEqual(10);
    expect(sites.some((s) => s.kind === 'supabase')).toBe(true);
  });

  it('кожна вставка поза іменованими виїмками передає id', () => {
    const offenders = sites
      .filter((site) => !isExempt(site) && !hasIdField(site.payload))
      .map(
        (site) =>
          `${site.file}@${site.offset} → ${site.table} (${site.kind}): ${
            site.payload.slice(0, 80).replace(/\s+/g, ' ') || '<без values()>'
          }`,
      )
      .sort();
    expect(
      offenders,
      `вставок без id: ${offenders.length}\n${offenders.join('\n')}`,
    ).toEqual([]);
  });

  it('виїмки не розповзаються: у списку рівно ті таблиці й теки, що обґрунтовані вище', () => {
    expect([...ID_FROM_DB].sort()).toEqual([
      'accounts',
      'sessions',
      'users',
      'verifications',
    ]);
    expect(EXEMPT_DIRS).toEqual(['admin/']);
  });
});

describe('Е0: таблиці, чий id кладе БД, ключа НЕ отримують', () => {
  const sites = discoverInserts(SRC).filter((site) =>
    ID_FROM_DB.has(site.table),
  );

  it('Better Auth-таблиці знайдені скану відомі', () => {
    expect(sites.length).toBeGreaterThan(0);
  });

  it.each(['users', 'verifications'])('%s лишається на DEFAULT', (table) => {
    for (const site of sites.filter((s) => s.table === table)) {
      expect(
        site.payload,
        `${site.file}@${site.offset}: ${table} — ключ генерує БД, код його не шле`,
      ).not.toMatch(ID_FIELD);
    }
  });
});
