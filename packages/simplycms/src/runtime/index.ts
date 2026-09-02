// simplycms/runtime — складання магазину через адаптери.
// Залежить лише від контрактів simplycms/contracts (без supabase/env).

import type {
  EngineContext,
  LinkResolver,
  ConfigProvider,
} from 'simplycms/contracts';

// Конфіг магазину (host-`defineConfig`) — окремий контур від складання
// EngineContext нижче: він описує САЙТ, а не адаптери даних.
export { defineConfig } from './config';
export type {
  SimplyCmsConfig,
  SimplyCmsSeoConfig,
  PluginRegistration,
  ThemeLoader,
} from './config';

// Контекст роутера (Route.useRouteContext) — тип-онлі, нуль рантайм-ваги.
export type { RouterContext } from './router-context';

/** Опис feature-модуля збірки (catalog/cart/checkout/orders/…). */
export interface EngineModule {
  name: string;
  /** Опційний хук ініціалізації модуля під час bootstrap. */
  setup?(engine: EngineContext): void | Promise<void>;
}

export interface DefineRuntimeInput {
  // 🔴 V2: адаптерів даних тут більше немає — репозиторії знесені разом із
  // шаром `data-supabase`, читання йде серверними лоадерами. Лишились два
  // чистих провайдери, з яких і складається EngineContext.
  adapters: {
    links: LinkResolver;
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

/**
 * Збирає рантайм магазину з адаптерів. Усі залежності інжектуються —
 * жодного прямого доступу до supabase чи import.meta.env тут немає.
 */
export function defineRuntime(input: DefineRuntimeInput): SimplyCmsRuntime {
  const { adapters } = input;

  const engine: EngineContext = {
    links: adapters.links,
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
