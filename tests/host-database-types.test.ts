import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { createServerSupabase } from 'simplycms/supabase/server-client';
import type { createBrowserSupabase } from 'simplycms/supabase/browser-client';
import type { StoreDatabase } from '../src/engine.shared';

// Generic-місток типів БД (Task 1.1).
//
// Пакети ядра типізуються проти baseline-снапшота core-схеми
// (`simplycms/supabase/database`). Магазин має ВЛАСНИЙ генерат
// `supabase/types.ts` — з core-таблицями ПЛЮС таблицями встановлених плагінів —
// і підставляє його в generic-параметр фабрик клієнтів.
//
// 🔴 Гард спирається на таблицю, якої в baseline НЕМАЄ (`__probe` — двійник
// плагінної). Брати core-таблицю (products/themes/…) марно: вона є і в baseline,
// тому пін `createServerClient<Database>` замість `<Db>` лишався б зеленим.
// Тепер такий пін ламає `.from('__probe')` → `pnpm typecheck` червоніє.
//
// Імпорти — `import type`: server-client тягне `@tanstack/react-start/server`,
// якому в цьому тесті немає де виконатися.

/** Таблиця «встановленого плагіна» — у baseline ядра її свідомо немає. */
interface ProbeTable {
  Row: { id: string; payload: string | null };
  Insert: { id?: string; payload?: string | null };
  Update: { id?: string; payload?: string | null };
  Relationships: [];
}

/** Типи БД магазину з плагінною таблицею — рівно те, що дає `db:generate-types`. */
type StoreDatabaseProbe = StoreDatabase & {
  public: { Tables: { __probe: ProbeTable } };
};

type ProbeServerClient = ReturnType<
  typeof createServerSupabase<StoreDatabaseProbe>
>;
type ProbeBrowserClient = ReturnType<
  typeof createBrowserSupabase<StoreDatabaseProbe>
>;

/**
 * Не викликається — існує заради перевірки типів компілятором.
 * Експортується, щоб не бути «мертвим кодом» для лінтера.
 */
export function probeQueries(
  server: ProbeServerClient,
  browser: ProbeBrowserClient,
) {
  return {
    server: server.from('__probe').select('id, payload'),
    browser: browser.from('__probe').select('id, payload'),
  };
}

const BASELINE_PATH = fileURLToPath(
  new URL('../packages/simplycms/src/supabase/database.ts', import.meta.url),
);

describe('generic-місток типів БД host ↔ simplycms/supabase', () => {
  it('baseline ядра не знає таблиці `__probe` — компіляційний гард не самообман', () => {
    // Якщо `__probe` колись потрапить у baseline, `.from('__probe')` вище
    // почне компілюватися й з піном на baseline — гард стане тавтологією.
    expect(readFileSync(BASELINE_PATH, 'utf8')).not.toContain('__probe');
  });
});
