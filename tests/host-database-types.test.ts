import { describe, expect, it } from 'vitest';
import type { createServerSupabase } from '@simplycms/supabase/server-client';
import type { createBrowserSupabase } from '@simplycms/supabase/browser-client';
import type { StoreDatabase } from '../src/engine.shared';

// Generic-місток типів БД (Task 1.1).
//
// Пакети ядра типізуються проти baseline-снапшота core-схеми
// (`@simplycms/supabase/database`). Магазин має ВЛАСНИЙ генерат
// `supabase/types.ts` — з core-таблицями ПЛЮС таблицями встановлених плагінів —
// і підставляє його в generic-параметр фабрик клієнтів.
//
// Гард саме компіляційний: якщо `Db` перестане доходити до
// `createServerClient`/`createBrowserClient` (наприклад, параметр приберуть або
// зафіксують на baseline), `.from()` нижче або втратить типізацію рядка, або
// впаде на невідомій таблиці — `pnpm typecheck` почервоніє.
//
// Імпорти — `import type`: server-client тягне `@tanstack/react-start/server`,
// якому в цьому тесті немає де виконатися.

type HostServerClient = ReturnType<typeof createServerSupabase<StoreDatabase>>;
type HostBrowserClient = ReturnType<
  typeof createBrowserSupabase<StoreDatabase>
>;

/** Не викликається — існує заради перевірки типів компілятором. */
function hostTypedServerQueries(client: HostServerClient) {
  const products = client.from('products').select('id, slug, name');
  const roles = client.from('user_roles').select('role').eq('role', 'admin');
  return { products, roles };
}

/** Те саме для браузерної фабрики. */
function hostTypedBrowserQueries(client: HostBrowserClient) {
  return client.from('themes').select('name, is_active');
}

describe('generic-місток типів БД host ↔ @simplycms/supabase', () => {
  it('host-типізовані фабрики компілюються з таблицями host-типів', () => {
    expect(typeof hostTypedServerQueries).toBe('function');
    expect(typeof hostTypedBrowserQueries).toBe('function');
  });
});
