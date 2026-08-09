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

  // Сторінка входу / реєстрації
  // 🔴 `auth.tagline` — брендовий текст магазину, що історично осів у
  // канонічній сторінці ядра. Міграція його лише локалізує; винесення в
  // налаштування магазину — окремий борг (див. план i18n, §5).
  'auth.tagline': 'Альтернативна енергетика для вашого дому',
  'auth.login.title': 'Вхід в акаунт',
  'auth.login.subtitle': 'Увійдіть для доступу до особистого кабінету',
  'auth.login.tab': 'Вхід',
  'auth.login.submit': 'Увійти',
  'auth.login.pending': 'Вхід...',
  'auth.login.failed': 'Помилка входу',
  'auth.login.badCredentials': 'Невірний email або пароль',
  'auth.login.success': 'Успішний вхід',
  'auth.login.welcome': 'Ласкаво просимо!',

  'auth.register.title': 'Реєстрація',
  'auth.register.subtitle':
    'Створіть акаунт для покупок та відстеження замовлень',
  'auth.register.submit': 'Зареєструватися',
  'auth.register.pending': 'Реєстрація...',
  'auth.register.failed': 'Помилка реєстрації',
  'auth.register.success': 'Реєстрація успішна',
  'auth.register.created': 'Ваш акаунт створено!',

  'auth.password': 'Пароль',
  'auth.passwordConfirm': 'Підтвердити пароль',
  'auth.firstNamePlaceholder': 'Іван',
  'auth.lastNamePlaceholder': 'Петренко',
  'auth.google': 'Продовжити з Google',
  'auth.googleFailed': 'Помилка Google авторизації',
  'auth.backHome': 'Повернутися на головну',
  'auth.genericError': 'Щось пішло не так. Спробуйте ще раз.',
} as const;
