import { describe, expect, it } from 'vitest';
import { getTableColumns, getTableName, is, Table } from 'drizzle-orm';
import { MEDIA_COLUMNS } from 'simplycms/domain/media';
import * as schema from 'simplycms/schema';

/**
 * Нова медіа-колонка в схемі мусить зʼявитись і в реєстрі `MEDIA_COLUMNS`.
 *
 * 🔴 Тест живе в КОРЕНЕВІЙ `tests/`, а не в `packages/simplycms/src/schema/
 * __tests__/`, як спершу написав план: `schema` і `domain` — оба тір T1
 * (`eslint.tier-zones.mjs`), і зона забороняє імпорт НАВІТЬ у межах одного
 * шару (не лише вгору) — `no-restricted-imports` ловить `simplycms/domain/*`
 * усередині `src/schema/**` як помилку. Гейт парності двох T1-модулів за
 * своєю природою мусить стояти ПОЗА обома зонами — так само, як
 * `tests/tier-boundary.test.ts` стоїть поза усіма зонами одразу.
 * Перенесення — зміна розкладки файлу (ОРІЄНТИР розділу «Ступінь
 * обовʼязковості»), а не самої тір-межі (КАНОН): жоден рядок
 * `eslint.tier-zones.mjs` не займано.
 *
 * 🔴 Евристика навмисно ШИРША за реєстр: усе, що зветься `image*`, `*_image*`,
 * `avatar*` або `images`. Хибне спрацювання лікується одним рядком у реєстрі
 * (або в `NOT_MEDIA` нижче з причиною) — пропущена колонка коштувала б
 * зламаної картинки на живій вітрині.
 */
const LOOKS_LIKE_MEDIA = /^(images|avatar_url|.*image_url|image)$/;

/**
 * Колонки, що збігаються з евристикою, але медіа НЕ несуть.
 *
 * `users.image` — канонічне поле схеми Better Auth (`getAuthTables`),
 * породжене адаптером незалежно від того, чи застосунок ним користується.
 * Ніщо в кодовій базі його не пише й не читає — аватар покупця живе в
 * `profiles.avatar_url` (Task 5), а не тут; звести їх в одне поле означало б
 * дати серверному auth-контуру писати в доменну колонку вітрини.
 */
const NOT_MEDIA: readonly string[] = ['users.image'];

describe('реєстр медіа-колонок', () => {
  const found: string[] = [];
  for (const value of Object.values(schema)) {
    if (!is(value, Table)) continue;
    const table = getTableName(value);
    for (const column of Object.values(getTableColumns(value))) {
      if (LOOKS_LIKE_MEDIA.test(column.name))
        found.push(`${table}.${column.name}`);
    }
  }

  it('кожна медіа-колонка схеми є в MEDIA_COLUMNS', () => {
    const registered = new Set(
      MEDIA_COLUMNS.map((c) => `${c.table}.${c.column}`),
    );
    const missing = found
      .filter((key) => !registered.has(key))
      .filter((key) => !NOT_MEDIA.includes(key));
    expect(missing, 'додай у MEDIA_COLUMNS або в NOT_MEDIA з причиною').toEqual(
      [],
    );
  });

  it('у MEDIA_COLUMNS немає записів без колонки в схемі', () => {
    const actual = new Set(found);
    const stale = MEDIA_COLUMNS.map((c) => `${c.table}.${c.column}`).filter(
      (key) => !actual.has(key),
    );
    expect(stale, 'колонку перейменували або прибрали').toEqual([]);
  });
});
