/** Каталог: список товарів, фільтри, сортування. */
export const messages = {
  'catalog.title': 'Каталог',
  'catalog.viewAll': 'Переглянути усі →',
  'catalog.back': 'Повернутись до каталогу',
  'catalog.subtitle': 'Оберіть категорію або скористайтесь фільтрами',
  'catalog.allProducts': 'Всі товари',
  'catalog.sectionNotFound': 'Розділ не знайдено',

  // Фільтри й сортування
  'catalog.filters': 'Фільтри',
  'catalog.resetFilters': 'Скинути фільтри',
  'catalog.productsCount': '{count} товарів',
  'catalog.noResults': 'Товарів за вибраними фільтрами не знайдено',
  'catalog.sort.popular': 'За популярністю',
  'catalog.sort.newest': 'Новинки',
  'catalog.sort.priceAsc': 'Дешевші',
  'catalog.sort.priceDesc': 'Дорожчі',

  // Активні й бічні фільтри (ActiveFilters, FilterSidebar)
  'catalog.filters.activeLabel': 'Активні фільтри:',
  'catalog.filters.removeAria': 'Видалити фільтр {label}: {value}',
  'catalog.filters.clearAll': 'Скинути всі',
  'catalog.filters.inStockOnly': 'Тільки в наявності',
  'catalog.filters.noOptions': 'Немає опцій',
} as const;
