/** Каркас адмінки: шапка, заглушки, спільні для адмінки повідомлення. */
export const messages = {
  'admin.common.title': 'Адмін-панель',
  'admin.common.toSite': 'На сайт',
  'admin.common.uiLocale': 'Мова інтерфейсу',
  'admin.common.uiLocaleFailed': 'Не вдалося змінити мову інтерфейсу',
  'admin.common.signedOut': 'Вихід виконано',
  'admin.common.signedOutHint': 'Ви успішно вийшли з системи',

  // Сторінки-заглушки (розділи, яких ще немає)
  'admin.common.placeholder.fallback': 'Сторінка',
  'admin.common.placeholder.title': 'Ця сторінка в розробці',
  'admin.common.placeholder.badge': 'В розробці',
  'admin.common.placeholder.text':
    'Ця функціональність буде доступна найближчим часом. Зараз ви можете користуватись іншими розділами CMS.',
  'admin.common.placeholder.orderStatuses': 'Статуси замовлень',

  // Спільні підписи форм адмінки (Е4)
  'admin.common.slug': 'URL (slug)',
  'admin.common.seo': 'SEO',
  'admin.common.metaTitle': 'Meta Title',
  'admin.common.metaDescription': 'Meta Description',
} as const;
