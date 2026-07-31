import { describe, it, expect } from "vitest";
import { catalogQueries, orderQueries, catalogKeys } from "../queries";
import type {
  CatalogRepository,
  OrderRepository,
  Product,
  Paged,
  Order,
} from "@simplycms/objects";

// Мінімальна in-memory реалізація портів — доводить, що хуки/запити
// працюють з будь-якою реалізацією, не лише з supabase.
function makeMockCatalog(): CatalogRepository {
  const product: Product = {
    id: "p1",
    slug: "widget",
    name: "Widget",
    description: null,
    section_id: "s1",
    stock_status: "in_stock",
    has_modifications: false,
    modifications: [],
    prices: [],
    images: [],
  };
  const paged: Paged<Product> = { items: [product], total: 1, page: 1, pageSize: 20 };
  return {
    getProduct: async (idOrSlug) =>
      idOrSlug === "p1" || idOrSlug === "widget" ? product : null,
    listProducts: async () => paged,
    getProductsBySection: async () => paged,
    getSections: async () => [],
    getSectionBySlug: async () => null,
    getProperties: async () => [],
    getStock: async () => ({}),
    getPriceTypes: async () => [],
    getDiscounts: async () => [],
    getShippingZones: async () => [],
  };
}

function makeMockOrders(): OrderRepository {
  const order: Order = {
    id: "o1",
    number: "0001",
    status: "new",
    customer: { name: "Test", email: null, phone: "000" },
    items: [],
    subtotal: 0,
    shippingCost: 0,
    total: 0,
    shipping: null,
    comment: null,
    userId: null,
    created_at: "",
    updated_at: "",
  };
  return {
    createOrder: async () => order,
    getOrder: async (id) => (id === "o1" ? order : null),
    listOrders: async () => ({ items: [order], total: 1, page: 1, pageSize: 20 }),
    updateStatus: async () => undefined,
  };
}

describe("catalogQueries", () => {
  it("product queryFn resolves through the injected repository", async () => {
    const opts = catalogQueries.product(makeMockCatalog(), "widget");
    expect(opts.queryKey).toEqual(catalogKeys.product("widget"));
    const result = await opts.queryFn();
    expect(result?.name).toBe("Widget");
  });

  it("products queryFn returns a paged result", async () => {
    const opts = catalogQueries.products(makeMockCatalog(), { page: 1 });
    const result = await opts.queryFn();
    expect(result.total).toBe(1);
    expect(result.items[0].slug).toBe("widget");
  });

  it("returns null for unknown product", async () => {
    const opts = catalogQueries.product(makeMockCatalog(), "nope");
    expect(await opts.queryFn()).toBeNull();
  });
});

describe("orderQueries", () => {
  it("order queryFn resolves through the injected repository", async () => {
    const opts = orderQueries.order(makeMockOrders(), "o1");
    const result = await opts.queryFn();
    expect(result?.number).toBe("0001");
  });
});
