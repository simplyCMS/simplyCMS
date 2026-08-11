/** Оформлення замовлення та сторінка успіху. */
export const messages = {
  'checkout.title': 'Оформлення замовлення',

  // Toast-и оформлення
  'checkout.emptyCart': 'Кошик порожній',
  'checkout.emptyCartHint': 'Додайте товари в кошик перед оформленням',
  'checkout.placed': 'Замовлення оформлено!',
  'checkout.placedNumber': 'Номер замовлення: {number}',
  'checkout.failed': 'Помилка оформлення',
  'checkout.retry': 'Спробуйте ще раз',

  // Способи доставки й оплати
  'checkout.shipping.pickup': 'Самовивіз',
  'checkout.shipping.novaPoshta': 'Нова Пошта',
  'checkout.shipping.courier': "Кур'єр",
  'checkout.payment.cash': 'Оплата при отриманні',
  'checkout.payment.cashDescription': 'Готівкою або карткою при отриманні',
  'checkout.payment.online': 'Онлайн оплата',
  'checkout.payment.onlineDescription': 'Банківська картка (скоро)',

  // Сторінка успіху
  'checkout.success.title': 'Замовлення оформлено',
  'checkout.success.thanks': 'Дякуємо за замовлення!',
  'checkout.success.sentTo': 'Ми надіслали підтвердження на',
  'checkout.success.orderNumber': 'Номер замовлення',
  'checkout.success.copied': 'Скопійовано',
  'checkout.success.copiedHint': 'Номер замовлення скопійовано в буфер обміну',
  'checkout.success.notFound': 'Замовлення не знайдено',
  'checkout.success.notFoundHint':
    'Можливо, посилання недійсне або термін доступу вичерпано',
  'checkout.success.toHome': 'На головну',
  'checkout.success.details': 'Деталі замовлення',
  'checkout.success.recipient': 'Отримувач',
  'checkout.success.payment': 'Оплата',

  // Дані покупця — CheckoutAuthBlock (@simplycms/checkout-ui)
  'checkout.auth.title': 'Дані покупця',
  'checkout.auth.subtitle':
    'Увійдіть для швидкого оформлення або продовжуйте як гість',
  'checkout.auth.guestTab': 'Гість',
  'checkout.auth.guestHint':
    "Оформіть замовлення без реєстрації. Вкажіть email або телефон для зв'язку.",
  'checkout.auth.invalidCredentials': 'Невірний email або пароль.',
  'checkout.auth.loginSuccess': 'Успішний вхід!',
  'checkout.auth.genericError': 'Щось пішло не так.',
  'checkout.auth.emailAlreadyRegistered': 'Цей email вже зареєстровано.',
  'checkout.auth.registerSuccessCheckEmail':
    'Реєстрація успішна! Перевірте вашу пошту.',
  'checkout.auth.checkEmailToast': 'Перевірте пошту!',
  'checkout.auth.registerSuccess': 'Реєстрація успішна!',

  // Контактні дані — CheckoutContactForm
  'checkout.contactForm.title': 'Контактні дані',
  'checkout.contactForm.firstNameLabel': "Ім'я *",
  'checkout.contactForm.lastNameLabel': 'Прізвище *',
  'checkout.contactForm.contactHint': "* Вкажіть email або телефон для зв'язку",

  // Спільні поля міста/адреси — CheckoutDeliveryForm і CheckoutRecipientForm
  'checkout.cityLabel': 'Місто *',
  'checkout.cityPlaceholder': 'Введіть місто',
  'checkout.streetAddressPlaceholder': 'вул. Хрещатик, 1, кв. 10',
  'checkout.notFound': 'Нічого не знайдено',
  'checkout.saveDialog.updateTitle': 'Оновити «{name}»',
  'checkout.saveDialog.cancelChanges': 'Скасувати зміни',

  // Спосіб доставки — CheckoutDeliveryForm
  'checkout.delivery.addressCreated': 'Нову адресу створено',
  'checkout.delivery.pickupPointLabel': 'Оберіть пункт самовивозу *',
  'checkout.delivery.pickupPointPlaceholder': 'Оберіть пункт',
  'checkout.delivery.savedAddresses': 'Збережені адреси',
  'checkout.delivery.showAll': 'Показати всі ({count})',
  'checkout.delivery.addressLabel': 'Адреса доставки *',
  'checkout.delivery.saveAddress': 'Зберегти адресу',

  // Підсумок замовлення — CheckoutOrderSummary
  'checkout.orderSummary.title': 'Ваше замовлення',
  'checkout.orderSummary.itemsCount': 'Товари ({count})',
  'checkout.orderSummary.notesPlaceholder': 'Додаткова інформація...',
  'checkout.orderSummary.submitting': 'Оформлення...',
  'checkout.orderSummary.submit': 'Підтвердити замовлення',
  'checkout.orderSummary.terms':
    'Натискаючи кнопку, ви погоджуєтесь з умовами обслуговування',

  // Отримувач — CheckoutRecipientForm
  'checkout.recipientForm.created': 'Нового отримувача створено',
  'checkout.recipientForm.differentRecipient': 'Інший отримувач',
  'checkout.recipientForm.differentRecipientHint':
    'Замовлення отримає інша людина',
  'checkout.recipientForm.savedRecipients': 'Збережені отримувачі',
  'checkout.recipientForm.showAll': 'Показати всіх ({count})',
  'checkout.recipientForm.firstNameLabel': "Ім'я отримувача *",
  'checkout.recipientForm.lastNameLabel': 'Прізвище отримувача *',
  'checkout.recipientForm.phoneLabel': 'Телефон отримувача *',
  'checkout.recipientForm.emailLabel': 'Email отримувача',
  'checkout.recipientForm.addressLabel': 'Адреса *',
  'checkout.recipientForm.notesLabel': 'Примітки',
  'checkout.recipientForm.notesPlaceholder':
    'Додаткова інформація про отримувача...',
  'checkout.recipientForm.saveChanges': 'Зберегти зміни',

  // Діалог збереження адреси — AddressSaveDialog
  'checkout.addressSaveDialog.title': 'Зберегти адресу?',
  'checkout.addressSaveDialog.description':
    'Ви змінили адресу доставки. Оберіть дію:',
  'checkout.addressSaveDialog.updateDescription':
    'Зберегти зміни в існуючій адресі',
  'checkout.addressSaveDialog.createTitle': 'Створити нову адресу',
  'checkout.addressSaveDialog.createDescription':
    'Зберегти як нову адресу в довіднику',

  // Вибір адреси зі списку — AddressSelectorPopup
  'checkout.addressSelector.title': 'Оберіть адресу доставки',
  'checkout.addressSelector.searchPlaceholder':
    'Пошук за назвою, містом, адресою...',
  'checkout.addressSelector.sortByName': 'За назвою',
  'checkout.addressSelector.sortByCity': 'За містом',
  'checkout.addressSelector.emptyState': 'Немає збережених адрес',

  // Діалог збереження отримувача — RecipientSaveDialog
  'checkout.recipientSaveDialog.title': 'Зберегти дані отримувача?',
  'checkout.recipientSaveDialog.description':
    'Ви змінили дані отримувача. Оберіть дію:',
  'checkout.recipientSaveDialog.updateDescription':
    'Зберегти зміни в існуючому контакті',
  'checkout.recipientSaveDialog.createTitle': 'Створити нового отримувача',
  'checkout.recipientSaveDialog.createDescription':
    'Зберегти як новий контакт в довіднику',

  // Вибір отримувача зі списку — RecipientSelectorPopup
  'checkout.recipientSelector.title': 'Оберіть отримувача',
  'checkout.recipientSelector.searchPlaceholder':
    "Пошук за ім'ям, телефоном, містом...",
  'checkout.recipientSelector.sortByName': "За ім'ям",
  'checkout.recipientSelector.sortByDate': 'За датою',
  'checkout.recipientSelector.emptyState': 'Немає збережених отримувачів',
} as const;
