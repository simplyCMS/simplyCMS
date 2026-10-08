import type { MessageKey, MessageParams, Translator } from 'simplycms/i18n';
import {
  DOMAIN_ERROR_NAME,
  sanitizeValidationIssues,
  type ValidationIssue,
  type ValidationIssueCode,
} from 'simplycms/contracts/domain-errors';

/**
 * Сумісно з `UseFormSetError` react-hook-form (`form.setError(name, { type,
 * message })`) і з довільним локальним станом полів (редактори залишків/цін
 * без RHF передають власний сеттер) — тому лише ЦЯ форма, без імпорту RHF.
 */
export type SetFieldError = (
  field: string,
  error: { readonly type: 'server'; readonly message: string },
) => void;

export interface ApplyServerValidationOptions {
  /** Транслятор (`useT()`): повідомлення поля — переклад за кодом проблеми. */
  readonly t: Translator;
  /**
   * `path` проблеми → імʼя поля форми; `null` — поля немає (проблема лишається
   * «немапленою»). За замовчуванням — `path.join('.')` (RHF-імена вкладених
   * полів), тож форма з плоскими іменами, що збігаються з колонками, нічого
   * не передає. Редактори, де `path` позиційний (`quantities.0.quantity`),
   * передають свій мапінг індекс → ідентифікатор.
   */
  readonly fieldFor?: (path: readonly (string | number)[]) => string | null;
}

/** Помилка валідації з сервера (форма — після `domainErrorAdapter`). */
export function isServerValidationError(
  error: unknown,
): error is { name: string; issues: unknown } {
  const e = error as { name?: unknown; issues?: unknown } | null | undefined;
  return e?.name === DOMAIN_ERROR_NAME.validation && Array.isArray(e.issues);
}

/** Код (і `origin` для меж) → ключ каталогу `admin.validation.*`. */
const ORIGIN_SUFFIX: Readonly<Record<string, string>> = {
  string: '_string',
  array: '_array',
  set: '_array',
};

const KEYS = {
  invalid_type: 'admin.validation.invalid_type',
  too_big: 'admin.validation.too_big',
  too_small: 'admin.validation.too_small',
  invalid_format: 'admin.validation.invalid_format',
  invalid_value: 'admin.validation.invalid_value',
  invalid_union: 'admin.validation.invalid_union',
  invalid_key: 'admin.validation.invalid_key',
  invalid_element: 'admin.validation.invalid_element',
  not_multiple_of: 'admin.validation.not_multiple_of',
  unrecognized_keys: 'admin.validation.unrecognized_keys',
  invalid_decimal: 'admin.validation.invalid_decimal',
  custom: 'admin.validation.custom',
  taken: 'admin.validation.taken',
} as const satisfies Record<ValidationIssueCode, MessageKey>;

/** Ключ повідомлення для проблеми; повнота за кодами — типом `KEYS`. */
export function validationMessageKey(issue: ValidationIssue): MessageKey {
  if (issue.code === 'invalid_decimal' && issue.params?.precision === undefined)
    return 'admin.validation.invalid_decimal_plain';
  if (issue.code === 'too_big' || issue.code === 'too_small') {
    const suffix = ORIGIN_SUFFIX[String(issue.params?.origin)] ?? '';
    return `${KEYS[issue.code]}${suffix}` as MessageKey;
  }
  return KEYS[issue.code];
}

function messageFor(issue: ValidationIssue, t: Translator): string {
  const params: MessageParams = {};
  for (const [k, v] of Object.entries(issue.params ?? {}))
    params[k] = String(v);
  return t(validationMessageKey(issue), params);
}

/**
 * Розкладає серверну `ValidationError` по полях форми (Тема 12).
 *
 * - `null` — це НЕ помилка валідації: викликач веде звичайним шляхом
 *   (`adminErrorKey` / загальний тост);
 * - масив — проблеми, які НЕ вдалося привʼязати до поля (немає поля у
 *   `fieldFor`, порожній `path`, правило рівня обʼєкта): викликач показує
 *   загальний тост лише коли масив непорожній. Порожній масив = усе
 *   розкладено по полях.
 *
 * Для поля береться ПЕРША проблема (RHF тримає одну помилку на поле).
 * Issues повторно пропускаються крізь білий список — на вході довіри до
 * мережі немає, навіть якщо адаптер уже це зробив.
 */
export function applyServerValidation(
  error: unknown,
  setError: SetFieldError,
  opts: ApplyServerValidationOptions,
): ValidationIssue[] | null {
  if (!isServerValidationError(error)) return null;
  const fieldFor = opts.fieldFor ?? ((path) => path.join('.') || null);
  const unmapped: ValidationIssue[] = [];
  const seen = new Set<string>();
  for (const issue of sanitizeValidationIssues(error.issues)) {
    const field = fieldFor(issue.path);
    if (field === null || field === '') {
      unmapped.push(issue);
      continue;
    }
    if (seen.has(field)) continue;
    seen.add(field);
    setError(field, { type: 'server', message: messageFor(issue, opts.t) });
  }
  return unmapped;
}

/** Привʼязка до форми react-hook-form: сеттер + «чи є таке поле у формі». */
export interface FormErrorBinding {
  readonly setError: SetFieldError;
  readonly fieldFor: (path: readonly (string | number)[]) => string | null;
}

/**
 * Привʼязка серверної валідації до RHF-форми: `form.setError` + `fieldFor`,
 * що мапить плоский `path` ТІЛЬКИ на `fields` — поля, чий UI показує
 * `errors[field].message` серверної помилки. 🔴 Issue на поле без
 * відображення лишається немапленою і йде в загальний тост: інакше помилка
 * була б «розкладена», але невидима, і збереження мовчки б не спрацювало.
 * Поле мусить ще й існувати у формі (`getValues()`).
 */
export function formErrorBinding(
  form: {
    readonly setError: (
      name: never,
      error: { readonly type: string; readonly message: string },
    ) => void;
    readonly getValues: () => object;
  },
  fields: readonly string[],
): FormErrorBinding {
  return {
    setError: (field, error) => form.setError(field as never, error),
    fieldFor: (path) =>
      path.length === 1 &&
      typeof path[0] === 'string' &&
      fields.includes(path[0]) &&
      Object.hasOwn(form.getValues(), path[0])
        ? path[0]
        : null,
  };
}
