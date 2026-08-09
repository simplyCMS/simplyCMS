/** Властивості товарів і їх опції в адмінці. */
export const messages = {
  'admin.properties.subtitle': 'Глобальні властивості для товарів',
  'admin.properties.add': 'Додати властивість',
  'admin.properties.new': 'Нова властивість',
  'admin.properties.all': 'Всі властивості',
  'admin.properties.empty': 'Властивостей ще немає',
  'admin.properties.namePlaceholder': 'Виробник',
  'admin.properties.typeLabel': 'Тип властивості',
  'admin.properties.required': "Обов'язкова",
  'admin.properties.showInFilters': 'Показувати у фільтрах',
  'admin.properties.hasPage': 'Створювати сторінки для значень',
  'admin.properties.created': 'Властивість створено',
  'admin.properties.saved': 'Властивість збережено',
  'admin.properties.deleted': 'Властивість видалено',
  'admin.properties.confirmDelete': 'Видалити цю властивість?',
  'admin.properties.editTitle': 'Редагування властивості',
  'admin.properties.fallbackTitle': 'Властивість',

  // Типи властивостей (код у БД → підпис)
  'admin.properties.type.text': 'Текст',
  'admin.properties.type.number': 'Число',
  'admin.properties.type.select': 'Вибір (один)',
  'admin.properties.type.multiselect': 'Вибір (декілька)',
  'admin.properties.type.range': 'Діапазон',
  'admin.properties.type.color': 'Колір',
  'admin.properties.type.boolean': 'Так/Ні',

  // Опції властивості
  'admin.properties.options.title': 'Опції властивості',
  'admin.properties.options.add': 'Додати опцію',
  'admin.properties.options.empty': 'Опцій ще немає. Додайте першу опцію.',
  'admin.properties.options.page': 'Сторінка',
  'admin.properties.options.filled': 'Заповнено',
  'admin.properties.options.created': 'Опцію створено',
  'admin.properties.options.saved': 'Опцію збережено',
  'admin.properties.options.deleted': 'Опцію видалено',
  'admin.properties.options.confirmDelete': 'Видалити цю опцію?',
  'admin.properties.options.new': 'Нова опція',
  'admin.properties.options.fallbackTitle': 'Опція',
  'admin.properties.options.parent': 'Властивість:',
  'admin.properties.options.pageSection': 'Сторінка опції',
  'admin.properties.options.slugHint':
    'Залиште порожнім для автоматичної генерації',
  'admin.properties.options.seoTitlePlaceholder': 'Назва для пошукових систем',
  'admin.properties.options.titleCounter': '/60 символів',
  'admin.properties.options.descriptionCounter': '/160 символів',

  // Властивості розділу (призначення товарам / модифікаціям)
  'admin.properties.section.title': 'Властивості розділу',
  'admin.properties.section.empty':
    'Властивостей ще немає. Додайте властивості до розділу.',
  'admin.properties.section.addToSection': 'Додати властивість до розділу',
  'admin.properties.section.notConfigured':
    'Для цього розділу ще не налаштовані властивості',
  'admin.properties.section.pickSection':
    'Оберіть розділ, щоб налаштувати властивості',
  'admin.properties.section.productProps': 'Властивості товару',
  'admin.properties.section.modificationProps': 'Властивості модифікацій',
  'admin.properties.section.addForProduct': 'Додати властивість для товарів',
  'admin.properties.section.addForModification':
    'Додати властивість для модифікацій',
  'admin.properties.section.pickProperty': 'Виберіть властивість',
  'admin.properties.section.pickPropertyPlaceholder': 'Оберіть властивість...',
  'admin.properties.section.allAdded': 'Всі властивості вже додано',
  'admin.properties.section.added': 'Властивість додано',
  'admin.properties.section.removed': 'Властивість видалено з розділу',

  // Значення властивостей у картці товару
  'admin.properties.appliesTo.product': 'товар',
  'admin.properties.appliesTo.modification': 'модифікація',
  'admin.properties.values.titleModification': 'Властивості модифікації',
  'admin.properties.values.pickValue': 'Оберіть значення',
  'admin.properties.values.noOptions':
    'Опцій не знайдено. Додайте опції у властивості.',
  'admin.properties.values.inputPlaceholder': 'Введіть {name}',
} as const;
