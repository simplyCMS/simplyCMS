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
  'admin.errors.network': 'Немає звʼязку із сервером — зміни не збережено',
} as const;
