// Supabase-реалізація CatalogRepository. Клієнт інжектується (DI),
// scope застосовується лише коли визначений (multi-tenant MetaHub).

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CatalogRepository,
  ScopeResolver,
  Product,
  ProductQuery,
  Section,
  SectionQuery,
  Property,
  PropertyQuery,
  Paged,
  StockInfo,
  StockByPoint,
  StockStatus,
  PriceType,
  DiscountGroup,
  DiscountScope,
  ShippingZone,
} from "@simplysoftua/objects";
import {
  mapProduct,
  mapSection,
  mapProperty,
  mapPriceType,
  buildDiscountTree,
} from "./mappers";
import { singleTenantScope, SCOPE_COLUMN } from "./scope";

const PRODUCT_FULL_SELECT = `
  *,
  sections(id, slug, name),
  product_modifications(*),
  product_prices(price_type_id, price, old_price, modification_id),
  product_property_values(
    property_id,
    value,
    numeric_value,
    option_id,
    property_options:option_id(id, slug),
    section_properties:property_id(id, name, slug, property_type, has_page)
  )
`;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Row = Record<string, unknown>;

export function createSupabaseCatalogRepository(
  client: SupabaseClient,
  scope: ScopeResolver = singleTenantScope,
): CatalogRepository {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const scoped = (query: any) => {
    const hubId = scope.getScope();
    return hubId === undefined ? query : query.eq(SCOPE_COLUMN, hubId);
  };

  const pageOf = <T>(items: T[], q?: { page?: number; pageSize?: number }, total?: number): Paged<T> => ({
    items,
    total: total ?? items.length,
    page: q?.page ?? 1,
    pageSize: q?.pageSize ?? items.length,
  });

  return {
    async getProduct(idOrSlug: string): Promise<Product | null> {
      const bySlug = await scoped(
        client.from("products").select(PRODUCT_FULL_SELECT).eq("slug", idOrSlug),
      ).maybeSingle();
      if (bySlug.data) return mapProduct(bySlug.data as Row);

      if (UUID_RE.test(idOrSlug)) {
        const byId = await scoped(
          client.from("products").select(PRODUCT_FULL_SELECT).eq("id", idOrSlug),
        ).maybeSingle();
        if (byId.data) return mapProduct(byId.data as Row);
      }
      return null;
    },

    async listProducts(q: ProductQuery): Promise<Paged<Product>> {
      let query = scoped(
        client
          .from("products")
          .select("*, sections(*), product_modifications(*)", { count: "exact" })
          .eq("is_active", true),
      );
      if (q.sectionId) query = query.eq("section_id", q.sectionId);
      if (q.search) query = query.ilike("name", `%${q.search}%`);
      query = query.order("created_at", { ascending: false });

      // Пагінація лише за явним запитом; інакше — без обмеження (як канонічний loader).
      if (q.page !== undefined || q.pageSize !== undefined) {
        const page = q.page ?? 1;
        const pageSize = q.pageSize ?? 24;
        query = query.range((page - 1) * pageSize, page * pageSize - 1);
        const { data, count } = await query;
        const items = ((data as Row[] | null) ?? []).map(mapProduct);
        return pageOf(items, { page, pageSize }, count ?? items.length);
      }

      const { data, count } = await query;
      const items = ((data as Row[] | null) ?? []).map(mapProduct);
      return pageOf(items, undefined, count ?? items.length);
    },

    async getProductsBySection(
      sectionId: string,
      q?: ProductQuery,
    ): Promise<Paged<Product>> {
      return this.listProducts({ ...q, sectionId });
    },

    async getSections(q?: SectionQuery): Promise<Section[]> {
      let query = scoped(client.from("sections").select("*"));
      if (q?.activeOnly !== false) query = query.eq("is_active", true);
      if (q?.parentId === null) query = query.is("parent_id", null);
      else if (q?.parentId) query = query.eq("parent_id", q.parentId);
      const { data } = await query.order("sort_order");
      return ((data as Row[] | null) ?? []).map(mapSection);
    },

    async getSectionBySlug(slug: string): Promise<Section | null> {
      const { data } = await scoped(
        client.from("sections").select("*").eq("slug", slug).eq("is_active", true),
      ).maybeSingle();
      return data ? mapSection(data as Row) : null;
    },

    async getProperties(q?: PropertyQuery): Promise<Property[]> {
      // Канонічний storefront-лістинг фільтрує has_page=true (властивості з лендінгами).
      let query = scoped(
        client
          .from("section_properties")
          .select("*, property_options(*)")
          .eq("has_page", true),
      );
      if (q?.sectionId) query = query.eq("section_id", q.sectionId);
      if (q?.filterableOnly) query = query.eq("is_filterable", true);
      const { data } = await query.order("name");
      return ((data as Row[] | null) ?? []).map(mapProperty);
    },

    async getStock(ids: string[]): Promise<Record<string, StockInfo>> {
      const result: Record<string, StockInfo> = {};
      await Promise.all(
        ids.map(async (id) => {
          const { data } = await client.rpc("get_stock_info", {
            p_product_id: id,
            p_modification_id: undefined,
          });
          const row = (data as Row[] | null)?.[0];
          if (!row) {
            result[id] = {
              totalQuantity: 0,
              isAvailable: false,
              stockStatus: null,
              byPoint: [],
            };
            return;
          }
          const byPoint: StockByPoint[] = Array.isArray(row.by_point)
            ? (row.by_point as Row[]).map((p) => ({
                point_id: String(p.point_id),
                point_name: String(p.point_name),
                quantity: Number(p.quantity),
              }))
            : [];
          result[id] = {
            totalQuantity: Number(row.total_quantity ?? 0),
            isAvailable: Boolean(row.is_available ?? false),
            stockStatus: (row.stock_status as StockStatus | null) ?? null,
            byPoint,
          };
        }),
      );
      return result;
    },

    async getPriceTypes(): Promise<PriceType[]> {
      const { data } = await scoped(
        client.from("price_types").select("*"),
      ).order("sort_order");
      return ((data as Row[] | null) ?? []).map(mapPriceType);
    },

    async getDiscounts(ctx: DiscountScope): Promise<DiscountGroup[]> {
      // discounts.price_type_id — NOT NULL: знижки завжди скоупляться типом ціни
      // (мірор canonical useDiscountGroups, що повертає [] без priceTypeId).
      if (!ctx.priceTypeId) return [];
      const dq = scoped(
        client
          .from("discounts")
          .select("*, discount_targets(*), discount_conditions(*)")
          .eq("is_active", true)
          .eq("price_type_id", ctx.priceTypeId),
      );
      const { data: dbDiscounts } = await dq;
      const discounts = (dbDiscounts as Row[] | null) ?? [];
      if (!discounts.length) return [];

      const groupIds = [...new Set(discounts.map((d) => String(d.group_id)))];
      const { data: dbGroups } = await client
        .from("discount_groups")
        .select("*")
        .in("id", groupIds)
        .eq("is_active", true);
      let allGroups = (dbGroups as Row[] | null) ?? [];
      if (!allGroups.length) return [];

      const parentIds = allGroups
        .map((g) => g.parent_group_id as string | null)
        .filter((id): id is string => !!id && !groupIds.includes(id));
      if (parentIds.length > 0) {
        const { data: parents } = await client
          .from("discount_groups")
          .select("*")
          .in("id", parentIds)
          .eq("is_active", true);
        if (parents) allGroups = [...allGroups, ...(parents as Row[])];
      }

      return buildDiscountTree(discounts, allGroups);
    },

    async getShippingZones(): Promise<ShippingZone[]> {
      const { data } = await scoped(
        client.from("shipping_zones").select("*").eq("is_active", true),
      ).order("sort_order", { ascending: true });
      return ((data as Row[] | null) ?? []).map((z) => ({
        id: String(z.id),
        name: String(z.name ?? ""),
        description: (z.description as string | null) ?? null,
        cities: Array.isArray(z.cities) ? (z.cities as string[]) : [],
        regions: Array.isArray(z.regions) ? (z.regions as string[]) : [],
        is_active: Boolean(z.is_active),
        is_default: Boolean(z.is_default),
        sort_order: Number(z.sort_order ?? 0),
        created_at: String(z.created_at ?? ""),
      }));
    },
  };
}
