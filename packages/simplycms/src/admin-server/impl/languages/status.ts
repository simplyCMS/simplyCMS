import { eq, sql } from 'drizzle-orm';
import type { ActorDb } from 'simplycms/db';
import {
  buildMissingProjection,
  dropLocaleProjection,
  missingProjectionRows,
} from 'simplycms/catalog-projection';
import { z } from 'zod';
import { defineOperation } from 'simplycms/operations';
import { languages } from 'simplycms/schema';
import type { Language } from 'simplycms/schema/types';
import { CACHE_KEYS, bumpCacheGeneration } from 'simplycms/site';
import { completeness, languageIncompleteError } from './completeness';
import { stuckFill } from './fill';
import {
  code,
  invalid,
  load,
  lockLanguageSet,
  status,
  toView,
  view,
} from './view';

/** Дозволені переходи не-основної мови (§3.5); основна не переходить ніде. */
const TRANSITIONS: Readonly<Record<Language['status'], readonly string[]>> = {
  draft: ['published', 'disabled'],
  published: ['disabled'],
  disabled: ['draft', 'published'],
};

/** Розмір пакета дозбірки проєкції в одній транзакції переходу. */
const PROJECTION_BATCH = 2000;

/**
 * Дозбирає всю відсутню проєкцію мови (замок `languages-set` ексклюзивний — гонки немає).
 * Запобіжник (I-2): пакет нічого не вставив, а `missingProjectionRows` (той самий
 * предикат, з якого будує етап) ще щось бачить — етап розійшовся з вибором; відмова
 * з переліком id замість мовчазної неповної проєкції.
 */
async function buildProjection(db: ActorDb, code: string): Promise<void> {
  while ((await buildMissingProjection(db, code, PROJECTION_BATCH)) > 0);
  const left = await db.execute<{ id: string }>(sql`
    select distinct product_id as id from (${missingProjectionRows(code)}) e
     order by 1 limit 50`);
  if (left.rows.length > 0)
    throw stuckFill(
      'setStatus',
      code,
      left.rows.map((r) => r.id),
    );
}

export const languagesSetStatus = defineOperation({
  id: 'languages.setStatus',
  permission: 'settings.manage',
  input: z.object({ code, status }),
  output: view,
  async run({ db }, input) {
    // Замок до читання рядка; для публікації він же гарантує, що повноту
    // міряємо, коли жодна транзакція з адресами ще не закомічується.
    await lockLanguageSet(db);
    const row = await load(db, input.code);
    if (row.status === input.status) return toView(row);
    if (row.isDefault || !TRANSITIONS[row.status].includes(input.status))
      throw invalid('status');
    const [updated] = await db
      .update(languages)
      .set({ status: input.status })
      .where(eq(languages.code, input.code))
      .returning();
    // Проєкція тексту живе лише в `draft`/`published` (§3.5): вихід у `disabled`
    // її знімає, повернення — дозбирає з адрес і джерела, що з'явились за час вимкнення.
    if (input.status === 'disabled') await dropLocaleProjection(db, input.code);
    else if (row.status === 'disabled') await buildProjection(db, input.code);
    // Повноту міряємо ПІСЛЯ зміни статусу (набір мов проєкції — з `languages`):
    // відмова відкочує всю транзакцію, тож мова лишається в попередньому статусі.
    if (input.status === 'published') {
      const c = await completeness(db, input.code);
      if (!c.complete) throw languageIncompleteError(c.incomplete);
    }
    await bumpCacheGeneration(db, CACHE_KEYS.languages);
    return toView(updated!);
  },
});
