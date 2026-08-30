/**
 * Реєстр імен сутностей і фабрика ключів кешу (рішення К3-3).
 *
 * 🔴 Значення — імʼя таблиці в SQL, і воно тут ЄДИНЕ джерело правди для
 * ключа кешу: доти, доки ключ можна написати рядком у місці вжитку, одна
 * сутність неминуче отримує кілька ключів (виміряно: `pickup_points` жила
 * під чотирма — два на вітрині, два в адмінці). Розсинхрон при цьому
 * невидимий, поки обидва шляхи не працюють одночасно.
 *
 * 🔴 Тут ПЛОСКІ РЯДКИ, а не Drizzle-таблиці: тір T0 не має рантайм-
 * залежностей, а `getTableName()` затягнув би `drizzle-orm` у клієнтський
 * бандл. Звʼязок зі схемою тримає тест парності
 * (`schema/__tests__/entity-parity.test.ts`) — той самий патерн, що
 * «гранти як код + гейт парності».
 */
export const ENTITY = {
  banners: 'banners',
  categoryRules: 'category_rules',
  discountConditions: 'discount_conditions',
  discountGroups: 'discount_groups',
  discountTargets: 'discount_targets',
  discounts: 'discounts',
  languages: 'languages',
  media: 'media',
  modificationPropertyValues: 'modification_property_values',
  orderItems: 'order_items',
  orderStatuses: 'order_statuses',
  orders: 'orders',
  pickupPoints: 'pickup_points',
  priceTypes: 'price_types',
  productModifications: 'product_modifications',
  productPrices: 'product_prices',
  productPropertyValues: 'product_property_values',
  productReviews: 'product_reviews',
  products: 'products',
  profiles: 'profiles',
  propertyOptions: 'property_options',
  sectionProperties: 'section_properties',
  sectionPropertyAssignments: 'section_property_assignments',
  sections: 'sections',
  shippingMethods: 'shipping_methods',
  shippingRates: 'shipping_rates',
  shippingZones: 'shipping_zones',
  stockByPickupPoint: 'stock_by_pickup_point',
  systemSettings: 'system_settings',
  themes: 'themes',
  userAddresses: 'user_addresses',
  userCategories: 'user_categories',
  userRecipients: 'user_recipients',
} as const satisfies Readonly<Record<string, string>>;

/** Імʼя сутності — значення `ENTITY`, не довільний рядок. */
export type EntityName = (typeof ENTITY)[keyof typeof ENTITY];

/**
 * Ключі кешу однієї сутності. Сегмент 0 завжди `entity`, тож будь-який
 * похідний ключ розширює базовий як префікс — цього вимагає
 * query-collection, інакше оновлення кешу проминає записи.
 */
export function entityKey(entity: EntityName) {
  return {
    all: () => [entity] as const,
    list: () => [entity, 'list'] as const,
    detail: (id: string) => [entity, 'detail', id] as const,
    scoped: (relation: string, parentId: string) =>
      [entity, relation, parentId] as const,
  };
}

/**
 * Ключ, що обслуговує кілька таблиць одним запитом.
 *
 * 🔴 Не всі кеші однотабличні, і зводити їх силою до `entityKey` було б
 * регресією: `shipping-directory` одним походом читає `shipping_methods`,
 * `shipping_zones` і `shipping_rates` (`storefront/loaders/shipping.ts:81,107,136`),
 * а `stock-info` — `stock_by_pickup_point`, `product_modifications` і
 * `products`. Розбити їх на три ключі означало б три раундтрипи замість
 * одного.
 *
 * Тому агрегат лишається одним ключем, але **називає свої залежності
 * явно** — інакше мутація в `shipping_rates` не мала б як його
 * інвалідувати. `deps` тут не декорація: саме звідси Е1б візьме список
 * ключів для інвалідації.
 */
export function aggregateKey(
  name: string,
  deps: readonly EntityName[],
): { key: readonly [string]; deps: readonly EntityName[] } {
  return { key: [name] as const, deps };
}

/** Агрегати вітрини — єдине місце, де вони оголошені. */
export const AGGREGATE = {
  shippingDirectory: aggregateKey('shipping-directory', [
    ENTITY.shippingMethods,
    ENTITY.shippingZones,
    ENTITY.shippingRates,
  ]),
  stockInfo: aggregateKey('stock-info', [
    ENTITY.stockByPickupPoint,
    ENTITY.productModifications,
    ENTITY.products,
  ]),
  /**
   * Контекст цін покупця (`core/lib/price-type.ts`): дефолтний тип ціни з
   * `price_types` + персональний тип, який `profiles` резолвить у
   * `user_categories`. Віддає обчислені id, а не рядки однієї таблиці —
   * без домінантної сутності, тож `entityKey` тут регресія (Task 6, fix-раунд 1).
   */
  priceTypeContext: aggregateKey('price-type-context', [
    ENTITY.priceTypes,
    ENTITY.profiles,
    ENTITY.userCategories,
  ]),
  /**
   * Довідник знижок (`core/lib/discounts.ts`): дефолтний і персональний тип
   * ціни/категорія (`price_types`, `profiles`, `user_categories`) плюс
   * дерево правил (`discounts`, `discount_targets`, `discount_conditions`,
   * `discount_groups`) — до семи таблиць, структурно те саме, що
   * `shippingDirectory` (Task 6, fix-раунд 1).
   */
  discountEnvironment: aggregateKey('discount-environment', [
    ENTITY.priceTypes,
    ENTITY.profiles,
    ENTITY.userCategories,
    ENTITY.discounts,
    ENTITY.discountTargets,
    ENTITY.discountConditions,
    ENTITY.discountGroups,
  ]),
  /**
   * Характеристики й наявність модифікацій товару
   * (`storefront-routes/server/products.ts` → `getModificationData`):
   * значення модифікацій (`modification_property_values`, приєднані
   * `product_modifications`/`property_options`/`section_properties`) +
   * залишки (`stock_by_pickup_point`, `product_modifications.stock_status`).
   * Перекриває дві з трьох таблиць `stockInfo` — окремий агрегат, бо третя
   * (`products`) тут не читається (Task 6, fix-раунд 1).
   */
  modificationData: aggregateKey('product-modification-data', [
    ENTITY.modificationPropertyValues,
    ENTITY.productModifications,
    ENTITY.propertyOptions,
    ENTITY.sectionProperties,
    ENTITY.stockByPickupPoint,
  ]),
  /**
   * Сторінка значення характеристики (`storefront/loaders/property-option.ts`):
   * характеристика й опція (`section_properties`, `property_options`) +
   * товари, де опція стоїть на самому товарі АБО на модифікації
   * (`product_property_values`, `modification_property_values` через
   * `product_modifications`). Товари приходять НЕ голими рядками —
   * `loadProductsByOption` делегує в спільний `loadCatalogProductsWhere`
   * (`storefront/loaders/catalog-products.ts`), а той доклеює секцію
   * (`sections`, leftJoin), ціни (`product_prices`) і залишки через
   * `loadStockByModification`/`loadStockByProduct` (обидва — `stock_by_pickup_point`).
   * `PropertyOptionPageData.products` документовано як «уже з
   * модифікаціями й цінами» — deps звіряють саме це, а не тільки join
   * ідентифікації опції (Task 6, fix-раунд 2: перша редакція пропустила
   * делегування в спільний лоадер).
   */
  propertyOptionPage: aggregateKey('property-option-page', [
    ENTITY.products,
    ENTITY.propertyOptions,
    ENTITY.sectionProperties,
    ENTITY.productPropertyValues,
    ENTITY.productModifications,
    ENTITY.modificationPropertyValues,
    ENTITY.sections,
    ENTITY.productPrices,
    ENTITY.stockByPickupPoint,
  ]),
} as const;

/**
 * Ключі, що НЕ належать жодній таблиці: сесійний і похідний стан.
 *
 * 🔴 Іменований allowlist, а не виняток у лінті: `['auth','is-admin', id]`
 * (`core/hooks/useAuth.tsx:45`) описує обчислене право, а не рядок БД, і
 * прив'язувати його до таблиці `user_roles` було б брехнею — воно
 * перераховується із сесії, а не читається звідти.
 */
export const SESSION_KEY = {
  isAdmin: (userId: string | null) => ['auth', 'is-admin', userId] as const,
} as const;
