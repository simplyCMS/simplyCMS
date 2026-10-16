/** Переклади сутностей у картках адмінки: вкладки мов, статуси, конфлікт версії, адреса. */
export const messages = {
  'admin.translations.source': 'джерело',
  'admin.translations.languages': 'Мови',
  'admin.translations.status.current': 'Актуальний',
  'admin.translations.status.outdated': 'Застарілий',
  'admin.translations.status.missing': 'Немає перекладу',
  'admin.translations.status.outdatedHint':
    'Джерело змінилось після цього перекладу',
  'admin.translations.conflict.title': 'Товар змінив хтось інший',
  'admin.translations.conflict.description':
    'Хтось зберіг цей товар раніше за вас. Ваші зміни лишились у формі. Перезавантаження підтягне актуальні дані, а незбережене буде втрачене.',
  'admin.translations.conflict.reload': 'Перезавантажити',
  'admin.translations.conflict.keep': 'Лишити мої зміни',
  'admin.translations.path.label': 'Адреса (URL) мови {language}',
  'admin.translations.path.save': 'Зберегти адресу',
  'admin.translations.path.saved': 'Адресу збережено',
  'admin.translations.nothingToSave': 'Змін для збереження немає',
  'admin.translations.loadFailed': 'Не вдалося завантажити товар',
  'admin.translations.retry': 'Спробувати ще раз',
  'admin.translations.unsavedChildren':
    'Зміни модифікацій, значень і фото збережуться кнопкою «Зберегти» картки',
} as const;
