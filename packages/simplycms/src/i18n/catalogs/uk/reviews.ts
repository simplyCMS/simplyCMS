/** Відгуки на товар: рейтинг, форма, картка відгуку, лайтбокс фото. */
export const messages = {
  // Лічильник відгуків (форми множини — див. `pluralReviewsKey` у reviews-ui)
  'reviews.countOne': 'відгук',
  'reviews.countFew': 'відгуки',
  'reviews.countMany': 'відгуків',

  'reviews.alreadySubmitted': 'Ви вже залишили відгук на цей товар.',
  'reviews.writeReview': 'Написати відгук',
  'reviews.loginPrompt': 'Щоб залишити відгук, увійдіть в свій акаунт',
  'reviews.loginOrRegister': 'Увійти або зареєструватись',
  'reviews.empty': 'Ще немає відгуків. Будьте першим!',

  // Картка відгуку
  'reviews.anonymousAuthor': 'Користувач',
  'reviews.formerCustomer': 'Колишній покупець',
  'reviews.pendingBadge': 'На модерації',
  'reviews.delete.confirmTitle': 'Видалити відгук?',
  'reviews.delete.confirmText': 'Цю дію неможливо скасувати.',
  'reviews.photoAlt': 'Фото {index}',
  'reviews.enlargedPhotoAlt': 'Збільшене фото',

  // Форма відгуку
  'reviews.form.ratingLabel': 'Оцінка *',
  'reviews.form.ratingRequired': 'Оберіть оцінку',
  'reviews.form.titleLabel': "Заголовок (необов'язково)",
  'reviews.form.titlePlaceholder': 'Коротко про враження',
  'reviews.form.contentLabel': 'Текст відгуку',
  'reviews.form.contentPlaceholder': 'Напишіть ваш відгук...',
  'reviews.form.photosLabel': 'Фото (до 5)',
  'reviews.form.submit': 'Надіслати відгук',
  'reviews.form.addPhotos': 'Додати фото',
  'reviews.form.removePhoto': 'Прибрати фото',

  // Помилки подання відгуку (коди сервера — `REVIEW_SUBMIT_ERROR`)
  'reviews.errors.imageBadFormat':
    'Фото має бути зображенням PNG, JPEG, WebP, GIF або AVIF',
  'reviews.errors.imageTooLarge': 'Фото більше 5 МБ',
  'reviews.errors.tooManyImages': 'Не більше 5 фото',

  // Редактор тексту відгуку (тулбар посилання)
  'reviews.editor.linkUrl': 'URL посилання',
} as const;
