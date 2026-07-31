// Тонкі React-Query хуки поверх портів з useEngine().
// Логіка запитів — у queries.ts; тут лише прив'язка до контексту.

import { useQuery } from "@tanstack/react-query";
import type { ProductQuery, OrderQuery } from "@simplycms/objects";
import { useEngine } from "./EngineProvider";
import { catalogQueries, orderQueries } from "./queries";

export function useProduct(idOrSlug: string) {
  const { catalog } = useEngine();
  return useQuery(catalogQueries.product(catalog, idOrSlug));
}

export function useProducts(q: ProductQuery) {
  const { catalog } = useEngine();
  return useQuery(catalogQueries.products(catalog, q));
}

export function useSections() {
  const { catalog } = useEngine();
  return useQuery(catalogQueries.sections(catalog));
}

export function useProperties() {
  const { catalog } = useEngine();
  return useQuery(catalogQueries.properties(catalog));
}

export function useStockInfo(ids: string[]) {
  const { catalog } = useEngine();
  return useQuery({
    ...catalogQueries.stock(catalog, ids),
    enabled: ids.length > 0,
  });
}

export function useOrder(id: string) {
  const { orders } = useEngine();
  if (!orders) throw new Error("OrderRepository is not configured in EngineContext");
  return useQuery(orderQueries.order(orders, id));
}

export function useOrders(q: OrderQuery) {
  const { orders } = useEngine();
  if (!orders) throw new Error("OrderRepository is not configured in EngineContext");
  return useQuery(orderQueries.list(orders, q));
}
