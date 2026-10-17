// Статуси перекладів (майстер §3.4) — чиста логіка T1.
//
// 🔴 Хешів тут НЕ рахують: sha256 потребує `node:crypto`, а цей модуль
// імпортує й клієнт адмінки (бейджі статусів). Хеш поточного джерела приходить
// у `SourceRow.currentHashes` готовим — його рахує сервер (`simplycms/translations`)
// й передає сюди як `hash`.
import { hasText } from './text';

/** Статус поля або рядка перекладу відносно поточного джерела. */
export type FieldStatus = 'current' | 'outdated' | 'missing';

/**
 * Опис перекладної сутності: які поля перекладаються й які з них обов'язкові.
 * `richHtml` — підмножина `fields`, що несе санітизований HTML: його хеш береться
 * від уже очищеної розмітки (санітизує викликач), а порожнечу визначає розмітка
 * (`<p></p>` — не текст).
 */
export interface TranslatableSpec {
  readonly fields: readonly string[];
  readonly required: readonly string[];
  readonly richHtml?: readonly string[];
}

/**
 * Рядок локалізованих полів, як він лежить у БД. `hashes` рядка перекладу —
 * `source_hashes`: хеш джерела на мить, коли поле перекладали. У рядка
 * основної мови `source_hashes` = `{}`, тож як джерело для статусів його
 * передавати не можна — для цього є `SourceRow`.
 */
export interface TranslationRow {
  readonly values: Readonly<Record<string, string | null | undefined>>;
  readonly hashes?: Readonly<Record<string, string>>;
}

/**
 * Рядок-ДЖЕРЕЛО з хешами його ПОТОЧНОГО тексту. Окремий тип (поле називається
 * інакше, ніж `hashes`), щоб рядок основної мови з БД не можна було передати
 * `rowStatus` як є: його `source_hashes` порожні, і всі переклади стали б
 * `outdated`. Збирається `toSourceRow`.
 */
export interface SourceRow {
  readonly values: Readonly<Record<string, string | null | undefined>>;
  readonly currentHashes: Readonly<Record<string, string>>;
}

/** Чи розмітка поля rich-HTML (порожнеча за розміткою, а не за пробілами). */
export function isRichField(spec: TranslatableSpec, field: string): boolean {
  return spec.richHtml?.includes(field) ?? false;
}

/** Чи має значення поля `field` текст за правилами `spec`. */
export function fieldHasText(
  spec: TranslatableSpec,
  field: string,
  value: string | null | undefined,
): value is string {
  return hasText(value, isRichField(spec, field));
}

/**
 * Рядок-джерело для статусів: значення + хеші поточного тексту через
 * інжектовану функцію хешу. Поле без тексту хеша не має.
 */
export function toSourceRow(
  spec: TranslatableSpec,
  values: SourceRow['values'],
  hash: (text: string) => string,
): SourceRow {
  const currentHashes: Record<string, string> = {};
  for (const field of spec.fields) {
    const text = values[field];
    if (fieldHasText(spec, field, text)) currentHashes[field] = hash(text);
  }
  return { values, currentHashes };
}

/**
 * Статус одного поля НЕ-джерела; `rich` — поле зі `spec.richHtml`.
 *
 * Відсутність хеша і порожнє джерело (`currentSourceHash === null`) рівні:
 * переклад, зроблений, коли джерело було порожнім, лишається `current`, а коли
 * джерело потім очистили (хеш був, джерела немає) — `outdated`.
 */
export function fieldStatus(
  target: string | null,
  recordedHash: string | undefined,
  currentSourceHash: string | null,
  rich: boolean,
): FieldStatus {
  if (!hasText(target, rich)) return 'missing';
  return (recordedHash ?? null) === currentSourceHash ? 'current' : 'outdated';
}

/**
 * Статус рядка перекладу: `missing` — рядка немає або порожнє обов'язкове поле;
 * `outdated` — є застаріле заповнене поле; інакше `current`. Порожнє
 * НЕобов'язкове поле статус рядка не псує: його неповноту ловить
 * `isTranslatedForSeo`.
 */
export function rowStatus(
  spec: TranslatableSpec,
  source: SourceRow,
  target: TranslationRow | null,
): FieldStatus {
  if (!target) return 'missing';
  if (spec.required.some((f) => !fieldHasText(spec, f, target.values[f])))
    return 'missing';
  const outdated = spec.fields.some((field) => {
    const text = target.values[field];
    return (
      fieldHasText(spec, field, text) &&
      fieldStatus(
        text,
        target.hashes?.[field],
        source.currentHashes[field] ?? null,
        isRichField(spec, field),
      ) === 'outdated'
    );
  });
  return outdated ? 'outdated' : 'current';
}

/**
 * Поля, чий текст на вітрині береться з основної мови (fallback): непорожні в
 * джерелі й порожні (або рядка перекладу немає) в мові. Ознака з ДАНИХ, а не з
 * порівняння текстів: переклад, буквально рівний джерелу («iPhone 15»), НЕ fallback.
 * Порядок — як у `spec.fields`; SQL-двійник — `fallback_fields` проєкції.
 */
export function fallbackFieldsOf(
  spec: TranslatableSpec,
  source: Pick<TranslationRow, 'values'>,
  target: Pick<TranslationRow, 'values'> | null,
): string[] {
  return spec.fields.filter(
    (field) =>
      fieldHasText(spec, field, source.values[field]) &&
      !fieldHasText(spec, field, target?.values[field]),
  );
}

/**
 * «Перекладено» для SEO (§3.4): кожне поле, НЕпорожнє в джерелі, непорожнє й у
 * мові. `outdated` рахується перекладеним (текст є), а назва мовою з описом
 * чужою — ні: змішана мова в індекс не потрапляє. Порожній rich-текст
 * (`<p></p>`) порожній і в джерелі, і в перекладі.
 */
export function isTranslatedForSeo(
  spec: TranslatableSpec,
  source: Pick<TranslationRow, 'values'>,
  target: Pick<TranslationRow, 'values'> | null,
): boolean {
  if (!target) return false;
  return spec.fields.every(
    (field) =>
      !fieldHasText(spec, field, source.values[field]) ||
      fieldHasText(spec, field, target.values[field]),
  );
}
