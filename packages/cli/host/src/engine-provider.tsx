// Збірка EngineContext + монтування EngineProvider у дерево застосунку.
//
// 🔴 V2: Supabase тут більше немає. Шар репозиторіїв (`data-supabase`,
// порт-хуки) знесений — браузер у БД не ходить, дані приходять серверними
// лоадерами (`simplycms/storefront`) через `simplycms/db`. У контейнері
// лишились два ЧИСТИХ провайдери — резолвер посилань і конфіг магазину,
// тож файл ізоморфний і безпечний для серверного `__root`.

import { useMemo, type ReactNode } from 'react';
import { EngineProvider } from 'simplycms/react-query';
import type { EngineContext } from 'simplycms/contracts';
import { appLinks, appConfig } from './engine.shared';

/** Збирає EngineContext магазину. Ізоморфний: жодного IO. */
export function buildClientEngine(): EngineContext {
  return { links: appLinks, config: appConfig };
}

/** Монтує EngineProvider у дереві застосунку. */
export function ClientEngineProvider({ children }: { children: ReactNode }) {
  const engine = useMemo(() => buildClientEngine(), []);
  return <EngineProvider value={engine}>{children}</EngineProvider>;
}
