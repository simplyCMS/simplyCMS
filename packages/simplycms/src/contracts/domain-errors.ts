/**
 * Закрита родина доменних помилок, що перетинають межу serverFn (Е3-20).
 *
 * 🔴 Без адаптера серіалізації `ShallowErrorPlugin`
 * (`@tanstack/router-core`, tag `$TSR/Error`, test: `value instanceof
 * Error`) серіалізує ЛИШЕ `.message` — клієнт бачить голий `Error` без
 * `name`/`kind`/`constraint`/`operation`, і `adminErrorKey`
 * (`admin/lib/admin-error.ts`) не впізнає конфлікт (доведено `live:smoke`).
 * `simplycms/runtime/domain-error-adapter` лікує це — читає ЦЕЙ перелік.
 *
 * T0: нуль рантайм-залежностей. Серверні класи (`admin-server/impl/errors.ts`
 * — `AdminConflictError`; `auth/authz.ts` — `AuthzError`) і клієнтський
 * адаптер (T2, `simplycms/runtime`) читають ОДИН перелік замість того, щоб
 * дублювати рядкові літерали в трьох місцях і одного дня розійтися.
 */
export const DOMAIN_ERROR_NAME = {
  adminConflict: 'AdminConflictError',
  authz: 'AuthzError',
} as const satisfies Readonly<Record<string, string>>;

/** `error.name` доменної помилки — значення `DOMAIN_ERROR_NAME`. */
export type DomainErrorName =
  (typeof DOMAIN_ERROR_NAME)[keyof typeof DOMAIN_ERROR_NAME];

/**
 * Примітивні поля кожної помилки, які переживають межу serverFn — ключі
 * читає адаптер (духом-тайпінг, без імпорту серверних класів), значення
 * лишаються `string | null` (жодних функцій/класів/undefined — контракт
 * `ValidateSerializable` seroval-адаптера цього й так вимагає).
 */
export const DOMAIN_ERROR_FIELD_KEYS: Readonly<
  Record<DomainErrorName, readonly string[]>
> = {
  [DOMAIN_ERROR_NAME.adminConflict]: ['kind', 'constraint'],
  [DOMAIN_ERROR_NAME.authz]: ['operation'],
};

/** Форма, що фактично летить через мережу (адаптер бере/віддає її ціле). */
export interface SerializableDomainError {
  readonly name: DomainErrorName;
  readonly message: string;
  readonly fields: Readonly<Record<string, string | null>>;
}

export function isDomainErrorName(value: unknown): value is DomainErrorName {
  return (
    typeof value === 'string' &&
    (Object.values(DOMAIN_ERROR_NAME) as readonly string[]).includes(value)
  );
}
