/** Конфлікти БД (Е3-7) — мапляться з `AdminConflictError` через `adminErrorKey`. */
export const messages = {
  'admin.errors.slugTaken': 'Такий URL (slug) уже зайнятий — змініть його',
  'admin.errors.conflictUnique': 'Таке значення вже існує',
  'admin.errors.conflictReference':
    'Запис використовується (наприклад, у замовленнях) — деактивуйте його замість видалення',
  'admin.errors.network': 'Немає звʼязку із сервером — зміни не збережено',
} as const;
