import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { getTableColumns, getTableName, is, Table } from 'drizzle-orm';
import { MEDIA_COLUMNS } from 'simplycms/domain/media';
import * as schema from 'simplycms/schema';

/**
 * Кожна проєкція медіа-колонки в лоадерах вітрини має НАЗВАНОГО резолвера.
 *
 * 🔴 Гейт народився з дефекту, який проїхав рев'ю: `loadReviewAuthors`
 * віддавав `profiles.avatar_url` сирим референсом, і `ReviewCard` клав його
 * просто в `src`. Сусідній `loadProfile` ту саму колонку резолвив — тобто
 * реєстр `MEDIA_COLUMNS` був повний, а КОЛОНКА мала і правильного, і
 * неправильного читача. Гейт покриття (`tests/media-columns-coverage.test.ts`)
 * звіряє реєстр зі схемою й такого розходження не бачить за побудовою.
 *
 * 🔴 Що цей гейт доводить: жодна проєкція виду `alias: table.mediaColumn`
 * у `storefront/loaders/**` не зʼявиться непоміченою — її треба або назвати
 * резолвером (і той резолвер мусить бути присутній у ТОМУ Ж файлі), або
 * свідомо внести в `RAW_READS` із причиною.
 *
 * 🔴 Перевіряється ФОРМА ВИКЛИКУ `alias: resolver(`, а не присутність
 * ідентифікатора у файлі: попередня редакція задовольнялась рядком імпорту,
 * тож зняття самого виклику з чотирьох сайтів (`profile.ts`, дві колонки
 * банера, `entities/property.ts`) лишало гейт зеленим.
 *
 * 🔴 Чого НЕ доводить, і це навмисно сказано вголос:
 *   • що резолвер застосовано саме до ТОГО значення, яке проєктується
 *     (звіряється текст лівої й правої частини, не граф даних);
 *   • читання цілим рядком (`db.select().from(banners)` без проєкції) —
 *     їх ловить лише мапер сутності;
 *   • читачів поза `storefront/loaders/**` — адмінка (`src/admin/**`) досі
 *     на supabase-js і переписується треком К3.
 * Тобто «кожен запис резолвиться при читанні» — обіцянка ширша за гейт;
 * докблок `domain/media.ts` тепер каже рівно те, що тут перевіряється.
 */
const LOADERS = join(
  import.meta.dirname,
  '../packages/simplycms/src/storefront/loaders',
);

/** Колонка реєстру → як вона зветься в коді: `productReviews.images`. */
function schemaRefs(): { id: string; expr: string }[] {
  const refs: { id: string; expr: string }[] = [];
  for (const entry of MEDIA_COLUMNS) {
    for (const [exportName, value] of Object.entries(schema)) {
      if (!is(value, Table) || getTableName(value) !== entry.table) continue;
      for (const [prop, column] of Object.entries(getTableColumns(value))) {
        if (column.name !== entry.column) continue;
        refs.push({
          id: `${entry.table}.${entry.column}`,
          expr: `${exportName}.${prop}`,
        });
      }
    }
  }
  return refs;
}

function loaderFiles(dir: string): string[] {
  const out: string[] = [];
  for (const item of readdirSync(dir, { withFileTypes: true })) {
    if (item.name === '__tests__') continue;
    const full = join(dir, item.name);
    if (item.isDirectory()) out.push(...loaderFiles(full));
    else if (item.name.endsWith('.ts')) out.push(full);
  }
  return out;
}

/** Сайт проєкції → резолвер, виклик якого мусить стояти в тому ж файлі. */
const RESOLVED_BY: Record<string, string> = {
  'profile.ts#avatar_url': 'resolveMediaUrl',
  'reviews.ts#avatar_url': 'resolveMediaUrl',
  'products.ts#images': 'toImageList',
  'entities/home-product.ts#images': 'toImageList',
  'entities/modification.ts#images': 'toImageList',
  'entities/banner.ts#image_url': 'resolveMediaUrl',
  'entities/banner.ts#desktop_image_url': 'resolveMediaUrl',
  'entities/banner.ts#mobile_image_url': 'resolveMediaUrl',
  'entities/section.ts#image_url': 'resolveMediaUrl',
  'entities/property.ts#image_url': 'resolveMediaUrl',
};

/**
 * Проєкції, які резолвить не свій файл, а СПОЖИВАЧІ — з поіменним переліком.
 *
 * 🔴 Випадок рівно один і він конструктивний: `entities/product.ts` — чиста
 * колонкова мапа плюс визначення самої `toImageList`, тож форми виклику
 * `images: toImageList(` у ньому нема й бути не може. Замість послаблення
 * гейта на весь реєстр — список файлів, де ця форма справді стоїть: зняти
 * резолв у будь-якому з них так само червоно, як лишити проєкцію мовчазною.
 */
const RESOLVED_BY_CONSUMERS: Record<
  string,
  { resolver: string; files: readonly string[] }
> = {
  'entities/product.ts#images': {
    resolver: 'toImageList',
    files: [
      'products.ts',
      'product-detail.ts',
      'entities/home-product.ts',
      'entities/modification.ts',
    ],
  },
};

/**
 * Форма ВИКЛИКУ, а не згадка: рядок імпорту її не задовольняє.
 *
 * `\b` перед аліасом обовʼязковий — інакше `desktop_image_url: resolve…`
 * зарахувався б за проєкцію `image_url`.
 */
const callForm = (alias: string, resolver: string): RegExp =>
  new RegExp(`\\b${alias}\\s*:\\s*${resolver}\\s*\\(`);

/** Проєкції, де потрібен саме РЕФЕРЕНС, а не URL. Кожна — з причиною. */
const RAW_READS: Record<string, string> = {
  'avatar.ts#avatarUrl':
    'шлях ЗАПИСУ: значення йде в `eraseMedia`/`profiles.avatar_url`, ' +
    'а сховище адресується ключем, не URL',
};

describe('резолв медіа-колонок при читанні', () => {
  const refs = schemaRefs();
  const sources = new Map<string, string>();
  const sites: { site: string; alias: string; source: string }[] = [];
  for (const file of loaderFiles(LOADERS)) {
    const source = readFileSync(file, 'utf8');
    const rel = relative(LOADERS, file).replaceAll('\\', '/');
    sources.set(rel, source);
    for (const ref of refs) {
      const pattern = new RegExp(
        `([A-Za-z_]\\w*)\\s*:\\s*${ref.expr.replace('.', '\\.')}\\b`,
        'g',
      );
      for (const match of source.matchAll(pattern))
        sites.push({ site: `${rel}#${match[1]}`, alias: match[1], source });
    }
  }

  it('дискавер бачить проєкції — інакше гейт зелений через порожній вхід', () => {
    expect(sites.length).toBeGreaterThanOrEqual(
      Object.keys(RESOLVED_BY).length +
        Object.keys(RESOLVED_BY_CONSUMERS).length,
    );
  });

  it('кожна проєкція названа резолвером або внесена в RAW_READS', () => {
    const unknown = sites
      .map((s) => s.site)
      .filter(
        (site) =>
          !(site in RESOLVED_BY) &&
          !(site in RESOLVED_BY_CONSUMERS) &&
          !(site in RAW_READS),
      );
    expect(
      [...new Set(unknown)],
      'нове читання медіа-колонки: назви резолвер у RESOLVED_BY або внеси в RAW_READS з причиною',
    ).toEqual([]);
  });

  it('резолвер стоїть у формі ВИКЛИКУ, а не лише імпортований', () => {
    const silent = sites
      .filter((s) => s.site in RESOLVED_BY)
      .filter((s) => !callForm(s.alias, RESOLVED_BY[s.site]).test(s.source))
      .map((s) => `${s.site} → ${RESOLVED_BY[s.site]}(`);
    expect(
      [...new Set(silent)],
      'колонка читається сирим референсом — на вітрині це бита картинка',
    ).toEqual([]);
  });

  it('проєкція під споживачами резолвиться в КОЖНОМУ названому файлі', () => {
    const silent: string[] = [];
    for (const [site, { resolver, files }] of Object.entries(
      RESOLVED_BY_CONSUMERS,
    )) {
      const alias = site.slice(site.indexOf('#') + 1);
      for (const file of files) {
        const source = sources.get(file);
        if (source === undefined || !callForm(alias, resolver).test(source))
          silent.push(`${site} → ${file}`);
      }
    }
    expect(
      silent,
      'споживач читає колонку сирим референсом (або файл зник) — на вітрині це бита картинка',
    ).toEqual([]);
  });

  it('у реєстрах гейта немає записів без проєкції в коді', () => {
    const actual = new Set(sites.map((s) => s.site));
    const stale = [
      ...Object.keys(RESOLVED_BY),
      ...Object.keys(RESOLVED_BY_CONSUMERS),
      ...Object.keys(RAW_READS),
    ]
      .filter((site) => !actual.has(site))
      .sort();
    expect(stale, 'проєкцію прибрали або перейменували').toEqual([]);
  });
});
