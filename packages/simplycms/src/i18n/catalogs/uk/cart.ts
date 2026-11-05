/** Кошик. */
export const messages = {
  'cart.title': 'Кошик',
  'cart.itemsTitle': 'Товари ({count})',
  // Лічильник товарів у шапці CartDrawer (напр. "3 товари"): форми множини, вибір — `plural`.
  'cart.items': {
    one: '{count} товар',
    few: '{count} товари',
    many: '{count} товарів',
    other: '{count} товару',
  },
  'cart.clear': 'Очистити кошик',
  'cart.empty.title': 'Кошик порожній',
  'cart.empty.description':
    'Перегляньте наш каталог та додайте товари, які вас цікавлять',
  'cart.empty.hint': 'Додайте товари для оформлення замовлення',
  'cart.empty.cta': 'Перейти до каталогу',
  'cart.viewCart': 'Переглянути кошик',
  'cart.itemSku': 'Арт: {sku}',
  'cart.unavailable': 'Товар недоступний',
  'cart.removeItem': 'Видалити з кошика',
  'cart.quoteFailed': 'Ціну не вдалося отримати',
  'cart.quoteRetry': 'Повторити',
  'cart.removeUnavailable':
    'Приберіть недоступні товари, щоб оформити замовлення',
  'cart.limitReached':
    'Досягнуто межу кошика: до {lines} позицій і до {quantity} шт кожної',
  'cart.summary.title': 'Підсумок замовлення',
  'cart.summary.itemsTotal': 'Товарів на суму',
  'cart.summary.shipping': 'Доставка',
  'cart.summary.shippingHint': 'Розраховується при оформленні',
  'cart.summary.total': 'До сплати',
  'cart.summary.checkout': 'Оформити замовлення',
} as const;
