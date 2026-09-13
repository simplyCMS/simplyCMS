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
 * 🔴 Чого НЕ доводить, і це навмисно сказано вголос:
 *   • що названий резолвер застосовано саме до цього аліаса (перевіряється
 *     присутність ідентифікатора у файлі, не граф даних);
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

/** Сайт проєкції → ідентифікатор резолвера, який мусить бути в тому ж файлі. */
const RESOLVED_BY: Record<string, string> = {
  'profile.ts#avatar_url': 'resolveMediaUrl',
  'reviews.ts#avatar_url': 'resolveMediaUrl',
  'products.ts#images': 'toImageList',
  'entities/product.ts#images': 'toImageList',
  'entities/home-product.ts#images': 'toImageList',
  'entities/modification.ts#images': 'toImageList',
  'entities/banner.ts#image_url': 'resolveMediaUrl',
  'entities/banner.ts#desktop_image_url': 'resolveMediaUrl',
  'entities/banner.ts#mobile_image_url': 'resolveMediaUrl',
  'entities/section.ts#image_url': 'resolveMediaUrl',
  'entities/property.ts#image_url': 'resolveMediaUrl',
};

/** Проєкції, де потрібен саме РЕФЕРЕНС, а не URL. Кожна — з причиною. */
const RAW_READS: Record<string, string> = {
  'avatar.ts#avatarUrl':
    'шлях ЗАПИСУ: значення йде в `eraseMedia`/`profiles.avatar_url`, ' +
    'а сховище адресується ключем, не URL',
};

describe('резолв медіа-колонок при читанні', () => {
  const refs = schemaRefs();
  const sites: { site: string; file: string; source: string }[] = [];
  for (const file of loaderFiles(LOADERS)) {
    const source = readFileSync(file, 'utf8');
    const rel = relative(LOADERS, file);
    for (const ref of refs) {
      const pattern = new RegExp(
        `([A-Za-z_]\\w*)\\s*:\\s*${ref.expr.replace('.', '\\.')}\\b`,
        'g',
      );
      for (const match of source.matchAll(pattern))
        sites.push({ site: `${rel}#${match[1]}`, file: rel, source });
    }
  }

  it('дискавер бачить проєкції — інакше гейт зелений через порожній вхід', () => {
    expect(sites.length).toBeGreaterThanOrEqual(
      Object.keys(RESOLVED_BY).length,
    );
  });

  it('кожна проєкція названа резолвером або внесена в RAW_READS', () => {
    const unknown = sites
      .map((s) => s.site)
      .filter((site) => !(site in RESOLVED_BY) && !(site in RAW_READS));
    expect(
      [...new Set(unknown)],
      'нове читання медіа-колонки: назви резолвер у RESOLVED_BY або внеси в RAW_READS з причиною',
    ).toEqual([]);
  });

  it('названий резолвер справді присутній у файлі проєкції', () => {
    const silent = sites
      .filter((s) => s.site in RESOLVED_BY)
      .filter((s) => !new RegExp(`\\b${RESOLVED_BY[s.site]}\\b`).test(s.source))
      .map((s) => `${s.site} → ${RESOLVED_BY[s.site]}`);
    expect(
      [...new Set(silent)],
      'колонка читається сирим референсом — на вітрині це бита картинка',
    ).toEqual([]);
  });

  it('у реєстрах гейта немає записів без проєкції в коді', () => {
    const actual = new Set(sites.map((s) => s.site));
    const stale = [...Object.keys(RESOLVED_BY), ...Object.keys(RAW_READS)]
      .filter((site) => !actual.has(site))
      .sort();
    expect(stale, 'проєкцію прибрали або перейменували').toEqual([]);
  });
});
