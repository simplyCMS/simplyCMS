/** Картка товару: наявність, дії, секції опису. */
export const messages = {
  'product.notFound': 'Товар не знайдено',
  'product.goBack': 'Повернутись назад',
  'product.sku': 'Артикул: {sku}',

  // Наявність
  'product.inStock': 'В наявності',
  'product.onOrder': 'Під замовлення',
  'product.outOfStock': 'Немає в наявності',
  'product.availability': 'Наявність',
  'product.availabilityInStores': 'Наявність на складах',
  // Наявність із залишком: окремий ключ, бо частина екранів показує кількість,
  // а частина — лише статус (див. product.inStock).
  'product.inStockCount': 'В наявності: {count} шт',
  'product.unitsCount': '{count} шт',
  'product.stockUnknown': 'Невідомо',

  // Дії
  'product.addToCart': 'Додати в кошик',
  'product.addedToCart': 'Додано в кошик',

  // Секції сторінки
  'product.description': 'Опис',
  'product.noDescription': 'Опис товару відсутній',
  'product.characteristics': 'Характеристики',
  'product.reviews': 'Відгуки',
  'product.modification': 'Модифікація',

  // Події відгуків (useProductReviews) — власний неймспейс, бо
  // `admin.reviews.deleted` належить іншому домену (модерація в адмінці).
  'product.review.notAuthorized': 'Не авторизовано',
  'product.review.submitted': 'Відгук надіслано',
  'product.review.submittedDescription': "Він з'явиться після модерації",
  'product.review.deleted': 'Відгук видалено',
} as const;
