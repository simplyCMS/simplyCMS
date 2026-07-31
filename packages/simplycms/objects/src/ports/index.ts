// Порти рушія (Tier 0). Контракти, які реалізують host-адаптери (data-supabase, @kit/supabase тощо).
// Жодних імпортів supabase/react — лише доменні типи.

import type {
  Product,
  ProductQuery,
  Section,
  SectionQuery,
  Property,
  PropertyQuery,
} from '../objects/catalog';
import type { Paged } from '../objects/common';
import type { StockInfo } from '../objects/inventory';
import type { PriceType } from '../objects/pricing';
import type { DiscountGroup, DiscountScope } from '../objects/discount';
import type { ShippingZone } from '../objects/shipping';
import type { Order, OrderQuery, CreateOrderInput } from '../objects/order';
import type { Identity } from '../objects/identity';
import type { SeoConfig, ImageOpts } from '../objects/config';

/** Розв'язувач скоупу: undefined = single-tenant, hubId = multi-tenant (MetaHub). */
export interface ScopeResolver {
  getScope(): string | undefined;
}

export interface CatalogRepository {
  getProduct(idOrSlug: string): Promise<Product | null>;
  listProducts(q: ProductQuery): Promise<Paged<Product>>;
  getProductsBySection(
    sectionId: string,
    q?: ProductQuery,
  ): Promise<Paged<Product>>;
  getSections(q?: SectionQuery): Promise<Section[]>;
  getSectionBySlug(slug: string): Promise<Section | null>;
  getProperties(q?: PropertyQuery): Promise<Property[]>;
  getStock(ids: string[]): Promise<Record<string, StockInfo>>;
  getPriceTypes(): Promise<PriceType[]>;
  getDiscounts(ctx: DiscountScope): Promise<DiscountGroup[]>;
  getShippingZones(): Promise<ShippingZone[]>;
  // Write-операції (admin) — опційні для read-only вітрин.
  upsertProduct?(product: Partial<Product> & { id?: string }): Promise<Product>;
  upsertSection?(section: Partial<Section> & { id?: string }): Promise<Section>;
}

export interface OrderRepository {
  createOrder(input: CreateOrderInput): Promise<Order>;
  getOrder(id: string): Promise<Order | null>;
  listOrders(q: OrderQuery): Promise<Paged<Order>>;
  updateStatus(id: string, status: string): Promise<void>;
}

export interface SignInResult {
  identity: Identity | null;
  error: string | null;
}

export interface IdentityProvider {
  getCurrentUser(): Promise<Identity | null>;
  hasRole(role: string): Promise<boolean>;
  signIn(email: string, password: string): Promise<SignInResult>;
  signOut(): Promise<void>;
}

export interface LinkResolver {
  product(p: { slug: string; id: string; sectionSlug?: string }): string;
  section(s: { slug: string; id: string }): string;
  cart(): string;
  checkout(): string;
  profile(sub?: string): string;
  auth(): string;
  admin?(sub?: string): string;
}

export interface MediaProvider {
  url(path: string, opts?: ImageOpts): string;
  upload(file: File): Promise<string>;
}

export interface ConfigProvider {
  locale: string;
  currency: string;
  siteUrl: string;
  seo: SeoConfig;
}

/** Контейнер залежностей рушія, що інжектиться через React-контекст. */
export interface EngineContext {
  catalog: CatalogRepository;
  orders?: OrderRepository;
  scope: ScopeResolver;
  identity: IdentityProvider;
  links: LinkResolver;
  media: MediaProvider;
  config: ConfigProvider;
}
