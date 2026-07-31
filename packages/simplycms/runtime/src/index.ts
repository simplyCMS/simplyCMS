// @simplycms/runtime — складання магазину через адаптери.
// Залежить лише від контрактів @simplycms/objects (без supabase/env).

import type {
  EngineContext,
  CatalogRepository,
  OrderRepository,
  ScopeResolver,
  IdentityProvider,
  LinkResolver,
  MediaProvider,
  ConfigProvider,
} from "@simplycms/objects";

// Конфіг магазину (host-`defineConfig`) — окремий контур від складання
// EngineContext нижче: він описує САЙТ, а не адаптери даних.
export { defineConfig } from "./config";
export type {
  SimplyCmsConfig,
  SimplyCmsSeoConfig,
  PluginRegistration,
  ThemeLoader,
} from "./config";

/** Опис feature-модуля збірки (catalog/cart/checkout/orders/…). */
export interface EngineModule {
  name: string;
  /** Опційний хук ініціалізації модуля під час bootstrap. */
  setup?(engine: EngineContext): void | Promise<void>;
}

export interface DefineRuntimeInput {
  adapters: {
    catalog: CatalogRepository;
    orders?: OrderRepository;
    scope?: ScopeResolver;
    identity: IdentityProvider;
    links: LinkResolver;
    media: MediaProvider;
    config: ConfigProvider;
  };
  modules?: EngineModule[];
  theme?: string;
  plugins?: string[];
}

export interface SimplyCmsRuntime {
  engine: EngineContext;
  modules: EngineModule[];
  theme?: string;
  plugins: string[];
}

/** Single-tenant скоуп за замовчуванням (simplyCMS). */
const defaultScope: ScopeResolver = { getScope: () => undefined };

/**
 * Збирає рантайм магазину з адаптерів. Усі залежності інжектуються —
 * жодного прямого доступу до supabase чи import.meta.env тут немає.
 */
export function defineRuntime(input: DefineRuntimeInput): SimplyCmsRuntime {
  const { adapters } = input;

  const engine: EngineContext = {
    catalog: adapters.catalog,
    orders: adapters.orders,
    scope: adapters.scope ?? defaultScope,
    identity: adapters.identity,
    links: adapters.links,
    media: adapters.media,
    config: adapters.config,
  };

  return {
    engine,
    modules: input.modules ?? [],
    theme: input.theme,
    plugins: input.plugins ?? [],
  };
}

/** Виконує setup() усіх модулів (виклик під час bootstrap застосунку). */
export async function bootstrapRuntime(rt: SimplyCmsRuntime): Promise<void> {
  for (const mod of rt.modules) {
    await mod.setup?.(rt.engine);
  }
}
