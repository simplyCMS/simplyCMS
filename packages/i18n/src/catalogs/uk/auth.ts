/** Автентифікація. */
export const messages = {
  // Встановлення пароля після запрошення власника
  'auth.setPassword.title': 'Встановіть пароль',
  'auth.setPassword.description':
    'Ви прийняли запрошення. Задайте пароль для входу в магазин.',
  'auth.setPassword.password': 'Пароль',
  'auth.setPassword.confirm': 'Повторіть пароль',
  'auth.setPassword.submit': 'Зберегти і продовжити',
  'auth.setPassword.mismatch': 'Паролі не збігаються',
  'auth.setPassword.tooShort': 'Мінімум 8 символів',
  'auth.setPassword.noSession':
    'Посилання недійсне або протермінувалось. Попросіть надіслати запрошення повторно.',
  'auth.setPassword.backToAuth': 'Перейти до входу',
  'auth.setPassword.error': 'Не вдалося зберегти пароль. Спробуйте ще раз.',
} as const;
