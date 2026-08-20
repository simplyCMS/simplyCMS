/** Кошик. */
export const messages = {
  'cart.title': 'Кошик',
  'cart.items': 'Товари ({count})',
  // Форми множини лічильника товарів у шапці CartDrawer (напр. "(3 товари)").
  // Українська має 3 форми — вибір форми лишається в коді (pluralItemsKey).
  'cart.itemsOne': 'товар',
  'cart.itemsFew': 'товари',
  'cart.itemsMany': 'товарів',
  'cart.clear': 'Очистити кошик',
  'cart.empty.title': 'Кошик порожній',
  'cart.empty.description':
    'Перегляньте наш каталог та додайте товари, які вас цікавлять',
  'cart.empty.hint': 'Додайте товари для оформлення замовлення',
  'cart.empty.cta': 'Перейти до каталогу',
  'cart.viewCart': 'Переглянути кошик',
  'cart.itemSku': 'Арт: {sku}',
  'cart.summary.title': 'Підсумок замовлення',
  'cart.summary.itemsTotal': 'Товарів на суму',
  'cart.summary.shipping': 'Доставка',
  'cart.summary.shippingHint': 'Розраховується при оформленні',
  'cart.summary.total': 'До сплати',
  'cart.summary.checkout': 'Оформити замовлення',
} as const;
