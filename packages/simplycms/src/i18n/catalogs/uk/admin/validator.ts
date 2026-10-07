/** Валідатор цін: діагностика ціни тим самим ядром, що й чекаут (Е6в, З-4). */
export const messages = {
  'admin.validator.subtitle':
    'Покаже, яку ціну отримає покупець, які знижки спрацювали і чому інші — ні',
  'admin.validator.params': 'Параметри перевірки',
  'admin.validator.customer': 'Покупець',
  'admin.validator.guest': 'Гість',
  'admin.validator.guestHint': 'Без авторизації: дефолтна категорія й тип ціни',
  'admin.validator.customerSearch': 'Пошук покупця за email або імʼям',
  'admin.validator.customerEmpty': 'Покупця не знайдено',
  'admin.validator.customerFailed': 'Не вдалося знайти покупця',
  'admin.validator.noEmail': 'без email',
  'admin.validator.product': 'Товар',
  'admin.validator.productChange': 'Змінити товар',
  'admin.validator.quantity': 'Кількість',
  'admin.validator.cartTotal': 'Сума решти кошика (грн)',
  'admin.validator.run': 'Перевірити',
  'admin.validator.failed': 'Не вдалося виконати перевірку',
  'admin.validator.result': 'Результат аналізу',
  'admin.validator.priceType': 'Тип ціни',
  'admin.validator.category': 'Категорія покупця',
  'admin.validator.notDefined': 'Не визначено',
  'admin.validator.unavailable':
    'Позицію неможливо купити: товар вимкнений, без ціни чи залишку',
  'admin.validator.basePrice': 'Базова ціна',
  'admin.validator.finalPrice': 'Фінальна ціна',
  'admin.validator.applied': 'Застосовано',
  'admin.validator.rejected': 'Відхилено',
  'admin.validator.noneApplied': 'Жодна знижка не застосована',
  'admin.validator.noneRejected': 'Відхилених знижок немає',
  'admin.validator.discountLine': '{name} ({group}): −{amount}',
  'admin.validator.rejectedLine': '{name} ({group})',
  'admin.validator.conditionType': 'умова «{type}»',
  'admin.validator.reason.inactive': 'Знижку вимкнено',
  'admin.validator.reason.out_of_dates': 'Поза датами дії знижки',
  'admin.validator.reason.group_inactive': 'Групу знижок вимкнено',
  'admin.validator.reason.group_out_of_dates': 'Поза датами дії групи знижок',
  'admin.validator.reason.target_mismatch':
    'Знижка не стосується цього товару чи розділу',
  'admin.validator.reason.condition_failed': 'Умова знижки не виконана',
  'admin.validator.reason.condition_unknown':
    'Тип умови не зареєстрований (плагін умови не встановлено)',
  'admin.validator.reason.condition_invalid':
    'Дані умови пошкоджені: відкрийте знижку й збережіть її повторно',
  'admin.validator.reason.discount_invalid':
    'Рядок знижки пошкоджений і виключений з розрахунку',
  'admin.validator.reason.lost_to_operator':
    'Програла іншій знижці за оператором групи',
  'admin.validator.reason.exceeds_price':
    'Не вмістилась: знижки вже зрівняли ціну з нулем',
} as const;
