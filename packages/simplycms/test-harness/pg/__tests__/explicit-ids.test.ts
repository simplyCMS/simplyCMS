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

/**
 * Локальні аліаси Drizzle-таблиць: `import { orders as ordersTable }`.
 * 🔴 Без цього кроку скан був fail-open — незнайоме імʼя тихо
 * пропускалось, тож аліасована вставка не перевірялась узагалі.
 */
function aliasMap(
  src: string,
  tables: Map<string, string>,
): Map<string, string> {
  const resolved = new Map(tables);
  const importRe = /import\s*\{([^}]*)\}\s*from\s*'simplycms\/schema[^']*'/g;
  let im: RegExpExecArray | null;
  while ((im = importRe.exec(src)) !== null) {
    for (const part of im[1].split(',')) {
      const m = /^\s*([A-Za-z_$][\w$]*)\s+as\s+([A-Za-z_$][\w$]*)\s*$/.exec(
        part,
      );
      if (!m) continue;
      const table = tables.get(m[1]);
      if (table !== undefined) resolved.set(m[2], table);
    }
  }
  return resolved;
}

interface InsertSite {
  /** Шлях відносно `src/`. */
  file: string;
  /** Імʼя таблиці в SQL. */
  table: string;
  /** Текст того, що реально їде в БД. */
  payload: string;
  offset: number;
}

/**
 * Мапа «експорт Drizzle-таблиці → імʼя таблиці в SQL», обчислена один раз
 * при завантаженні модуля. Винесена на рівень модуля (а не аргумент
 * `discoverInsertsInSource`), щоб чиста функція нижче лишалась чистою —
 * без власного читання диска — і водночас негативний контроль міг
 * викликати її двома аргументами (`src`, `file`), як реальну вставку.
 */
const TABLES = drizzleTables();

/**
 * Дискаверить Drizzle-вставки в УЖЕ прочитаному тексті одного файлу:
 *   • `.insert(<таблиця>)…values(<payload>)`, де `<таблиця>` є
 *     експортом Drizzle-схеми (звірка з мапою відсікає `.insert(payload)`
 *     адмінки — там `payload` не таблиця). Приймається кваліфікована форма
 *     `.insert(schema.products)` і локальний АЛІАС імпорту
 *     (`import { orders as ordersTable }` → `.insert(ordersTable)`),
 *     резолвлений `aliasMap`.
 *
 * 🔴 Свідомо ПОЗА сканом лишаються дві форми, що не резолвляться статично:
 * `.insert(getTable(name))` (обчислене імʼя — виклик функції замість
 * ідентифікатора) і `.insert(schema[key])` (індексний доступ — ключ відомий
 * лише в рантаймі). Поява такої форми в ядрі — сигнал додати рантайм-
 * перевірку (як `plugin-table-id.test.ts` для сирого SQL нижче), а не
 * розширювати регекс.
 *
 * 🔴 Інша форма — сирий SQL — свідомо поза скану, і вона рівно одна:
 * `plugin-sdk/server/table-db.ts` збирає `insert into <plg_*>` через
 * `sql.identifier`. Там діє СИЛЬНІШИЙ гард — рантайм-перевірка `row.id`, що
 * кидає до звернення в БД (`plugin-table-id.test.ts`), а таблиця належить
 * плагіну, не ядру. Якщо в ядрі зʼявиться сирий INSERT у core-таблицю —
 * додавати сюди третій дискавер, а не мовчки покладатись на ревʼю.
 *
 * Чиста: жодного `readFileSync`/`readdirSync` — лише текст, переданий
 * викликачем, і `TABLES`, обчислена один раз при завантаженні модуля.
 */
function discoverInsertsInSource(src: string, file: string): InsertSite[] {
  const tables = aliasMap(src, TABLES);
  const sites: InsertSite[] = [];

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
    const chained = valuesAt >= 0 && (nextInsert < 0 || valuesAt < nextInsert);
    sites.push({
      file,
      table,
      offset: m.index,
      // Немає свого `.values(` — це не «безпечно», це невідомо: payload
      // порожній, і гейт червоніє.
      payload: chained
        ? callArgument(src, valuesAt + '.values('.length - 1)
        : '',
    });
  }
  return sites;
}

/** Обходить `root` і скликає {@link discoverInsertsInSource} для кожного файлу. */
function discoverInserts(root: string): InsertSite[] {
  const sites: InsertSite[] = [];
  for (const path of sourceFiles(root)) {
    if (path.includes('__tests__')) continue;
    const file = relative(root, path);
    const src = readFileSync(path, 'utf8');
    sites.push(...discoverInsertsInSource(src, file));
  }
  return sites;
}

const isExempt = (site: InsertSite): boolean => ID_FROM_DB.has(site.table);

/** Єдиний фільтр гейта: і реальний скан, і синтетичний кейс кличуть його. */
const offendersOf = (sites: InsertSite[]): InsertSite[] =>
  sites.filter((site) => !isExempt(site) && !hasIdField(site.payload));

describe('Е0: інваріант явного id у вставках ядра', () => {
  const sites = discoverInserts(SRC);

  it('скан узагалі щось знаходить — інакше гейт зелений через поламаний скан', () => {
    // Нижня межа, а не точне число: нові вставки в Е1–Е6 законні (гейт має
    // вимагати від них id, а не падати від їхньої появи), а от зникнення
    // всіх — ознака зламаного дискаверу, не чистого коду. На 2026-08-30
    // виміряно 12 drizzle-вставок у `src/`.
    expect(sites.length).toBeGreaterThanOrEqual(10);
  });

  it('кожна вставка поза іменованими виїмками передає id', () => {
    const offenders = offendersOf(sites)
      .map(
        (site) =>
          `${site.file}@${site.offset} → ${site.table} ${
            site.payload.slice(0, 80).replace(/\s+/g, ' ') || '<без values()>'
          }`,
      )
      .sort();
    expect(
      offenders,
      `вставок без id: ${offenders.length}\n${offenders.join('\n')}`,
    ).toEqual([]);
  });

  it('виїмки не розповзаються: у списку рівно ті таблиці, що обґрунтовані вище', () => {
    expect([...ID_FROM_DB].sort()).toEqual([
      'accounts',
      'sessions',
      'users',
      'verifications',
    ]);
  });
});

describe('Е0: дискавер id звіряє таблицю за значенням (аліаси)', () => {
  it('дискавер бачить аліасовану форму .insert(alias)', () => {
    // Синтетичне джерело: так виглядатиме вставка після
    // `import { orders as ordersTable } from 'simplycms/schema'`.
    const source = [
      "import { orders as ordersTable } from 'simplycms/schema';",
      'async function create(db) {',
      '  await db.insert(ordersTable).values({ userId: null });',
      '}',
    ].join('\n');

    const sites = discoverInsertsInSource(source, 'synthetic.ts');
    expect(
      sites.map((s) => s.table),
      'аліасована вставка мусить бути знайдена, інакше гейт fail-open',
    ).toContain('orders');
  });
});

describe('Е0: гейт бачить усю адмінку', () => {
  it('вставка без id у admin/pages — offender, виїмок за теками немає', () => {
    const source = 'await db.insert(products).values(payload);';
    const sites = discoverInsertsInSource(source, 'admin/pages/X.tsx');
    expect(offendersOf(sites)).toHaveLength(1);
  });

  it('апостроф у коментарі всередині values() не тягне аргумент до кінця файлу', () => {
    // Без пропуску коментарів у findMatchingClose `// don't` відкривав би
    // «рядок», аргумент першої вставки поглинав би `id:` другої — fail-open.
    const source = [
      "await db.insert(products).values({ // don't",
      "  name: 'x',",
      '});',
      "await db.insert(products).values({ id: newId(), name: 'y' });",
    ].join('\n');
    const offenders = offendersOf(
      discoverInsertsInSource(source, 'admin/x.ts'),
    );
    expect(offenders).toHaveLength(1);
    expect(offenders[0].offset).toBe(source.indexOf('.insert('));
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
