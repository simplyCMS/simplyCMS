# @simplycms/supabase

Supabase-клієнти ядра SimplyCMS (browser / server / anon), DI-провайдер,
резолв ключів і **baseline типів БД**.

## Два файли типів — не плутати

| Файл | Що містить | Хто оновлює |
|------|-----------|-------------|
| `packages/supabase/src/database.ts` | **baseline** типів CORE-схеми | `pnpm types:baseline` |
| `supabase/types.ts` (у магазині) | повні типи магазину: core **+ таблиці плагінів** | `pnpm db:generate-types` |

Baseline — закомічений снапшот: пакети ядра публікуються на npm і не мають
доступу до БД магазину, тож типізуються проти нього. Плагінні таблиці в
baseline **не входять ніколи** — їх бачить лише host-генерат.

## Правило оновлення baseline

🔴 Baseline регенерується **ПІСЛЯ кожної core-міграції**:

1. `pnpm db:generate-types` на **еталонній dev-БД без встановлених плагінів**;
2. `pnpm types:baseline` — копіює генерат у `src/database.ts` з банером.

`src/database.ts` — генерат: руками не редагується, у `.prettierignore`
(перевірку цього рядка робить сам `types:baseline`).

## Generic-місток до host-типів

Фабрики й DI-хук параметризовані типами БД. Дефолт — baseline, тож усі виклики
всередині пакетів ядра лишаються без змін:

```ts
createServerSupabase(); // baseline core-схеми
createBrowserSupabase();
createAnonSupabaseClient();
useSupabaseClient();
```

Магазин, у якого є плагінні таблиці, підставляє **свій** `Database` у точках
створення/споживання клієнта:

```ts
import type { Database as StoreDatabase } from './supabase/types';

const supabase = createServerSupabase<StoreDatabase>(cookieHeader);
await supabase.from('plg_loyalty_points').select('*'); // таблиця плагіна — типізована

const client = useSupabaseClient<StoreDatabase>();
<SupabaseProvider<StoreDatabase> client={client}>{children}</SupabaseProvider>;
```

Референс-магазин цього монорепо тримає тип-онлі реекспорт `StoreDatabase` у
`src/engine.shared.ts`; гард містка — `tests/host-database-types.test.ts`.

## Експорти

| Subpath | Вміст |
|---------|-------|
| `.` | типи БД (`Database`, `Json`, `Tables`, …), `Constants`, `resolveSupabaseKeys` |
| `./browser-client` | `createBrowserSupabase`, `getSupabaseBrowserClient`, тип `SupabaseClient` |
| `./server-client` | `createServerSupabase` (cookies через TanStack Start) |
| `./anon-client` | `createAnonSupabaseClient` (публічні кешовані запити) |
| `./SupabaseProvider` | `SupabaseProvider`, `useSupabaseClient` |
| `./keys` | `resolveSupabaseKeys`, типи `SupabaseEnv` / `SupabaseKeys` |

Кореневий барель свідомо **не** реекспортує клієнти: `server-client` тягне
`@tanstack/react-start/server`, і його попадання в барель затягувало б серверний
код у клієнтський бандл.
