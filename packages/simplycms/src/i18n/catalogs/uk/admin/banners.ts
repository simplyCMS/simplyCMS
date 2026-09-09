/** Банери на сторінках вітрини. */
export const messages = {
  'admin.banners.add': 'Додати банер',
  'admin.banners.empty': 'Банерів поки немає',
  'admin.banners.deleted': 'Банер видалено',
  'admin.banners.saved': 'Банер збережено',
  'admin.banners.new': 'Новий банер',
  'admin.banners.editTitle': 'Редагування банера',

  // Розміщення (код у БД → підпис)
  'admin.banners.placement.home': 'Головна',
  'admin.banners.placement.catalog': 'Каталог',
  'admin.banners.placement.section': 'Розділ',
  'admin.banners.placement.blog': 'Блог',
  'admin.banners.placement.global': 'Глобально',

  // Дні тижня (скорочення)
  'admin.banners.weekday.mon': 'Пн',
  'admin.banners.weekday.tue': 'Вт',
  'admin.banners.weekday.wed': 'Ср',
  'admin.banners.weekday.thu': 'Чт',
  'admin.banners.weekday.fri': 'Пт',
  'admin.banners.weekday.sat': 'Сб',
  'admin.banners.weekday.sun': 'Нд',

  // Форма
  'admin.banners.main': 'Основне',
  'admin.banners.titleField': 'Заголовок *',
  'admin.banners.subtitle': 'Підзаголовок',
  'admin.banners.imageField': 'Зображення *',
  'admin.banners.imageDesktop': 'Десктоп зображення (опціонально)',
  'admin.banners.imageMobile': 'Мобільне зображення (опціонально)',
  'admin.banners.textPosition': 'Позиція тексту',
  'admin.banners.align.left': 'Ліворуч',
  'admin.banners.align.center': 'По центру',
  'admin.banners.align.right': 'Праворуч',
  'admin.banners.overlayColor': 'Колір оверлею',

  'admin.banners.buttons': 'Кнопки',
  'admin.banners.buttonsEmpty': 'Кнопок поки немає',
  'admin.banners.button': 'Кнопка',
  'admin.banners.buttonVariant': 'Варіант',
  'admin.banners.buttonTarget': 'Відкриття',
  'admin.banners.targetSelf': 'Поточна вкладка',
  'admin.banners.targetBlank': 'Нова вкладка',

  'admin.banners.schedule': 'Розклад',
  'admin.banners.weekdays': 'Дні тижня',
  'admin.banners.timeFrom': 'Час початку',
  'admin.banners.timeTo': 'Час закінчення',

  'admin.banners.placement': 'Розміщення',
  'admin.banners.placementLabel': 'Місце показу',
  'admin.banners.specificSection': 'Конкретний розділ',
  'admin.banners.pickSection': 'Оберіть розділ',

  'admin.banners.animation': 'Анімація',
  'admin.banners.animationType': 'Тип анімації',
  'admin.banners.anim.slide': 'Ковзання',
  'admin.banners.anim.fade': 'Зникання',
  'admin.banners.anim.zoom': 'Збільшення',
  'admin.banners.anim.none': 'Без анімації',
  'admin.banners.animationDuration': 'Тривалість анімації:',
  'admin.banners.ms': 'мс',
  'admin.banners.slideDuration': 'Час показу слайду:',
  'admin.banners.sec': 'с',
} as const;
