/**
 * Український каталог — джерело правди набору ключів.
 *
 * `MessageKey` виводиться саме звідси (`keyof typeof messages`), тож новий ключ
 * додається спершу тут; решта каталогів — часткові й падають у fallback на uk.
 */
export const messages = {
  // Навігація профілю (ProtectedShell)
  'nav.profile': 'Профіль',
  'nav.orders': 'Мої замовлення',
  'nav.settings': 'Налаштування',
  'nav.signOut': 'Вийти',

  // Хлібні крихти
  'breadcrumbs.home': 'Головна',

  // Кошик
  'cart.title': 'Кошик',
  'cart.items': 'Товари ({count})',
  'cart.clear': 'Очистити кошик',
  'cart.empty.title': 'Кошик порожній',
  'cart.empty.description':
    'Перегляньте наш каталог та додайте товари, які вас цікавлять',
  'cart.empty.cta': 'Перейти до каталогу',
  'cart.summary.title': 'Підсумок замовлення',
  'cart.summary.itemsTotal': 'Товарів на суму',
  'cart.summary.shipping': 'Доставка',
  'cart.summary.shippingHint': 'Розраховується при оформленні',
  'cart.summary.total': 'До сплати',
  'cart.summary.checkout': 'Оформити замовлення',
} as const;
