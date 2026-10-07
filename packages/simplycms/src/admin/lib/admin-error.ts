import type { MessageKey } from 'simplycms/i18n';
import {
  ADMIN_STATE_CONSTRAINT,
  DOMAIN_ERROR_NAME,
  type AdminStateConstraint,
} from 'simplycms/contracts/domain-errors';

/**
 * Ключ повідомлення для конфлікту БД (Е3-7). Розрізняємо за полями, а не
 * `instanceof`: клас `AdminConflictError` живе в server-only дереві —
 * сюди він не імпортується навіть типом, лише `DOMAIN_ERROR_NAME`
 * (T0, `contracts/domain-errors`).
 *
 * 🔴 Без розгортання `.cause` (Е3-20, закрито): до `domainErrorAdapter`
 * помилка мала б розгортатись, бо `@tanstack/db`'s `commit()` нібито
 * замінював ПЛОСКИЙ (не-`Error`) обʼєкт на голий `Error(String(x))`.
 * Корінь був у серіалізації Start (ShallowErrorPlugin губив поля, але
 * ЛИШАВ `instanceof Error`) — адаптер тепер повертає `Error` з полями НА
 * ВЕРХНЬОМУ рівні, і транзакція `@tanstack/db` (`error instanceof Error ?
 * error : …`) їх більше не чіпає. Доказ —
 * `__tests__/conflict-through-transaction.test.ts` (реальна колекція/
 * транзакція, не ручний `Object.assign`). Реєстр TSDB-5
 * (docs/architecture/upstream-workarounds.md) закритий.
 */
type ConflictShape = {
  name?: unknown;
  kind?: unknown;
  constraint?: unknown;
};

/**
 * Код правила стану → ключ `admin.errors.<camelCase>` (Е5-9, Е5б-10). Повноту
 * тримає тип: новий код у `ADMIN_STATE_CONSTRAINT` без ключа тут —
 * `pnpm typecheck` червоний.
 */
const STATE_KEYS: Readonly<Record<string, MessageKey>> = {
  [ADMIN_STATE_CONSTRAINT.orderCancelledFinal]:
    'admin.errors.orderCancelledFinal',
  [ADMIN_STATE_CONSTRAINT.orderShippingUnavailable]:
    'admin.errors.orderShippingUnavailable',
  [ADMIN_STATE_CONSTRAINT.orderInsufficientStock]:
    'admin.errors.orderInsufficientStock',
  [ADMIN_STATE_CONSTRAINT.orderLastItem]: 'admin.errors.orderLastItem',
  [ADMIN_STATE_CONSTRAINT.orderItemNotPurchasable]:
    'admin.errors.orderItemNotPurchasable',
  [ADMIN_STATE_CONSTRAINT.orderAmountOutOfRange]:
    'admin.errors.orderAmountOutOfRange',
  // Е6а-12/17/20: інваріанти доставки.
  [ADMIN_STATE_CONSTRAINT.shippingPricingUnsupported]:
    'admin.errors.shippingPricingUnsupported',
  [ADMIN_STATE_CONSTRAINT.shippingProviderUnknown]:
    'admin.errors.shippingProviderUnknown',
  [ADMIN_STATE_CONSTRAINT.shippingZoneDefault]:
    'admin.errors.shippingZoneDefault',
  [ADMIN_STATE_CONSTRAINT.shippingZoneInactive]:
    'admin.errors.shippingZoneInactive',
  [ADMIN_STATE_CONSTRAINT.pickupPointMethodInvalid]:
    'admin.errors.pickupPointMethodInvalid',
  [ADMIN_STATE_CONSTRAINT.pickupPointSystem]: 'admin.errors.pickupPointSystem',
  [ADMIN_STATE_CONSTRAINT.pickupPointHasStock]:
    'admin.errors.pickupPointHasStock',
  // Е6б-14/15/17: системні налаштування.
  [ADMIN_STATE_CONSTRAINT.storeLogoInvalid]: 'admin.errors.storeLogoInvalid',
  [ADMIN_STATE_CONSTRAINT.themeNotBuilt]: 'admin.errors.themeNotBuilt',
  [ADMIN_STATE_CONSTRAINT.themeUnknown]: 'admin.errors.themeUnknown',
  [ADMIN_STATE_CONSTRAINT.pluginUnknown]: 'admin.errors.pluginUnknown',
  // Е6в-16/17: знижки.
  [ADMIN_STATE_CONSTRAINT.discountGroupCycle]:
    'admin.errors.discountGroupCycle',
  [ADMIN_STATE_CONSTRAINT.discountGroupDatesInvalid]:
    'admin.errors.discountGroupDatesInvalid',
  [ADMIN_STATE_CONSTRAINT.discountConditionCategoryMissing]:
    'admin.errors.discountConditionCategoryMissing',
  // Е6в-18/19: категорії покупців і автоправила.
  [ADMIN_STATE_CONSTRAINT.userCategoryDefault]:
    'admin.errors.userCategoryDefault',
  [ADMIN_STATE_CONSTRAINT.userCategoryHasCustomers]:
    'admin.errors.userCategoryHasCustomers',
  [ADMIN_STATE_CONSTRAINT.userCategoryHasRules]:
    'admin.errors.userCategoryHasRules',
  [ADMIN_STATE_CONSTRAINT.userCategoryInDiscount]:
    'admin.errors.userCategoryInDiscount',
  [ADMIN_STATE_CONSTRAINT.categoryRuleSameCategory]:
    'admin.errors.categoryRuleSameCategory',
} satisfies Record<AdminStateConstraint, MessageKey>;

/** Повідомлення саме мережевого фейлу `fetch` у трьох основних рушіях. */
const NETWORK_MESSAGE = /failed to fetch|networkerror|load failed/i;

/**
 * Мережевий фейл `fetch` — голий `TypeError` без спеціалізованого повідомлення
 * (наприклад «x is not a function») мережею НЕ вважається: він не відрізняє
 * розрив звʼязку від багу виклику. Офлайн (`navigator.onLine === false`) —
 * окрема, самодостатня ознака: браузер гарантовано не достукається до
 * сервера незалежно від тексту помилки.
 */
function isNetworkError(error: unknown): boolean {
  const e = error as { name?: unknown; message?: unknown } | null | undefined;
  const isTypeError = error instanceof TypeError || e?.name === 'TypeError';
  const messageMatches =
    typeof e?.message === 'string' && NETWORK_MESSAGE.test(e.message);
  const offline =
    typeof navigator !== 'undefined' && navigator.onLine === false;
  return (isTypeError && messageMatches) || offline;
}

export function adminErrorKey(error: unknown): MessageKey | null {
  const e = error as ConflictShape | null | undefined;
  if (e?.name === DOMAIN_ERROR_NAME.adminConflict) {
    if (e.kind === 'reference') return 'admin.errors.conflictReference';
    // Е5-9/Е5б-10: правило стану. Невідомий код стану — загальний ключ
    // нижче не годиться (це не дубль), тож лише відомі коди мапляться точно.
    if (e.kind === 'state')
      // `hasOwn`, а не `?? null`: код із мережі на кшталт `toString`
      // інакше дістав би метод прототипу замість ключа.
      return typeof e.constraint === 'string' &&
        Object.hasOwn(STATE_KEYS, e.constraint)
        ? STATE_KEYS[e.constraint]!
        : null;
    // Входження, не суфікс: product_modifications_product_slug_unique названо
    // руками, решта slug-обмежень — *_slug_key (аудит 2026-09-23).
    return typeof e.constraint === 'string' && e.constraint.includes('slug')
      ? 'admin.errors.slugTaken'
      : 'admin.errors.conflictUnique';
  }
  // Тема 12: помилка валідації без поля форми (або там, де полів немає —
  // видалення, миттєві контролі) — загальний локалізований тост, не сирий JSON.
  // Помилки ПОЛІВ розкладає `applyServerValidation`.
  if (e?.name === DOMAIN_ERROR_NAME.validation)
    return 'admin.validation.failed';
  if (isNetworkError(error)) return 'admin.errors.network';
  return null;
}
