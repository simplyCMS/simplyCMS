/** Доставка: служби, зони, точки самовивозу. */
export const messages = {
  // Служби доставки
  'admin.shipping.methods.subtitle': 'Управління способами доставки замовлень',
  'admin.shipping.methods.add': 'Додати службу',
  'admin.shipping.methods.empty': 'Служби доставки не знайдено',
  'admin.shipping.methods.deleted': 'Службу видалено',
  'admin.shipping.methods.created': 'Службу створено',
  'admin.shipping.methods.provider': 'Провайдер',
  'admin.shipping.methods.providerLocked':
    'Провайдер не змінюється після створення',
  'admin.shipping.methods.pricing': 'Режим ціни',
  'admin.shipping.methods.codeFormat': 'Лише малі латинські літери, цифри й _',
  'admin.shipping.methods.notFound': 'Спосіб доставки не знайдено',
  'admin.shipping.methods.deleteTitle': 'Видалити спосіб доставки?',
  'admin.shipping.methods.deleteWarning':
    'Разом зі способом буде видалено всі його тарифи. Спосіб із точками самовивозу видалити не можна.',
  'admin.shipping.providers.address': 'Доставка за адресою',
  'admin.shipping.providers.pickup': 'Самовивіз',
  'admin.shipping.pricing.rates': 'За тарифами зон',
  'admin.shipping.pricing.provider': 'Розрахунок провайдером',
  'admin.shipping.methods.new': 'Нова служба доставки',
  'admin.shipping.methods.namePlaceholder': "Кур'єрська доставка",
  'admin.shipping.methods.icon': 'Іконка (Lucide)',

  // Зони доставки
  'admin.shipping.zones.subtitle':
    'Географічні зони з різними тарифами доставки',
  'admin.shipping.zones.add': 'Додати зону',
  'admin.shipping.zones.empty': 'Зони доставки не знайдено',
  'admin.shipping.zones.cities': 'Міста',
  'admin.shipping.zones.deleted': 'Зону видалено',
  'admin.shipping.zones.created': 'Зону створено',
  'admin.shipping.zones.new': 'Нова зона доставки',
  'admin.shipping.zones.namePlaceholder': 'Київ і передмістя',
  'admin.shipping.zones.priority': 'Пріоритет (порядок)',
  'admin.shipping.zones.citiesPlaceholder': 'Київ, Бровари, Вишневе, Ірпінь',
  'admin.shipping.zones.citiesHint':
    'Введіть назви міст через кому або кожне місто з нового рядка',
  'admin.shipping.zones.regions': 'Регіони (опціонально)',
  'admin.shipping.zones.regionsPlaceholder': 'Київська область',

  // Тарифи
  'admin.shipping.rates.title': 'Тарифи доставки',
  'admin.shipping.rates.add': 'Додати тариф',
  'admin.shipping.rates.calcType': 'Тип розрахунку',
  'admin.shipping.rates.confirmDelete': 'Видалити цей тариф?',
  'admin.shipping.rates.deleted': 'Тариф видалено',
  'admin.shipping.rates.added': 'Тариф додано',
  'admin.shipping.rates.editTitle': 'Редагування тарифу',
  'admin.shipping.rates.emptyMethod':
    'Тарифів ще немає. Додайте тариф для зони.',
  'admin.shipping.rates.deleteWarning': 'Тариф буде видалено безповоротно.',
  'admin.shipping.rates.zoneRequired': 'Оберіть зону',
  'admin.shipping.rates.decimalFormat':
    'Число з не більше ніж двома знаками після крапки',
  'admin.shipping.rates.baseCost': 'Базова вартість',
  'admin.shipping.rates.perKgCost': 'Вартість за кг',
  'admin.shipping.rates.minWeight': 'Мінімальна вага',
  'admin.shipping.rates.freeFrom': 'Безкоштовно від суми',
  'admin.shipping.rates.minOrder': 'Мінімальна сума замовлення',
  'admin.shipping.rates.maxOrder': 'Максимальна сума замовлення',
  'admin.shipping.rates.estimatedDays': 'Орієнтовний строк',
  'admin.shipping.rates.calc.flat': 'Фіксована ціна',
  'admin.shipping.rates.calc.weight': 'За вагою',
  'admin.shipping.rates.calc.percent': 'Відсоток від суми',
  'admin.shipping.rates.calc.freeFrom': 'Безкоштовно від суми',

  // Точки самовивозу
  'admin.shipping.points.subtitle':
    'Адреси магазинів та пунктів видачі замовлень',
  'admin.shipping.points.add': 'Додати точку',
  'admin.shipping.points.empty': 'Точки самовивозу не знайдено',
  'admin.shipping.points.zone': 'Зона',
  'admin.shipping.points.system': 'Системна',
  'admin.shipping.points.deleted': 'Точку видалено',
  'admin.shipping.points.created': 'Точку створено',
  'admin.shipping.points.new': 'Нова точка самовивозу',
  'admin.shipping.points.systemLocked':
    'Системна точка — не може бути видалена',
  'admin.shipping.points.info': 'Інформація про точку',
  'admin.shipping.points.namePlaceholder': 'Головний офіс',
  'admin.shipping.points.cityPlaceholder': 'Київ',
  'admin.shipping.points.addressPlaceholder': 'вул. Хрещатик, 1',
  'admin.shipping.points.zoneLabel': 'Зона доставки',
  'admin.shipping.points.noZone': 'Без зони',
  'admin.shipping.points.zoneHint': "Прив'язка до географічної зони",
  'admin.shipping.points.showAtCheckout': 'Відображати точку на checkout',
  'admin.shipping.zones.makeDefault': 'Зробити дефолтною',
  'admin.shipping.zones.inactiveHint': 'Лише активна зона може бути дефолтною',
  'admin.shipping.zones.defaultLocked':
    'Зону за замовчуванням не можна видалити чи вимкнути',
  'admin.shipping.zones.defaultSet': 'Дефолтну зону змінено',
  'admin.shipping.zones.deleteTitle': 'Видалити зону доставки?',
  'admin.shipping.zones.deleteWarning':
    'Разом із зоною буде видалено її тарифи. Дефолтну зону видалити не можна.',
  'admin.shipping.zones.notFound': 'Зону доставки не знайдено',
  'admin.shipping.points.method': 'Спосіб самовивозу',
  'admin.shipping.points.methodRequired': 'Оберіть спосіб самовивозу',
  'admin.shipping.points.methodLocked':
    'Спосіб не змінюється після створення точки',
  'admin.shipping.points.deleteTitle': 'Видалити точку самовивозу?',
  'admin.shipping.points.deleteWarning':
    'Точку з товарним залишком чи резервом видалити не можна — деактивуйте її. Системну точку (склад) видалити не можна.',
  'admin.shipping.points.notFound': 'Точку самовивозу не знайдено',
} as const;
