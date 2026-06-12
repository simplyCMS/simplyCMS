// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import type {
  EngineContext,
  CatalogRepository,
  Product,
  Paged,
} from "@simplysoftua/objects";
import { EngineProvider, useEngine } from "../EngineProvider";
import { useProduct, useSections } from "../hooks";

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

const mockCatalog: CatalogRepository = {
  getProduct: async (idOrSlug) =>
    idOrSlug === "widget" || idOrSlug === "p1" ? product : null,
  listProducts: async () => paged,
  getProductsBySection: async () => paged,
  getSections: async () => [
    {
      id: "s1",
      slug: "all",
      name: "All",
      description: null,
      parent_id: null,
      sort_order: 0,
      is_active: true,
    },
  ],
  getSectionBySlug: async () => null,
  getProperties: async () => [],
  getStock: async () => ({}),
  getPriceTypes: async () => [],
  getDiscounts: async () => [],
  getShippingZones: async () => [],
};

const mockEngine: EngineContext = {
  catalog: mockCatalog,
  scope: { getScope: () => undefined },
  identity: {
    getCurrentUser: async () => null,
    hasRole: async () => false,
    signIn: async () => ({ identity: null, error: null }),
    signOut: async () => {},
  },
  links: {
    product: (p) => `/catalog/${p.slug}`,
    section: (s) => `/catalog/${s.slug}`,
    cart: () => "/cart",
    checkout: () => "/checkout",
    profile: () => "/profile",
    auth: () => "/auth",
  },
  media: { url: (p) => p, upload: async () => "x" },
  config: {
    locale: "uk-UA",
    currency: "UAH",
    siteUrl: "",
    seo: { defaultTitle: "", titleTemplate: "%s", defaultDescription: "" },
  },
};

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return (
    <QueryClientProvider client={qc}>
      <EngineProvider value={mockEngine}>{children}</EngineProvider>
    </QueryClientProvider>
  );
}

describe("EngineProvider / useEngine wiring", () => {
  it("useEngine returns the injected context", () => {
    const { result } = renderHook(() => useEngine(), { wrapper });
    expect(result.current.config.currency).toBe("UAH");
    expect(result.current.catalog).toBe(mockCatalog);
  });

  it("useEngine throws outside a provider", () => {
    expect(() => renderHook(() => useEngine())).toThrow(/EngineProvider/);
  });

  it("useProduct resolves through the injected repository", async () => {
    const { result } = renderHook(() => useProduct("widget"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.name).toBe("Widget");
  });

  it("useSections resolves through the injected repository", async () => {
    const { result } = renderHook(() => useSections(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.[0].slug).toBe("all");
  });
});
