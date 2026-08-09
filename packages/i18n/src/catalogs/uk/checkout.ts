/** Оформлення замовлення та сторінка успіху. */
export const messages = {
  'checkout.title': 'Оформлення замовлення',

  // Toast-и оформлення
  'checkout.emptyCart': 'Кошик порожній',
  'checkout.emptyCartHint': 'Додайте товари в кошик перед оформленням',
  'checkout.placed': 'Замовлення оформлено!',
  'checkout.placedNumber': 'Номер замовлення: {number}',
  'checkout.failed': 'Помилка оформлення',
  'checkout.retry': 'Спробуйте ще раз',

  // Способи доставки й оплати
  'checkout.shipping.pickup': 'Самовивіз',
  'checkout.shipping.novaPoshta': 'Нова Пошта',
  'checkout.shipping.courier': "Кур'єр",
  'checkout.payment.cash': 'Оплата при отриманні',
  'checkout.payment.online': 'Онлайн оплата',

  // Сторінка успіху
  'checkout.success.title': 'Замовлення оформлено',
  'checkout.success.thanks': 'Дякуємо за замовлення!',
  'checkout.success.sentTo': 'Ми надіслали підтвердження на',
  'checkout.success.orderNumber': 'Номер замовлення',
  'checkout.success.copied': 'Скопійовано',
  'checkout.success.copiedHint': 'Номер замовлення скопійовано в буфер обміну',
  'checkout.success.notFound': 'Замовлення не знайдено',
  'checkout.success.notFoundHint':
    'Можливо, посилання недійсне або термін доступу вичерпано',
  'checkout.success.toHome': 'На головну',
  'checkout.success.details': 'Деталі замовлення',
  'checkout.success.recipient': 'Отримувач',
  'checkout.success.payment': 'Оплата',
} as const;
