/** Картка товару: наявність, дії, секції опису. */
export const messages = {
  'product.notFound': 'Товар не знайдено',
  'product.goBack': 'Повернутись назад',
  'product.sku': 'Артикул: {sku}',

  // Наявність
  'product.onOrder': 'Під замовлення',
  'product.outOfStock': 'Немає в наявності',
  'product.availability': 'Наявність',
  'product.availabilityInStores': 'Наявність на складах',

  // Дії
  'product.addToCart': 'Додати в кошик',
  'product.addedToCart': 'Додано в кошик',

  // Секції сторінки
  'product.description': 'Опис',
  'product.noDescription': 'Опис товару відсутній',
  'product.characteristics': 'Характеристики',
  'product.reviews': 'Відгуки',
} as const;
