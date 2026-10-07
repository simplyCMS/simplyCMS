/** Категорії покупців і автоправила (Е6в, Task 9). */
export const messages = {
  'admin.customerCategories.categories.makeDefault': 'Зробити дефолтною',
  'admin.customerCategories.categories.defaultSet':
    'Категорію за замовчуванням змінено',
  'admin.customerCategories.categories.defaultLocked':
    'Категорію за замовчуванням не можна видалити',
  'admin.customerCategories.categories.notFound': 'Категорію не знайдено',
  'admin.customerCategories.categories.deleteWarning':
    'Видалити можна лише категорію без покупців, автоправил і згадок в умовах знижок.',
  'admin.customerCategories.rules.run': 'Запустити всі правила',
  'admin.customerCategories.rules.runResult':
    'Перевірено: {checked}, змінено: {changed}',
  'admin.customerCategories.rules.runFailed':
    '{failed} покупців не оброблено — дивіться журнал сервера',
  'admin.customerCategories.rules.utmHint':
    'UTM-мітки поки не збираються автоматично: правило з такою умовою спрацює лише для покупців, у профілі яких мітку вже записано',
  'admin.customerCategories.rules.howItWorks':
    'Правила перевіряються після кожного оформленого замовлення та за кнопкою «Запустити всі правила». Спрацьовує перше за пріоритетом правило, чия умова виконана; покупець без категорії вважається покупцем дефолтної.',
  'admin.customerCategories.rules.notFound': 'Правило не знайдено',
  'admin.customerCategories.rules.removeCondition': 'Прибрати умову',
  'admin.customerCategories.rules.conditionsInvalid':
    'Заповніть кожну умову: числові поля приймають лише числа',
  'admin.customerCategories.rules.field.utmSource': 'UTM Source',
  'admin.customerCategories.rules.field.utmCampaign': 'UTM Campaign',
} as const;
