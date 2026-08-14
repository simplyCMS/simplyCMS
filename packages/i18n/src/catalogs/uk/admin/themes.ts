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
  'admin.themes.activatedStale': 'Тему активовано, але кеш вітрини не скинуто',
  'admin.themes.appliedOnSite': 'Зміни застосовані на сайті',
  'admin.themes.activateFailed': 'Не вдалося активувати тему',
  'admin.themes.settingsSavedStale':
    'Налаштування збережено, але кеш вітрини не скинуто',
  'admin.themes.notFound': 'Тему не знайдено',
  'admin.themes.back': 'Повернутись',
  'admin.themes.settingsSubtitle': 'Налаштуйте зовнішній вигляд теми',
  'admin.themes.noSettings': 'Ця тема не має налаштувань',
} as const;
