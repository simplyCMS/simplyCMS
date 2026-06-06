// Збірка EngineContext + монтування EngineProvider у дерево застосунку.
// Робить рушій (`@simplycms/runtime`/`@simplycms/react-query`) ЖИВИМ:
// будь-який компонент під ним бере дані через useEngine()/порт-хуки,
// а не через прямий supabase. Ізоморфний: на SSR `useSupabaseClient()`
// повертає null, репозиторії будуються lazy (без деференсу), запити йдуть
// лише на клієнті — тож файл безпечно імпортувати з серверного __root.

import { useMemo, type ReactNode } from 'react';
import {
  createSupabaseCatalogRepository,
  createSupabaseOrderRepository,
  createSupabaseIdentityProvider,
  singleTenantScope,
} from '@simplycms/data-supabase';
import { EngineProvider } from '@simplycms/react-query';
import { useSupabaseClient } from '@simplycms/core/supabase/SupabaseProvider';
import type { EngineContext } from '@simplycms/objects';
import type { SupabaseClient } from '@supabase/supabase-js';
import { appLinks, appConfig, createAppMediaProvider } from './engine.shared';

/** Збирає клієнтський EngineContext з браузерного Supabase-клієнта + адаптерів. */
export function buildClientEngine(client: SupabaseClient): EngineContext {
  return {
    catalog: createSupabaseCatalogRepository(client, singleTenantScope),
    orders: createSupabaseOrderRepository(client, singleTenantScope),
    identity: createSupabaseIdentityProvider(client),
    scope: singleTenantScope,
    links: appLinks,
    media: createAppMediaProvider(client),
    config: appConfig,
  };
}

/**
 * Монтує EngineProvider у клієнтському дереві. Клієнт береться з
 * SupabaseProvider (CMSProvider). Репозиторії lazy — на SSR (client=null)
 * збираються без деференсу, запити йдуть лише на клієнті.
 */
export function ClientEngineProvider({ children }: { children: ReactNode }) {
  const client = useSupabaseClient();
  const engine = useMemo(
    () => buildClientEngine(client as unknown as SupabaseClient),
    [client],
  );
  return <EngineProvider value={engine}>{children}</EngineProvider>;
}
