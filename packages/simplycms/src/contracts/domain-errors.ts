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
 * T0: нуль рантайм-залежностей. Тут живе уся родина класів доменних помилок
 * (`ValidationError`, `AdminConflictError`, `AdminNotFoundError`, `CodedError`)
 * і чистий throw-хелпер `stateConflict`: їх кидають і `admin-server`, і
 * T2-модулі (`addressing`), і чиста логіка T1, а T2 не може залежати від
 * `admin-server`. Лише `AuthzError` лишається в `auth/authz.ts`. Клієнтський
 * адаптер (T2, `simplycms/runtime`) читає ОДИН перелік замість того, щоб
 * дублювати рядкові літерали в трьох місцях і одного дня розійтися.
 * Серверним лишається мапінг кодів PG у конфлікт — `toAdminConflict`
 * (`admin-server/impl/errors.ts`, UPSTREAM:DRZ-1). Членство в
 * `DOMAIN_ERROR_NAME` пускає клас крізь маскування Р23.
 */
import { REVIEW_SUBMIT_ERROR } from './objects/review';

export const DOMAIN_ERROR_NAME = {
  adminConflict: 'AdminConflictError',
  authz: 'AuthzError',
  validation: 'ValidationError',
  /** Запитаного рядка немає (Р26): відрізняє «не знайдено» від збою запиту. */
  notFound: 'AdminNotFoundError',
  /** Машинний код відмови в `message` (`media/*`, `avatar/*`, `review/*`): клієнт мапить його в i18n. */
  coded: 'CodedError',
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
  // Достатньо `name`: що саме не знайдено, видно з контексту виклику.
  [DOMAIN_ERROR_NAME.notFound]: [],
  // Код їде самим `message`; додаткових полів немає.
  [DOMAIN_ERROR_NAME.coded]: [],
};

/** Коди відмов медіа-завантаження (`admin-server/impl/media`). */
export const MEDIA_ERROR = {
  noFile: 'media/no-file',
  noEntityType: 'media/no-entity-type',
  badEntityType: 'media/bad-entity-type',
  badFormat: 'media/bad-format',
  tooLarge: 'media/too-large',
} as const;

/** Коди відмов завантаження аватара (`core/lib/profile-avatar`). */
export const AVATAR_ERROR = {
  badFormat: 'avatar/bad-format',
  tooLarge: 'avatar/too-large',
} as const;

/**
 * Єдиний реєстр кодів, які клієнт мапить у i18n: значення беруться з
 * наявних констант (відгуки — `REVIEW_SUBMIT_ERROR`), літералів тут нема.
 * Новий код = нове значення в одній із трьох груп; `CodedError` невідомого
 * коду не скомпілюється.
 */
export type CodedErrorCode =
  | (typeof MEDIA_ERROR)[keyof typeof MEDIA_ERROR]
  | (typeof AVATAR_ERROR)[keyof typeof AVATAR_ERROR]
  | (typeof REVIEW_SUBMIT_ERROR)[keyof typeof REVIEW_SUBMIT_ERROR];

/**
 * Відмова з машинним кодом (`media/bad-format`, `review/already-submitted`…):
 * `message` — це КОД, а не текст, і клієнт порівнює його з каталогом i18n.
 * Звичайний `Error` у проді маскує Р23 (`Internal server error [ref …]`), і
 * користувач бачив би загальне «не збережено» замість «невірний формат».
 * Член закритої родини проходить маскування й серіалізацію без зміни коду.
 * Для діагностики сервера (англійський текст, не код) лишається `Error`.
 */
export class CodedError extends Error {
  override readonly name = DOMAIN_ERROR_NAME.coded;
  constructor(code: CodedErrorCode) {
    super(code);
  }
}

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
  // Е6д-1: новий референс зображення не є файлом цього запису (опція `media` фабрики).
  mediaRefInvalid: 'media_ref_invalid',
  // Е6д-7: відгук зник між відкриттям списку й дією модератора.
  reviewNotFound: 'review_not_found',
  // Е6д-23: покупець відредагував відгук між читанням модератора і дією.
  reviewChanged: 'review_changed',
} as const;

/** Код правила стану — значення `ADMIN_STATE_CONSTRAINT`. */
export type AdminStateConstraint =
  (typeof ADMIN_STATE_CONSTRAINT)[keyof typeof ADMIN_STATE_CONSTRAINT];

/**
 * Помилка валідації вводу адмін-операції (Тема 12): Zod-відмова на межі
 * serverFn → типізована доменна помилка з issues крізь БІЛИЙ СПИСОК
 * (`sanitizeValidationIssues`: path + код + параметри схеми, без сирих
 * повідомлень Zod і без відлуння вводу). Клієнт показує її помилками
 * полів (`applyServerValidation`), а не сирим JSON у тості.
 *
 * `message` навмисно загальний: вміст issues — не для користувача, а
 * `issues` переживає межу `domainErrorAdapter` окремим каналом.
 */
export class ValidationError extends Error {
  override readonly name = DOMAIN_ERROR_NAME.validation;
  readonly issues: readonly ValidationIssue[];
  constructor(issues: readonly ValidationIssue[]) {
    super('помилка валідації вводу');
    this.issues = issues;
  }
}

/**
 * Запитаного рядка немає (Р26). Окремий клас потрібен, щоб клієнт відрізнив
 * справжнє «не знайдено» від збою запиту: plain `Error` летів би так само,
 * як відмова БД, і картка показувала б «не знайдено» на будь-який збій.
 * Член закритої родини, тож маскування помилок його не чіпає.
 */
export class AdminNotFoundError extends Error {
  override readonly name = DOMAIN_ERROR_NAME.notFound;
  constructor(what: string) {
    super(`[admin-server] ${what} не існує`);
  }
}

/**
 * Конфлікт із даними, який власник може виправити сам (Е3-7): дубль
 * унікального значення, посилання, що тримає рядок, або (Е5-9, `state`)
 * заборонений перехід доменного стану — його кидає іменована операція
 * сама (409 ставить межа операції, С-10). Окремий клас — щоб
 * клієнт показав зрозумілий тост за `error.name`. `name` і поля
 * (`kind`/`constraint`) — за T0-переліком `contracts/domain-errors`: його
 * читає й клієнтський `domainErrorAdapter` (Е3-20), що зберігає instanceof
 * і поля через межу serverFn (раніше seroval губив усе, крім `.message`,
 * як і в `AuthzError` — К3-13).
 */
export class AdminConflictError extends Error {
  override readonly name = DOMAIN_ERROR_NAME.adminConflict;
  constructor(
    readonly kind: AdminConflictKind,
    readonly constraint: string | null,
  ) {
    super(
      `[admin-server] конфлікт ${kind}: ${constraint ?? 'невідоме обмеження'}`,
    );
  }
}

/**
 * Конфлікт правила стану (Е5б-10, Е6а-12). Спільний для іменованих операцій
 * і guard-хуків фабрики (Е6а-16). 🔴 Лише throw: статус 409 ставить межа
 * операції (`runAdminTransactions`, С-10), бо ядро кличуть і поза
 * HTTP-запитом (сід, порти), де `setResponseStatus` сам кидає виняток.
 */
export function stateConflict(constraint: AdminStateConstraint): never {
  throw new AdminConflictError('state', constraint);
}

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
  'reserved',
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

/**
 * Чи це доменне «не знайдено» (Р26). Дукове за `name`: клієнт має `Error` з
 * полями (адаптер serverFn), а не екземпляр серверного класу.
 */
export function isNotFoundError(error: unknown): boolean {
  return (
    (error as { name?: unknown } | null | undefined)?.name ===
    DOMAIN_ERROR_NAME.notFound
  );
}
