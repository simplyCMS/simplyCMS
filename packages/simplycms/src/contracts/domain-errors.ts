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
  validation: 'ValidationError',
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
  // Тема 12: єдине НЕ-примітивне поле (`issues`) їде окремим каналом
  // `SerializableDomainError.issues` — крізь білий список
  // `sanitizeValidationIssues`, а не через `fields`.
  [DOMAIN_ERROR_NAME.validation]: [],
};

/**
 * Види `AdminConflictError.kind` (Е3-7, Е5-9). `state` — порушення доменного
 * стану, якого БД не виражає обмеженням (напр. «скасоване замовлення —
 * кінцеве»): 409 так само, як `unique`/`reference`, а `constraint` несе
 * код правила з `ADMIN_STATE_CONSTRAINT`. Адаптер серіалізації вид не
 * фільтрує — `kind` летить рядком (`DOMAIN_ERROR_FIELD_KEYS`).
 */
export const ADMIN_CONFLICT_KINDS = ['unique', 'reference', 'state'] as const;

export type AdminConflictKind = (typeof ADMIN_CONFLICT_KINDS)[number];

/** Коди правил стану (`kind: 'state'`) — один перелік для сервера й `adminErrorKey`. */
export const ADMIN_STATE_CONSTRAINT = {
  orderCancelledFinal: 'order_cancelled_final',
  // Е5б-10: редагування позицій оформленого замовлення.
  orderShippingUnavailable: 'order_shipping_unavailable',
  orderInsufficientStock: 'order_insufficient_stock',
  orderLastItem: 'order_last_item',
  orderItemNotPurchasable: 'order_item_not_purchasable',
  orderAmountOutOfRange: 'order_amount_out_of_range',
  // Е6а-12/17/20: інваріанти доставки під `shipping-config`.
  shippingPricingUnsupported: 'shipping_pricing_unsupported',
  shippingProviderUnknown: 'shipping_provider_unknown',
  shippingZoneDefault: 'shipping_zone_default',
  shippingZoneInactive: 'shipping_zone_inactive',
  pickupPointMethodInvalid: 'pickup_point_method_invalid',
  pickupPointSystem: 'pickup_point_system',
  pickupPointHasStock: 'pickup_point_has_stock',
  // Е6б-14/15/17: системні налаштування (`settings.manage`).
  storeLogoInvalid: 'store_logo_invalid',
  themeNotBuilt: 'theme_not_built',
  themeUnknown: 'theme_unknown',
  pluginUnknown: 'plugin_unknown',
  // Е6в-16/17 (ред.2): інваріанти знижок під `discount-config`.
  discountGroupCycle: 'discount_group_cycle',
  discountGroupDatesInvalid: 'discount_group_dates_invalid',
  discountConditionCategoryMissing: 'discount_condition_category_missing',
  // Е6в-18/19: категорії покупців і автоправила під `customer-config`.
  userCategoryDefault: 'user_category_default',
  userCategoryHasCustomers: 'user_category_has_customers',
  userCategoryHasRules: 'user_category_has_rules',
  userCategoryInDiscount: 'user_category_in_discount',
  categoryRuleSameCategory: 'category_rule_same_category',
  // Е6г-4/11: роль адміна під `admin-roles`.
  adminRoleSelf: 'admin_role_self',
  adminRoleLast: 'admin_role_last',
  adminRoleBanned: 'admin_role_banned',
  // Е6г-4: бан адміна заборонено — спершу зняти роль.
  customerIsAdmin: 'customer_is_admin',
  // Е6г-15/16: видалення акаунта; позиції стертого замовлення не редагуються.
  customerNotFound: 'customer_not_found',
  customerSelf: 'customer_self',
  orderPersonalDataErased: 'order_personal_data_erased',
} as const;

/** Код правила стану — значення `ADMIN_STATE_CONSTRAINT`. */
export type AdminStateConstraint =
  (typeof ADMIN_STATE_CONSTRAINT)[keyof typeof ADMIN_STATE_CONSTRAINT];

/** Форма, що фактично летить через мережу (адаптер бере/віддає її ціле). */
export interface SerializableDomainError {
  readonly name: DomainErrorName;
  readonly message: string;
  readonly fields: Readonly<Record<string, string | null>>;
  /** Лише для `ValidationError` (Тема 12) — уже пропущені крізь білий список. */
  readonly issues?: readonly ValidationIssue[];
}

/**
 * Коди проблем валідації, що перетинають межу serverFn. Закритий перелік:
 * коди Zod 4 + власні (`invalid_decimal` — формат `numeric` за precision/
 * scale колонки). Невідомий код зводиться до `custom`. Клієнтський
 * `applyServerValidation` має i18n-ключ `admin.validation.<code>` на КОЖЕН
 * код (повноту тримає тип `MessageKey` + тест).
 */
export const VALIDATION_ISSUE_CODES = [
  'invalid_type',
  'too_big',
  'too_small',
  'invalid_format',
  'invalid_value',
  'invalid_union',
  'invalid_key',
  'invalid_element',
  'not_multiple_of',
  'unrecognized_keys',
  'invalid_decimal',
  'custom',
  'taken',
] as const;

export type ValidationIssueCode = (typeof VALIDATION_ISSUE_CODES)[number];

/** Параметри підстановки в i18n-повідомлення: лише примітиви зі схеми, не вхід. */
export type ValidationIssueParams = Readonly<
  Record<string, string | number | boolean>
>;

/** Одна проблема валідації — рівно ця форма (білий список) летить на клієнт. */
export interface ValidationIssue {
  readonly path: readonly (string | number)[];
  readonly code: ValidationIssueCode;
  readonly params?: ValidationIssueParams;
}

/**
 * Ключі `params`, яким дозволено перетнути межу. Усі — ВЛАСТИВОСТІ СХЕМИ
 * (межі, очікуваний тип, формат), а не відлуння введеного значення: сирі
 * повідомлення Zod і `input` можуть містити те, що ввів користувач.
 */
const PARAM_KEYS: readonly string[] = [
  'expected',
  'origin',
  'minimum',
  'maximum',
  'format',
  'multipleOf',
  'precision',
  'scale',
];

const MAX_ISSUES = 50;
const MAX_PATH = 8;
const MAX_STRING = 64;

const isIssueCode = (v: unknown): v is ValidationIssueCode =>
  typeof v === 'string' &&
  (VALIDATION_ISSUE_CODES as readonly string[]).includes(v);

function sanitizeParam(v: unknown): string | number | boolean | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'boolean') return v;
  if (typeof v === 'bigint') return v.toString();
  if (typeof v === 'string') return v.slice(0, MAX_STRING);
  return undefined;
}

/**
 * Білий список для issues валідації. 🔴 ЄДИНА функція, що пускає дані на
 * клієнт: викликається і сервером (перед створенням `ValidationError`), і
 * адаптером серіалізації з обох боків (захист від чужого/застарілого
 * payload). Приймає `unknown` — тож і довільний обʼєкт із мережі: усе, чого
 * нема в переліку (повідомлення, `input`, `pattern`, вкладені обʼєкти),
 * відкидається. Межі кількості/довжини — проти роздування відповіді.
 */
export function sanitizeValidationIssues(raw: unknown): ValidationIssue[] {
  if (!Array.isArray(raw)) return [];
  const out: ValidationIssue[] = [];
  for (const item of raw.slice(0, MAX_ISSUES)) {
    if (item === null || typeof item !== 'object') continue;
    const rec = item as Record<string, unknown>;
    const path = (Array.isArray(rec.path) ? rec.path : [])
      .slice(0, MAX_PATH)
      .map((seg) =>
        typeof seg === 'number' && Number.isInteger(seg)
          ? seg
          : String(seg).slice(0, MAX_STRING),
      );
    const params: Record<string, string | number | boolean> = {};
    const source =
      rec.params !== null && typeof rec.params === 'object'
        ? (rec.params as Record<string, unknown>)
        : {};
    for (const key of PARAM_KEYS) {
      // Значення шукається і на самому issue (поля Zod), і в `params`.
      const value = sanitizeParam(source[key] ?? rec[key]);
      if (value !== undefined) params[key] = value;
    }
    // `custom`-проблема може нести власний код у `params.code` (так схема
    // віддає `invalid_decimal`); чужий/невідомий код — просто `custom`.
    const code =
      rec.code === 'custom' && isIssueCode(source.code)
        ? source.code
        : isIssueCode(rec.code)
          ? rec.code
          : 'custom';
    out.push({
      path,
      code,
      ...(Object.keys(params).length > 0 ? { params } : {}),
    });
  }
  return out;
}

export function isDomainErrorName(value: unknown): value is DomainErrorName {
  return (
    typeof value === 'string' &&
    (Object.values(DOMAIN_ERROR_NAME) as readonly string[]).includes(value)
  );
}
