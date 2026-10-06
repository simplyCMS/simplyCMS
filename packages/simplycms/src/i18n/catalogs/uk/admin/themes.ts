/** Теми оформлення. */
export const messages = {
  'admin.themes.title': 'Теми оформлення',
  'admin.themes.subtitle': 'Управління зовнішнім виглядом магазину',
  'admin.themes.empty': 'Немає зареєстрованих тем',
  'admin.themes.emptyHint': 'Теми додаються через код проекту та міграції БД',
  'admin.themes.author': 'Автор:',
  'admin.themes.moduleMissing': 'Модуль відсутній',
  'admin.themes.moduleMissingHint':
    'Тема є в базі, але її модуль не зареєстровано в simplycms.config.ts — встанови пакет теми й перезбери магазин.',
  'admin.themes.activateTitle': 'Активувати тему?',
  'admin.themes.activateText':
    'Тема "{name}" буде активована. Зміни буде застосовано на сайті одразу.',
  'admin.themes.activated': 'Тему активовано',
  'admin.themes.appliedOnSite': 'Зміни застосовані на сайті',
  'admin.themes.notFound': 'Тему не знайдено',
  'admin.themes.back': 'Повернутись',
  'admin.themes.settingsSubtitle': 'Налаштуйте зовнішній вигляд теми',
  'admin.themes.noSettings': 'Ця тема не має налаштувань',
  'admin.themes.loadError': 'Не вдалося завантажити список тем',
  'admin.themes.settingMin': 'Значення має бути не менше {min}',
  'admin.themes.settingMax': 'Значення має бути не більше {max}',
} as const;
