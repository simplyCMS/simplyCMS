/** Особистий кабінет: огляд, налаштування, список і картка замовлення. */
export const messages = {
  'profile.title': 'Мій профіль',
  'profile.personalData': 'Особисті дані',
  'profile.recentOrders': 'Останні замовлення',
  'profile.allOrders': 'Всі замовлення',
  'profile.noOrders': 'У вас ще немає замовлень',

  // Список замовлень
  'profile.orders.title': 'Мої замовлення',
  'profile.orders.allStatuses': 'Всі статуси',
  'profile.orders.noneForStatus': 'Замовлень з таким статусом не знайдено',
  'profile.orders.emptyHint':
    'Перегляньте наш каталог та оформіть перше замовлення',
  'profile.orders.filterHint': 'Спробуйте обрати інший фільтр',
  'profile.orders.moreItems': 'та ще {count} позицій',

  // Картка замовлення
  'profile.order.notFound': 'Замовлення не знайдено',
  'profile.order.notFoundHint':
    'Можливо, воно було видалено або ви не маєте до нього доступу',
  'profile.order.items': 'Товари замовлення',
  'profile.order.shippingMethod': 'Спосіб доставки',
  'profile.order.paymentMethod': 'Спосіб оплати',
  'profile.order.customer': 'Замовник',
  'profile.order.comment': 'Коментар до замовлення',

  // Скасування замовлення
  'profile.order.cancel.statusMissing': "Статус 'Скасовано' не знайдено",
  'profile.order.cancel.notAuthorized': 'Користувач не авторизований',
  'profile.order.cancel.confirmTitle': 'Скасувати замовлення?',
  'profile.order.cancel.confirmText':
    'Ви впевнені, що хочете скасувати замовлення {number}? Цю дію неможливо буде відмінити.',
  'profile.order.cancel.keep': 'Ні, залишити',
  'profile.order.cancel.confirm': 'Так, скасувати',
  'profile.order.cancel.pending': 'Скасування...',
  'profile.order.cancel.done': 'Замовлення скасовано',
  'profile.order.cancel.doneHint': 'Замовлення {number} успішно скасовано',
  'profile.order.cancel.failed': 'Не вдалось скасувати замовлення',

  // Налаштування профілю
  'profile.settings.avatar': 'Фото профілю',
  'profile.settings.editContacts': 'Редагуйте свої контактні дані',
  'profile.settings.firstNamePlaceholder': "Введіть ім'я",
  'profile.settings.lastNamePlaceholder': 'Введіть прізвище',
  'profile.settings.emailLocked': 'Email неможливо змінити',
  'profile.settings.saved': 'Збережено',
  'profile.settings.savedHint': 'Ваші дані успішно оновлено',
  'profile.settings.saveFailed': 'Не вдалось зберегти дані',

  // Зміна пароля
  'profile.password.title': 'Зміна пароля',
  'profile.password.subtitle': 'Встановіть новий пароль для вашого акаунта',
  'profile.password.new': 'Новий пароль',
  'profile.password.confirm': 'Підтвердіть пароль',
  'profile.password.confirmPlaceholder': 'Повторіть новий пароль',
  'profile.password.submit': 'Змінити пароль',
  'profile.password.pending': 'Зміна...',
  'profile.password.changed': 'Пароль змінено',
  'profile.password.changedHint': 'Ваш пароль успішно оновлено',
  'profile.password.failed': 'Не вдалось змінити пароль',

  // Адреси доставки — CRUD-віджет у профілі (@simplycms/profile-ui, AddressesList)
  'profile.addresses.title': 'Адреси доставки',
  'profile.addresses.empty': 'Ви ще не додали жодної адреси',
  'profile.addresses.deleted': 'Адресу видалено',
  'profile.addresses.editTitle': 'Редагування адреси',
  'profile.addresses.namePlaceholder': 'Дім, Робота...',
  'profile.addresses.cityPlaceholder': 'Київ',
  'profile.addresses.addressPlaceholder': 'вул. Хрещатик, 1, кв. 1',
  'profile.addresses.deleteTitle': 'Видалити адресу «{name}»?',
  'profile.addresses.deleteUsedOne':
    'Ця адреса використовується в {count} замовленні.',
  'profile.addresses.deleteUsedMany':
    'Ця адреса використовується в {count} замовленнях.',
  'profile.addresses.deleteKeepsData': 'Дані адреси в замовленнях збережуться.',
  'profile.addresses.deleteConfirm':
    'Ви впевнені, що хочете видалити цю адресу?',

  // Отримувачі — CRUD-віджет у профілі (@simplycms/profile-ui, RecipientsList)
  'profile.recipients.title': 'Отримувачі',
  'profile.recipients.empty': 'Ви ще не додали жодного отримувача',
  'profile.recipients.deleted': 'Отримувача видалено',
  'profile.recipients.defaultBadge': 'Основний',
  'profile.recipients.editTitle': 'Редагування отримувача',
  'profile.recipients.emailOptionalLabel': "Email (необов'язково)",
  'profile.recipients.notesLabel': 'Нотатки',
  'profile.recipients.notesPlaceholder': 'Наприклад: Мама, колега...',
  'profile.recipients.defaultCheckboxLabel': 'Основний отримувач',
  'profile.recipients.deleteTitle': 'Видалити отримувача «{fullName}»?',
  'profile.recipients.deleteUsedOne':
    'Цей контакт використовується в {count} замовленні.',
  'profile.recipients.deleteUsedMany':
    'Цей контакт використовується в {count} замовленнях.',
  'profile.recipients.deleteKeepsData':
    'Дані отримувача в замовленнях збережуться.',
  'profile.recipients.deleteConfirm':
    'Ви впевнені, що хочете видалити цього отримувача?',

  // Бейдж «використано в N замовленнях» — спільний для адрес і отримувачів.
  // 🔴 Лише дві форми, не три: локатив розрізняє однину/множину, а не
  // 1/2-4/5+ як родовий відмінок — тому «few»-форма тут не потрібна.
  'profile.usedInOrders.one': 'Використано в {count} замовленні',
  'profile.usedInOrders.many': 'Використано в {count} замовленнях',

  // Фото профілю (@simplycms/profile-ui, AvatarUpload)
  'profile.avatar.uploadError': 'Помилка завантаження',
  'profile.avatar.unsupportedFormat': 'Підтримуються тільки JPG, PNG та WebP',
  'profile.avatar.tooLarge': 'Максимальний розмір файлу 5MB',
  'profile.avatar.updated': 'Аватар оновлено',
  'profile.avatar.removed': 'Аватар видалено',
  'profile.avatar.deleteError': 'Помилка видалення',
  'profile.avatar.uploadButton': 'Завантажити фото',
  'profile.avatar.formatHint': 'JPG, PNG або WebP. Макс. 5MB.',
} as const;
