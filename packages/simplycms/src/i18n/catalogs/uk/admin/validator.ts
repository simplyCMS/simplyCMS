/** Валідатор цін: покроковий розбір ціноутворення. */
export const messages = {
  'admin.validator.subtitle':
    'Перевірте ланцюжок ціноутворення для конкретного користувача та товару',
  'admin.validator.params': 'Параметри перевірки',
  'admin.validator.guestOption': 'Гість (без авторизації)',
  'admin.validator.guest': 'Гість',
  'admin.validator.noEmail': 'без email',
  'admin.validator.noModification': 'Без модифікації',
  'admin.validator.cartTotal': 'Сума кошика (грн)',
  'admin.validator.run': 'Перевірити',
  'admin.validator.result': 'Результат аналізу',
  'admin.validator.applied': 'Застосовано',
  'admin.validator.rejected': 'Відхилено',
  'admin.validator.categoryStep':
    'Категорія "{category}" → Вид ціни "{priceType}"',
  'admin.validator.noCategoryStep':
    'Користувач без категорії → За замовчуванням "{priceType}"',
  'admin.validator.guestStep': 'Гість → За замовчуванням "{priceType}"',
  'admin.validator.undefined': 'Не визначено',
  'admin.validator.noPriceType': 'Не знайдено жодного виду ціни',
  'admin.validator.notFound': 'Не знайдено',
  'admin.validator.noPriceForType': 'Немає ціни для цього виду ціни',
  'admin.validator.none': 'Немає',
  'admin.validator.noDiscountForType':
    'Жодна скидка не знайдена для цього виду ціни',
  'admin.validator.finalPrice': 'Фінальна ціна',
  'admin.validator.noDiscount': 'Без знижки: {price} грн',
  'admin.validator.discountSum': '-{value} грн',
  'admin.validator.appliedCount': 'Застосовано {count} скидок',
  'admin.validator.noneApplies': 'Жодна скидка не підходить',
  'admin.validator.uah': '{value} грн',
  'admin.validator.fixedUah': '= {value} грн',
} as const;
