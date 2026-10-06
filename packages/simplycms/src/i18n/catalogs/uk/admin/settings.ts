/** Загальні налаштування магазину. */
export const messages = {
  'admin.settings.subtitle': 'Загальні налаштування системи',
  'admin.settings.stock': 'Управління залишками',
  'admin.settings.stockHint':
    'Налаштування автоматичного обліку залишків товарів',
  'admin.settings.decreaseStock':
    'Зменшувати залишки при оформленні замовлення',
  'admin.settings.decreaseStockHint':
    'Коли увімкнено, система автоматично зменшує кількість товару на складі при створенні нового замовлення',
  'admin.settings.enabledCase':
    '• При увімкненій опції: коли клієнт оформлює замовлення, залишки автоматично зменшуються на вказану кількість',
  'admin.settings.disabledCase':
    '• При вимкненій опції: залишки не змінюються автоматично, адміністратор керує ними вручну',
  'admin.settings.warehouseNote':
    '• Залишки зменшуються з того складу, який вказаний у замовленні (точка самовивозу), або з першого доступного',
  // Профіль магазину (Е6б).
  'admin.settings.loadError': 'Не вдалося завантажити налаштування',
  'admin.settings.profile.title': 'Профіль і SEO',
  'admin.settings.profile.hint':
    'Назва й опис потрапляють у заголовок вкладки, мета-теги та розмітку головної',
  'admin.settings.field.name': 'Назва магазину',
  'admin.settings.field.homeTitle': 'Заголовок головної сторінки',
  'admin.settings.field.homeTitleHint': 'Порожнє — використовується назва',
  'admin.settings.field.description': 'Опис за замовчуванням',
  'admin.settings.contacts.title': 'Контакти',
  'admin.settings.field.phone': 'Телефон',
  'admin.settings.field.email': 'Email',
  'admin.settings.field.address': 'Адреса',
  'admin.settings.field.hours': 'Години роботи',
  'admin.settings.logo.title': 'Логотип',
  'admin.settings.logo.hint':
    'Файл замінюється або стирається під час збереження профілю',
  'admin.settings.socials.title': 'Соцмережі',
  'admin.settings.socials.network': 'Мережа',
  'admin.settings.socials.url': 'Посилання',
  'admin.settings.socials.add': 'Додати мережу',
  'admin.settings.socials.remove': 'Прибрати мережу',
  'admin.settings.socials.urlInvalid': 'Посилання має починатися з https://',
  'admin.settings.network.instagram': 'Instagram',
  'admin.settings.network.facebook': 'Facebook',
  'admin.settings.network.telegram': 'Telegram',
  'admin.settings.network.tiktok': 'TikTok',
  'admin.settings.network.youtube': 'YouTube',
  'admin.settings.network.x': 'X',
  'admin.settings.network.viber': 'Viber',
} as const;
