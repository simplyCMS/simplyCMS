// Фабрики query-опцій, керовані портами (без React/supabase).
// Тестуються з будь-якою реалізацією CatalogRepository/OrderRepository.

import type {
  CatalogRepository,
  OrderRepository,
  Product,
  ProductQuery,
  Section,
  Property,
  Paged,
  Order,
  OrderQuery,
  StockInfo,
} from "@simplycms/objects";

export interface QueryOptionsLike<T> {
  queryKey: readonly unknown[];
  queryFn: () => Promise<T>;
}

/** Стабільний namespace ключів для кешу React Query. */
export const catalogKeys = {
  all: ["catalog"] as const,
  product: (idOrSlug: string) => ["catalog", "product", idOrSlug] as const,
  products: (q: ProductQuery) => ["catalog", "products", q] as const,
  sectionProducts: (sectionId: string, q?: ProductQuery) =>
    ["catalog", "section-products", sectionId, q ?? null] as const,
  sections: ["catalog", "sections"] as const,
  properties: ["catalog", "properties"] as const,
  stock: (ids: string[]) => ["catalog", "stock", ...ids] as const,
};

export const orderKeys = {
  all: ["orders"] as const,
  order: (id: string) => ["orders", "detail", id] as const,
  list: (q: OrderQuery) => ["orders", "list", q] as const,
};

export const catalogQueries = {
  product(
    catalog: CatalogRepository,
    idOrSlug: string,
  ): QueryOptionsLike<Product | null> {
    return {
      queryKey: catalogKeys.product(idOrSlug),
      queryFn: () => catalog.getProduct(idOrSlug),
    };
  },
  products(
    catalog: CatalogRepository,
    q: ProductQuery,
  ): QueryOptionsLike<Paged<Product>> {
    return {
      queryKey: catalogKeys.products(q),
      queryFn: () => catalog.listProducts(q),
    };
  },
  sections(catalog: CatalogRepository): QueryOptionsLike<Section[]> {
    return {
      queryKey: catalogKeys.sections,
      queryFn: () => catalog.getSections(),
    };
  },
  properties(catalog: CatalogRepository): QueryOptionsLike<Property[]> {
    return {
      queryKey: catalogKeys.properties,
      queryFn: () => catalog.getProperties(),
    };
  },
  stock(
    catalog: CatalogRepository,
    ids: string[],
  ): QueryOptionsLike<Record<string, StockInfo>> {
    return {
      queryKey: catalogKeys.stock(ids),
      queryFn: () => catalog.getStock(ids),
    };
  },
};

export const orderQueries = {
  order(orders: OrderRepository, id: string): QueryOptionsLike<Order | null> {
    return {
      queryKey: orderKeys.order(id),
      queryFn: () => orders.getOrder(id),
    };
  },
  list(orders: OrderRepository, q: OrderQuery): QueryOptionsLike<Paged<Order>> {
    return {
      queryKey: orderKeys.list(q),
      queryFn: () => orders.listOrders(q),
    };
  },
};
