// Складові чистого плану запису перекладів: відмова вводу, нормалізація патча
// мови, хеші джерела. Окремо від `write-plan.ts`, щоб тримати модулі в межах
// ~150 рядків; зовні використовується лише через `simplycms/domain/translations`.
import {
  DOMAIN_ERROR_NAME,
  type ValidationIssue,
} from 'simplycms/contracts/domain-errors';
import {
  hasText,
  normalizeTextInput,
  type TranslatableSpec,
  type TranslationRow,
} from './status';

/**
 * Відмова вводу запису перекладу.
 *
 * `name` = `ValidationError` з T0-переліку: серіалізаційний адаптер впізнає
 * закриту родину за іменем (дух-тайпінг), тож помилка пройде межу serverFn, не
 * тягнучи серверний клас із `admin-server/impl`, якого T1 імпортувати не може.
 */
export class TranslationValidationError extends Error {
  override readonly name = DOMAIN_ERROR_NAME.validation;
  readonly issues: readonly ValidationIssue[];
  constructor(issues: readonly ValidationIssue[]) {
    super('[domain/translations] помилка валідації запису перекладу');
    this.issues = issues;
  }
}

export const issue = (
  path: readonly string[],
  code: ValidationIssue['code'],
): ValidationIssue =>
  code === 'too_small'
    ? { path, code, params: { minimum: 1, origin: 'string' } }
    : { path, code };

/** Нормалізує патч однієї мови; невідоме поле й `null` для обов'язкового — відмова. */
export function normalizePatch(
  spec: TranslatableSpec,
  locale: string,
  fields: Readonly<Partial<Record<string, string | null>>>,
): Record<string, string | null> {
  const issues: ValidationIssue[] = [];
  const values: Record<string, string | null> = {};
  for (const [field, raw] of Object.entries(fields)) {
    const value = normalizeTextInput(raw);
    if (value === undefined) continue;
    if (!spec.fields.includes(field)) {
      issues.push(issue([locale, field], 'unrecognized_keys'));
    } else if (value === null && spec.required.includes(field)) {
      issues.push(issue([locale, field], 'too_small'));
    } else {
      values[field] = value;
    }
  }
  if (issues.length > 0) throw new TranslationValidationError(issues);
  return values;
}

/** Хеші поточного тексту джерела для полів, де текст є. */
export function hashesOf(
  spec: TranslatableSpec,
  values: TranslationRow['values'],
  hash: (text: string) => string,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const field of spec.fields) {
    const text = values[field];
    if (hasText(text)) out[field] = hash(text);
  }
  return out;
}

/** `source_hashes` рядка після запису: старі зберігаються, надіслані поля — хеш НОВОГО джерела. */
export function mergeHashes(
  spec: TranslatableSpec,
  recorded: TranslationRow['hashes'],
  sent: Readonly<Record<string, string | null>>,
  newSource: TranslationRow['values'],
  hash: (text: string) => string,
): Record<string, string> {
  const merged: Record<string, string> = {};
  // ⊆ spec.fields (І10): сторонній ключ у збережених хешах далі не їде.
  for (const field of spec.fields) {
    const old = recorded?.[field];
    if (typeof old === 'string') merged[field] = old;
  }
  for (const [field, value] of Object.entries(sent)) {
    const sourceText = newSource[field];
    // Очищене поле й поле без тексту в джерелі хеша не мають (див. fieldStatus).
    if (value !== null && hasText(sourceText)) merged[field] = hash(sourceText);
    else delete merged[field];
  }
  return merged;
}
