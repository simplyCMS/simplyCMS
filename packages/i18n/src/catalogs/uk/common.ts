/**
 * Спільна лексика інтерфейсу: рядки, що трапляються щонайменше у двох різних
 * доменах (вітрина + адмінка, або кілька доменів адмінки).
 *
 * Критерій потрапляння сюди — саме міждоменність, а не просто повторюваність:
 * рядок, який кілька разів ужито в межах одного домену, лишається ключем того
 * домену. Інакше `common` розбухне до звалища й перестане щось означати.
 */
export const messages = {
  // Дії
  'common.save': 'Зберегти',
  'common.saving': 'Збереження...',
  'common.cancel': 'Скасувати',
  'common.delete': 'Видалити',
  'common.create': 'Створити',
  'common.add': 'Додати',
  'common.edit': 'Редагувати',
  'common.activate': 'Активувати',
  'common.reset': 'Скинути',

  // Стани
  'common.loading': 'Завантаження...',
  'common.error': 'Помилка',
  // Технічний текст помилки підставляється параметром — не конкатенацією.
  'common.errorWithMessage': 'Помилка: {message}',
  'common.saveError': 'Помилка збереження',
  'common.changesSaved': 'Зміни збережено',
  'common.settingsSaved': 'Налаштування збережено',
  'common.statusUpdated': 'Статус оновлено',
  'common.statusUpdateError': 'Помилка оновлення статусу',
  'common.none': 'Немає',
  'common.notSet': 'Не вказано',
  'common.new': 'Новий',

  // Поля й заголовки колонок
  'common.name': 'Назва',
  // Зірочка — маркер обовʼязковості у формах; окремий ключ, бо в англійському
  // каталозі позиція зірочки та сама, а слово інше.
  'common.nameRequiredLabel': 'Назва *',
  'common.description': 'Опис',
  'common.seoDescription': 'Опис для пошукових систем',
  'common.code': 'Код',
  'common.type': 'Тип',
  'common.status': 'Статус',
  'common.actions': 'Дії',
  'common.value': 'Значення',
  'common.price': 'Ціна',
  'common.amount': 'Сума',
  'common.quantity': 'Кількість',
  'common.total': 'Разом',
  'common.color': 'Колір',
  'common.image': 'Зображення',
  'common.text': 'Текст',
  'common.number': 'Число',
  'common.date': 'Дата',
  'common.dateFrom': 'Дата початку',
  'common.dateTo': 'Дата закінчення',
  'common.category': 'Категорія',
  'common.information': 'Інформація',
  'common.basicInfo': 'Основна інформація',
  'common.filter': 'Фільтр',
  'common.priority': 'Пріоритет',
  'common.order': 'Порядок',
  'common.sortOrder': 'Порядок сортування',

  // Контактні дані — спільні для профілю, чекауту й адмінки
  'common.firstName': "Ім'я",
  'common.lastName': 'Прізвище',
  'common.phone': 'Телефон',
  'common.city': 'Місто',
  'common.address': 'Адреса',
  'common.author': 'Автор',

  // Прапорці й перемикачі. Рід у трьох формах — українська не має нейтральної
  // форми прикметника, а підпис стоїть біля іменників різного роду.
  'common.activeM': 'Активний',
  'common.activeF': 'Активна',
  'common.activeN': 'Активне',
  'common.system': 'Системний',
  'common.byDefault': 'За замовчуванням',
  'common.byDefaultShort': 'За замовч.',
  'common.yes': 'Так',
  'common.no': 'Ні',
  'common.or': 'або',
} as const;
