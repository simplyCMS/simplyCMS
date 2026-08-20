/** Доставка: служби, зони, точки самовивозу. */
export const messages = {
  'admin.shipping.subtitle':
    'Управління службами доставки, зонами та точками самовивозу',
  'admin.shipping.activeOf': 'активних з',
  'admin.shipping.go': 'Перейти',
  'admin.shipping.methodsHint':
    "Налаштуйте способи доставки: самовивіз, кур'єр, плагіни перевізників",
  'admin.shipping.zonesHint':
    'Створіть географічні зони з різними тарифами доставки',
  'admin.shipping.pointsHint':
    'Додайте адреси магазинів та пунктів видачі замовлень',
  'admin.shipping.locations': 'Локації',
  'admin.shipping.locationsHint':
    'Довідник країн, областей та міст для зон доставки',
  'admin.shipping.source.manual': 'Ручний',
  'admin.shipping.source.plugin': 'Плагін',

  // Служби доставки
  'admin.shipping.methods.subtitle': 'Управління способами доставки замовлень',
  'admin.shipping.methods.add': 'Додати службу',
  'admin.shipping.methods.all': 'Всі служби доставки',
  'admin.shipping.methods.empty': 'Служби доставки не знайдено',
  'admin.shipping.methods.confirmDelete': 'Видалити цю службу доставки?',
  'admin.shipping.methods.deleted': 'Службу видалено',
  'admin.shipping.methods.deleteFailed': 'Помилка видалення служби',
  'admin.shipping.methods.created': 'Службу створено',
  'admin.shipping.methods.new': 'Нова служба доставки',
  'admin.shipping.methods.newSubtitle': 'Створіть новий спосіб доставки',
  'admin.shipping.methods.editSubtitle':
    'Редагування параметрів служби доставки',
  'admin.shipping.methods.namePlaceholder': "Кур'єрська доставка",
  'admin.shipping.methods.codeHint': 'Унікальний ідентифікатор для системи',
  'admin.shipping.methods.descriptionPlaceholder':
    "Доставка кур'єром за вашою адресою",
  'admin.shipping.methods.pluginName': 'Назва плагіна',
  'admin.shipping.methods.icon': 'Іконка (Lucide)',
  'admin.shipping.methods.iconHint': 'Назва іконки з бібліотеки Lucide',
  'admin.shipping.methods.showAtCheckout':
    'Відображати на сторінці оформлення замовлення',

  // Зони доставки
  'admin.shipping.zones.subtitle':
    'Географічні зони з різними тарифами доставки',
  'admin.shipping.zones.add': 'Додати зону',
  'admin.shipping.zones.all': 'Всі зони доставки',
  'admin.shipping.zones.empty': 'Зони доставки не знайдено',
  'admin.shipping.zones.cities': 'Міста',
  'admin.shipping.zones.rates': 'Тарифи',
  'admin.shipping.zones.confirmDelete': 'Видалити цю зону доставки?',
  'admin.shipping.zones.deleted': 'Зону видалено',
  'admin.shipping.zones.deleteFailed': 'Помилка видалення зони',
  'admin.shipping.zones.created': 'Зону створено',
  'admin.shipping.zones.new': 'Нова зона доставки',
  'admin.shipping.zones.newSubtitle': 'Створіть нову географічну зону',
  'admin.shipping.zones.editSubtitle': 'Редагування зони та тарифів доставки',
  'admin.shipping.zones.namePlaceholder': 'Київ і передмістя',
  'admin.shipping.zones.descriptionPlaceholder':
    'Зона доставки для Києва та околиць',
  'admin.shipping.zones.priority': 'Пріоритет (порядок)',
  'admin.shipping.zones.priorityHint':
    'Менший номер = вищий пріоритет при визначенні зони',
  'admin.shipping.zones.geography': 'Географія',
  'admin.shipping.zones.citiesPlaceholder': 'Київ, Бровари, Вишневе, Ірпінь',
  'admin.shipping.zones.citiesHint':
    'Введіть назви міст через кому або кожне місто з нового рядка',
  'admin.shipping.zones.regions': 'Регіони (опціонально)',
  'admin.shipping.zones.regionsPlaceholder': 'Київська область',
  'admin.shipping.zones.regionsHint': 'Якщо потрібно, вкажіть регіони/області',
  'admin.shipping.zones.useForCalc': 'Використовувати зону для розрахунку',
  'admin.shipping.zones.defaultHint': 'Застосовується, якщо місто не знайдено',

  // Тарифи
  'admin.shipping.rates.title': 'Тарифи доставки',
  'admin.shipping.rates.add': 'Додати тариф',
  'admin.shipping.rates.empty':
    'Тарифи не налаштовано. Додайте тариф для кожного способу доставки.',
  'admin.shipping.rates.methodOrName': 'Спосіб / Назва',
  'admin.shipping.rates.calcType': 'Тип розрахунку',
  'admin.shipping.rates.confirmDelete': 'Видалити цей тариф?',
  'admin.shipping.rates.deleted': 'Тариф видалено',
  'admin.shipping.rates.deleteFailed': 'Помилка видалення тарифу',
  'admin.shipping.rates.added': 'Тариф додано',
  'admin.shipping.rates.addFailed': 'Помилка додавання тарифу',
  'admin.shipping.rates.newName': 'Новий тариф',
  'admin.shipping.rates.calc.flat': 'Фіксована ціна',
  'admin.shipping.rates.calc.weight': 'За вагою',
  'admin.shipping.rates.calc.percent': 'Відсоток від суми',
  'admin.shipping.rates.calc.freeFrom': 'Безкоштовно від суми',
  'admin.shipping.rates.calc.plugin': 'Розрахунок плагіном',

  // Точки самовивозу
  'admin.shipping.points.subtitle':
    'Адреси магазинів та пунктів видачі замовлень',
  'admin.shipping.points.add': 'Додати точку',
  'admin.shipping.points.all': 'Всі точки самовивозу',
  'admin.shipping.points.empty': 'Точки самовивозу не знайдено',
  'admin.shipping.points.zone': 'Зона',
  'admin.shipping.points.system': 'Системна',
  'admin.shipping.points.confirmDelete': 'Видалити цю точку самовивозу?',
  'admin.shipping.points.deleted': 'Точку видалено',
  'admin.shipping.points.deleteFailed': 'Помилка видалення точки',
  'admin.shipping.points.methodMissing': 'Метод самовивозу не знайдено',
  'admin.shipping.points.created': 'Точку створено',
  'admin.shipping.points.new': 'Нова точка самовивозу',
  'admin.shipping.points.newSubtitle': 'Додайте нову адресу для самовивозу',
  'admin.shipping.points.systemLocked':
    'Системна точка — не може бути видалена',
  'admin.shipping.points.editSubtitle': 'Редагування точки самовивозу',
  'admin.shipping.points.info': 'Інформація про точку',
  'admin.shipping.points.namePlaceholder': 'Головний офіс',
  'admin.shipping.points.cityPlaceholder': 'Київ',
  'admin.shipping.points.addressPlaceholder': 'вул. Хрещатик, 1',
  'admin.shipping.points.zoneLabel': 'Зона доставки',
  'admin.shipping.points.zonePlaceholder': 'Оберіть зону',
  'admin.shipping.points.noZone': 'Без зони',
  'admin.shipping.points.zoneHint': "Прив'язка до географічної зони",
  'admin.shipping.points.showAtCheckout': 'Відображати точку на checkout',
} as const;
