/** Модерація відгуків. */
export const messages = {
  'admin.reviews.subtitle': 'Модерація відгуків товарів',
  'admin.reviews.statusFilter': 'Фільтр за статусом',
  'admin.reviews.all': 'Всі',
  'admin.reviews.approvedPlural': 'Затверджені',
  'admin.reviews.rejectedPlural': 'Відхилені',
  'admin.reviews.empty': 'Відгуків не знайдено',
  'admin.reviews.rating': 'Рейтинг',
  'admin.reviews.notFound': 'Відгук не знайдено',
  'admin.reviews.details': 'Деталі відгуку',
  'admin.reviews.photo': 'Фото {index}',
  'admin.reviews.adminComment': 'Коментар адміна',
  'admin.reviews.adminCommentPlaceholder': 'Причина відхилення або коментар...',
  'admin.reviews.approve': 'Затвердити',
  'admin.reviews.reject': 'Відхилити',
  'admin.reviews.deleteTitle': 'Видалити відгук?',
  'admin.reviews.deleteText':
    'Відгук та всі його зображення будуть видалені назавжди.',
  'admin.reviews.deleted': 'Відгук видалено',
  'admin.reviews.previousComment': 'Попередній коментар:',

  // Статуси (код у БД → підпис)
  'admin.reviews.status.pending': 'На модерації',
  'admin.reviews.status.approved': 'Затверджено',
  'admin.reviews.status.rejected': 'Відхилено',
} as const;
