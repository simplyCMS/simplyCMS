/** Розширення (плагіни) в адмінці. */
export const messages = {
  'admin.plugins.toggleFailed': 'Не вдалося змінити статус плагіна "{name}"',
  'admin.plugins.toggleFailedShort': 'Не вдалося змінити статус плагіна.',
  'admin.plugins.activated': 'Плагін активовано',
  'admin.plugins.deactivated': 'Плагін деактивовано',
  'admin.plugins.activatedHint': 'Плагін "{name}" активовано успішно.',
  'admin.plugins.deactivatedHint': 'Плагін "{name}" деактивовано успішно.',

  // Список плагінів
  'admin.plugins.subtitle': 'Керування плагінами та модулями системи',
  'admin.plugins.empty': 'Немає встановлених плагінів',
  'admin.plugins.emptyHint':
    'Плагіни дозволяють розширювати функціональність системи. Встановіть плагін, щоб додати нові можливості.',
  'admin.plugins.noDescription': 'Без опису',
  'admin.plugins.moduleMissing': 'Модуль не знайдено',
  'admin.plugins.hooks': 'Хуки:',
  'admin.plugins.deleteTitle': 'Видалити плагін?',
  'admin.plugins.deleteText':
    'Плагін "{name}" буде видалено. Цю дію неможливо скасувати.',
  'admin.plugins.deleted': 'Плагін видалено',
  'admin.plugins.deletedHint': 'Плагін "{name}" успішно видалено.',
  'admin.plugins.deleteFailed': 'Не вдалося видалити плагін.',
  'admin.plugins.modules': 'Доступні модулі',
  'admin.plugins.modulesHint': 'Зареєстровані модулі плагінів у системі',
  'admin.plugins.modulesEmpty':
    'Немає зареєстрованих модулів. Модулі реєструються при завантаженні застосунку.',

  // Налаштування плагіна
  'admin.plugins.enabled': 'Розширення активовано',
  'admin.plugins.disabled': 'Розширення деактивовано',
  'admin.plugins.notFound': 'Розширення не знайдено',
  'admin.plugins.backToList': 'Повернутися до списку',
  'admin.plugins.deactivate': 'Деактивувати',
  'admin.plugins.settingsHint': 'Налаштуйте параметри роботи розширення',
  'admin.plugins.noSettings': 'Це розширення не має налаштувань',
  'admin.plugins.registeredHooks': 'Зареєстровані хуки',
  'admin.plugins.registeredHooksHint':
    'Точки розширення, які використовує плагін',
  'admin.plugins.noHooks': 'Немає зареєстрованих хуків',
  'admin.plugins.version': 'Версія',
  'admin.plugins.installedAt': 'Встановлено',
  'admin.plugins.updatedAt': 'Оновлено',

  // Встановлення плагіна
  'admin.plugins.install': 'Встановити плагін',
  'admin.plugins.installTitle': 'Встановлення плагіна',
  'admin.plugins.installHint':
    'Додайте новий плагін до системи. Виберіть із зареєстрованих модулів або введіть дані вручну.',
  'admin.plugins.pickModuleHint':
    'Натисніть на модуль, щоб заповнити форму автоматично',
  'admin.plugins.systemName': 'Системна назва',
  'admin.plugins.systemNameHint': 'Унікальна назва (латиницею, без пробілів)',
  'admin.plugins.displayName': 'Відображувана назва',
  'admin.plugins.namePlaceholder': 'Мій плагін',
  'admin.plugins.authorPlaceholder': "Ваше ім'я",
  'admin.plugins.descriptionPlaceholder':
    'Короткий опис функціональності плагіна...',
  'admin.plugins.unknownModuleWarning':
    '⚠️ Модуль "{name}" не знайдено в системі. Плагін буде зареєстровано, але для його роботи потрібно додати код модуля до проєкту.',
  'admin.plugins.installAction': 'Встановити',
  'admin.plugins.installed': 'Плагін встановлено',
  'admin.plugins.installedHint': 'Плагін "{name}" успішно додано до системи.',
  'admin.plugins.installFailed': 'Помилка встановлення',
  'admin.plugins.requiredFields': "Заповніть обов'язкові поля",
  'admin.plugins.requiredFieldsHint':
    "Назва та відображувана назва обов'язкові",
} as const;
