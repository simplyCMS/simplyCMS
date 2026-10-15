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
  // Сховище файлів: хвости стирання (Е6д-20).
  'admin.settings.storage.title': 'Сховище файлів',
  'admin.settings.storage.hint':
    'Файли, які не вдалося стерти після видалення запису. Їх уже не видно на сайті',
  'admin.settings.storage.count': 'Хвостів стирання: {count}',
  'admin.settings.storage.attempts': 'Спроб: {count}, остання {date}',
  'admin.settings.storage.retry': 'Повторити стирання',
  'admin.settings.storage.retried': 'Стерто: {done}, не вдалося: {failed}',
  'admin.settings.storage.loadError': 'Не вдалося завантажити хвости стирання',
  'admin.settings.storage.sweep': 'Прибрати неприв’язані файли',
  'admin.settings.storage.sweepTitle': 'Прибрати неприв’язані файли?',
  'admin.settings.storage.sweepText':
    'Буде стерто файли, які старші за добу й ніде не використовуються. Скасувати це не можна',
  'admin.settings.storage.swept': 'Прибрано файлів: {count}',
  // Пошта: хвости outbox (Е8-Р10).
  'admin.settings.mail.title': 'Пошта',
  'admin.settings.mail.hint':
    'Листи, які не вдалося надіслати. Тіло листа тут не показується — воно може містити посилання для входу',
  'admin.settings.mail.empty': 'Усі листи надіслано',
  'admin.settings.mail.count': 'Листів у черзі: {count}',
  'admin.settings.mail.attempts': 'Спроб: {count}, у черзі {age}',
  'admin.settings.mail.retry': 'Повторити надсилання',
  'admin.settings.mail.retried': 'Надіслано: {sent}, не вдалося: {failed}',
  'admin.settings.mail.loadError': 'Не вдалося завантажити чергу листів',
  'admin.settings.mail.ageMinutes': '{count} хв',
  'admin.settings.mail.ageHours': '{count} год',
  'admin.settings.mail.ageDays': '{count} дн.',
  'admin.settings.mail.kind.password_reset': 'Скидання пароля',
  'admin.settings.mail.kind.email_verification': 'Підтвердження пошти',
  'admin.settings.mail.kind.owner_invite': 'Запрошення власника',
  'admin.settings.mail.kind.order_customer': 'Лист покупцю про замовлення',
  'admin.settings.mail.kind.order_owner': 'Лист власнику про замовлення',
} as const;
