/** Каркас адмінки: шапка, заглушки, спільні для адмінки повідомлення. */
export const messages = {
  'admin.common.title': 'Адмін-панель',
  'admin.common.toSite': 'На сайт',
  'admin.common.signedOut': 'Вихід виконано',
  'admin.common.signedOutHint': 'Ви успішно вийшли з системи',
  'admin.common.loading': 'Завантаження адмінки…',

  // Сторінки-заглушки (розділи, яких ще немає)
  'admin.common.placeholder.fallback': 'Сторінка',
  'admin.common.placeholder.title': 'Ця сторінка в розробці',
  'admin.common.placeholder.badge': 'В розробці',
  'admin.common.placeholder.text':
    'Ця функціональність буде доступна найближчим часом. Зараз ви можете користуватись іншими розділами CMS.',
  'admin.common.placeholder.orderStatuses': 'Статуси замовлень',
  'admin.common.placeholder.serviceRequests': 'Заявки на послуги',

  // Скидання кешу вітрини після змін теми
  'admin.common.revalidate.serverError': 'Сервер відповів {status}',
  'admin.common.revalidate.delay': 'Зміни зʼявляться протягом 5 хвилин.',
} as const;
