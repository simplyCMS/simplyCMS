// Складання EngineContext для simplyCMS-застосунку через simplycms/runtime.
// Це reference-приклад P9: магазин збирається з адаптерів data-supabase
// + app-специфічних LinkResolver/MediaProvider/ConfigProvider.
//
// Викликати лише в серверному контексті (createServerFn handler / middleware),
// бо createServerSupabase читає request-cookies.

import {
  createSupabaseCatalogRepository,
  createSupabaseOrderRepository,
  createSupabaseIdentityProvider,
  singleTenantScope,
} from 'simplycms/data-supabase';
import { defineRuntime, type SimplyCmsRuntime } from 'simplycms/runtime';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServerSupabase } from 'simplycms/supabase/server-client';
import {
  appLinks,
  appConfig,
  createAppMediaProvider,
  type StoreDatabase,
} from '../engine.shared';

// Спільні адаптери винесено в ../engine.shared (щоб переюзати на клієнті).
export { appLinks, appConfig, createAppMediaProvider } from '../engine.shared';

/**
 * Збирає серверний рантайм магазину: один інжектований Supabase-клієнт
 * + адаптери репозиторіїв + app-провайдери. Single-tenant (без hub_id).
 */
export function createServerRuntime(cookieHeader?: string): SimplyCmsRuntime {
  // Типи МАГАЗИНУ (core + плагінні таблиці) — пакетна фабрика лишається на baseline.
  const client = createServerSupabase<StoreDatabase>(
    cookieHeader,
  ) as unknown as SupabaseClient;
  return defineRuntime({
    adapters: {
      catalog: createSupabaseCatalogRepository(client, singleTenantScope),
      orders: createSupabaseOrderRepository(client, singleTenantScope),
      identity: createSupabaseIdentityProvider(client),
      scope: singleTenantScope,
      links: appLinks,
      media: createAppMediaProvider(client),
      config: appConfig,
    },
  });
}
