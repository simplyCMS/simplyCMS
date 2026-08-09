/**
 * Повідомлення валідації форм (Zod).
 *
 * Окремий неймспейс, а не `common`, бо ці рядки має бачити один споживач —
 * фабрика схеми (`buildSchema(t)`), і плутати їх із підписами полів не варто:
 * «Назва» і «Назва обовʼязкова» — різні ролі в тому самому екрані.
 */
export const messages = {
  'validation.nameRequired': "Назва обов'язкова",
  'validation.codeRequired': "Код обов'язковий",
  'validation.cityRequired': "Місто обов'язкове",
  'validation.addressRequired': "Адреса обов'язкова",

  'validation.min2': 'Мінімум 2 символи',
  'validation.min6': 'Мінімум 6 символів',
  'validation.max20': 'Максимум 20 символів',
  'validation.max100': 'Максимум 100 символів',
  'validation.positive': 'Значення має бути додатнім',

  'validation.email': 'Введіть коректний email',
  'validation.emailFormat': 'Невірний формат email',
  'validation.phone': 'Введіть коректний номер телефону',
  // Дозволений набір символів для машинних ідентифікаторів (slug, code).
  'validation.slug': 'Тільки латинські літери, цифри та _',

  'validation.firstNameMin2': "Ім'я має містити мінімум 2 символи",
  'validation.lastNameMin2': 'Прізвище має містити мінімум 2 символи',
  'validation.passwordMin6': 'Пароль має містити мінімум 6 символів',
  'validation.passwordMismatch': 'Паролі не співпадають',

  'validation.shippingRequired': 'Оберіть спосіб доставки',
  'validation.paymentRequired': 'Оберіть спосіб оплати',
  'validation.contactRequired': "Вкажіть email або телефон для зв'язку",
  'validation.recipientRequired': "Заповніть всі обов'язкові поля отримувача",
  'validation.groupRequired': 'Оберіть групу',
  'validation.priceTypeRequired': 'Оберіть вид ціни',
  'validation.targetCategoryRequired': 'Оберіть категорію призначення',
} as const;
