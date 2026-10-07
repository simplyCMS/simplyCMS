/** Конфлікти БД (Е3-7) — мапляться з `AdminConflictError` через `adminErrorKey`. */
export const messages = {
  'admin.errors.slugTaken': 'Такий URL (slug) уже зайнятий — змініть його',
  'admin.errors.conflictUnique': 'Таке значення вже існує',
  'admin.errors.conflictReference':
    'Запис використовується (наприклад, у замовленнях) — деактивуйте його замість видалення',
  'admin.errors.orderCancelledFinal': 'Скасоване замовлення змінити не можна',
  'admin.errors.orderShippingUnavailable':
    'Для нового складу замовлення доставка цим способом недоступна — зміну не збережено',
  'admin.errors.orderInsufficientStock':
    'Недостатньо товару на складі — зміну не збережено',
  'admin.errors.orderLastItem':
    'Останню позицію видалити не можна — замовлення не може бути порожнім',
  'admin.errors.orderItemNotPurchasable':
    'Цей товар зараз недоступний для замовлення',
  'admin.errors.orderAmountOutOfRange':
    'Сума замовлення перевищує допустиму межу — зміну не збережено',
  'admin.errors.shippingPricingUnsupported':
    'Цей провайдер не рахує вартість доставки сам — оберіть інший режим ціни',
  'admin.errors.shippingProviderUnknown': 'Невідомий провайдер доставки',
  'admin.errors.shippingZoneDefault':
    'Зону за замовчуванням не можна вимкнути чи видалити — спершу призначте іншу',
  'admin.errors.shippingZoneInactive':
    'Зоною за замовчуванням може бути лише активна зона',
  'admin.errors.pickupPointMethodInvalid':
    'Точку видачі можна привʼязати лише до способу самовивозу',
  'admin.errors.pickupPointSystem': 'Системну точку (склад) видалити не можна',
  'admin.errors.pickupPointHasStock':
    'На точці є залишок товару або резерв замовлень — деактивуйте її замість видалення',
  'admin.errors.storeLogoInvalid':
    'Логотип має бути завантажений через форму профілю — оберіть файл ще раз',
  'admin.errors.themeNotBuilt':
    'Цієї теми немає у збірці магазину — додайте її пакет і перезберіть магазин',
  'admin.errors.themeUnknown': 'Тему не знайдено — оновіть сторінку',
  'admin.errors.pluginUnknown': 'Плагін не знайдено — оновіть сторінку',
  'admin.errors.discountGroupCycle':
    'Група не може бути вкладена у власну підгрупу',
  'admin.errors.discountGroupDatesInvalid':
    'Дата початку має бути раніше за дату завершення',
  'admin.errors.discountConditionCategoryMissing':
    'Категорію покупців з умови знижки не знайдено — оновіть сторінку й оберіть категорію ще раз',
  'admin.errors.userCategoryDefault':
    'Категорію за замовчуванням не можна видалити — спершу зробіть дефолтною іншу',
  'admin.errors.userCategoryHasCustomers':
    'У категорії є покупці — перенесіть їх в іншу категорію',
  'admin.errors.userCategoryHasRules':
    'Категорію використовують автоправила — спершу змініть або видаліть їх',
  'admin.errors.userCategoryInDiscount':
    'Категорію використовує умова знижки — спершу приберіть її з умови',
  'admin.errors.categoryRuleSameCategory':
    'Правило не може переводити покупця в ту саму категорію',
  'admin.errors.network': 'Немає звʼязку із сервером — зміни не збережено',
} as const;
