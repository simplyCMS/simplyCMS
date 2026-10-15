// Статуси перекладів і нормалізація вводу (майстер §3.4) — чиста логіка T1.
//
// 🔴 Хешів тут НЕ рахують: sha256 потребує `node:crypto`, а цей модуль
// імпортує й клієнт адмінки (бейджі статусів). Хеш поточного джерела приходить
// у `TranslationRow.hashes` готовим — його рахує сервер (`simplycms/translations`).

/** Статус поля або рядка перекладу відносно поточного джерела. */
export type FieldStatus = 'current' | 'outdated' | 'missing';

/**
 * Опис перекладної сутності: які поля перекладаються й які з них обов'язкові.
 * `richHtml` — підмножина `fields`, що несе санітизований HTML: його хеш береться
 * від уже очищеної розмітки (санітизує викликач, не цей модуль).
 */
export interface TranslatableSpec {
  readonly fields: readonly string[];
  readonly required: readonly string[];
  readonly richHtml?: readonly string[];
}

/**
 * Рядок локалізованих полів одного запису.
 *
 * `hashes` мають різний зміст за роллю рядка, бо порівнюються між собою:
 * для рядка-ДЖЕРЕЛА — хеші його ПОТОЧНОГО тексту (поле без тексту хеша не має);
 * для рядка ПЕРЕКЛАДУ — `source_hashes`: хеш джерела на мить, коли поле
 * перекладали. Рівність цих двох і є «актуальність».
 */
export interface TranslationRow {
  readonly values: Readonly<Record<string, string | null | undefined>>;
  readonly hashes?: Readonly<Record<string, string>>;
}

/** Є справжній текст (не `null`, не порожній рядок, не самі пробіли). */
export function hasText(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

/**
 * Нормалізація вводу поля (§3.4): `undefined` — поле не надіслано (не чіпати),
 * `null`, `''` і самі пробіли — очистити (`null`), решта — як є. Непорожній текст
 * не обрізається: пробіли по краях можуть бути частиною rich-розмітки, а хеш і
 * так нормалізує (`NFC` + `trim`) на своєму боці.
 */
export function normalizeTextInput(
  value: string | null | undefined,
): string | null | undefined {
  if (value === undefined) return undefined;
  return hasText(value) ? value : null;
}

/**
 * Статус одного поля НЕ-джерела.
 *
 * Відсутність хеша і порожнє джерело (`currentSourceHash === null`) рівні:
 * переклад, зроблений, коли джерело було порожнім, лишається `current`, а коли
 * джерело потім очистили (хеш був, джерела немає) — `outdated`.
 */
export function fieldStatus(
  target: string | null,
  recordedHash: string | undefined,
  currentSourceHash: string | null,
): FieldStatus {
  if (!hasText(target)) return 'missing';
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
  source: TranslationRow,
  target: TranslationRow | null,
): FieldStatus {
  if (!target) return 'missing';
  if (spec.required.some((field) => !hasText(target.values[field])))
    return 'missing';
  const outdated = spec.fields.some((field) => {
    const text = target.values[field];
    return (
      hasText(text) &&
      fieldStatus(
        text,
        target.hashes?.[field],
        source.hashes?.[field] ?? null,
      ) === 'outdated'
    );
  });
  return outdated ? 'outdated' : 'current';
}

/**
 * «Перекладено» для SEO (§3.4): кожне поле, НЕпорожнє в джерелі, непорожнє й у
 * мові. `outdated` рахується перекладеним (текст є), а назва мовою з описом
 * чужою — ні: змішана мова в індекс не потрапляє.
 */
export function isTranslatedForSeo(
  spec: TranslatableSpec,
  source: TranslationRow,
  target: TranslationRow | null,
): boolean {
  if (!target) return false;
  return spec.fields.every(
    (field) => !hasText(source.values[field]) || hasText(target.values[field]),
  );
}
