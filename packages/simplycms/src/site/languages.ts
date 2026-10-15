import { asc } from 'drizzle-orm';
import type { ActorDb } from 'simplycms/db';
import { languages } from 'simplycms/schema';
import type { Language } from 'simplycms/schema/types';
import type { LocaleSet } from 'simplycms/i18n';

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

/**
 * Набір мов запиту з рядків мов. Основна — єдина з `isDefault`; вона завжди
 * опублікована (машина станів мов), тож `published` її містить. Відсутність
 * основної — дефект БД (сід її створює), і тиха підміна зробила б будь-яку
 * адресу «основною мовою невідомо якою».
 */
export function toLocaleSet(rows: readonly LanguageSummary[]): LocaleSet {
  const primary = rows.find((r) => r.isDefault);
  if (!primary) {
    throw new Error('[simplycms/site] у БД немає основної мови (is_default)');
  }
  return {
    primary: primary.code,
    published: rows.filter((r) => r.status === 'published').map((r) => r.code),
    known: rows.map((r) => r.code),
  };
}
