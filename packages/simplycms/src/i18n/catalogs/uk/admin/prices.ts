/** Види цін. */
export const messages = {
  'admin.prices.subtitle': 'Управління видами цін для товарів',
  'admin.prices.add': 'Додати вид ціни',
  'admin.prices.empty': 'Видів цін ще немає',
  'admin.prices.created': 'Вид ціни створено',
  'admin.prices.deleted': 'Вид ціни видалено',
  'admin.prices.confirmDelete': 'Видалити цей вид ціни?',
  'admin.prices.new': 'Новий вид ціни',
  'admin.prices.editTitle': 'Редагування виду ціни',
  'admin.prices.deleteTitle': 'Видалити вид ціни?',
  'admin.prices.deleteWarning':
    'Тип ціни, на який посилаються ціни товарів, видалити не можна: спочатку приберіть ці ціни. Видалення прибирає лише порожній тип.',
  'admin.prices.namePlaceholder': 'Роздрібна',
  'admin.prices.codeHint': 'Унікальний код (латиниця, цифри, _)',
  'admin.prices.defaultHint': 'Цей вид ціни буде використовуватись як фолбек',
  'admin.prices.defaultLocked': 'Дефолтний тип ціни видалити не можна',
  'admin.prices.codeFormat': 'Лише латиниця, цифри й _',
  'admin.prices.defaultKeep':
    'Щоб змінити дефолт, призначте дефолтним інший тип',
  'admin.prices.notFound': 'Вид ціни не знайдено',
} as const;
