import { asc } from 'drizzle-orm';
import type { ActorDb } from 'simplycms/db';
import { languages } from 'simplycms/schema';
import type { Language } from 'simplycms/schema/types';

/** Рядок мови для вітрини: без службових полів. */
export type LanguageSummary = Pick<
  Language,
  'code' | 'name' | 'status' | 'isDefault' | 'sortOrder'
>;

/** Усі мови в порядку показу; фільтр за статусом — справа споживача (кодом). */
export async function readLanguages(db: ActorDb): Promise<LanguageSummary[]> {
  return db
    .select({
      code: languages.code,
      name: languages.name,
      status: languages.status,
      isDefault: languages.isDefault,
      sortOrder: languages.sortOrder,
    })
    .from(languages)
    .orderBy(asc(languages.sortOrder), asc(languages.code));
}
