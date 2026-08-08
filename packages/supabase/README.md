# @simplycms/supabase

Supabase-клієнти ядра SimplyCMS (browser / server / anon), DI-провайдер
`SupabaseProvider`, резолв env-ключів і **baseline типів БД** core-схеми.

Пакет ядра [SimplyCMS](https://github.com/simplyCMS/simplyCMS) — відкритої
e-commerce CMS на TanStack Start + Supabase. Окремо ставити зазвичай не треба:
магазин створюється скаффолдером `pnpm create simplycms-store`, який приводить
усе ядро разом.

## Встановлення

```bash
pnpm add @simplycms/supabase
```

## Що всередині

| Subpath              | Вміст |
|----------------------|-------|
| `.`                  | типи БД (`Database`, `Json`, `Tables`, `TablesInsert`, `TablesUpdate`, `Enums`, `CompositeTypes`), `Constants`, `resolveSupabaseKeys` |
| `./keys`             | `resolveSupabaseKeys` + типи `SupabaseEnv` / `SupabaseKeys` (publishable-ключ, anon — legacy-fallback) |
| `./browser-client`   | `createBrowserSupabase`, `getSupabaseBrowserClient`, тип `SupabaseClient` |
| `./server-client`    | `createServerSupabase` — cookies через TanStack Start |
| `./anon-client`      | `createAnonSupabaseClient` — публічні кешовані запити |
| `./SupabaseProvider` | `SupabaseProvider`, `useSupabaseClient` |

Фабрики й хук параметризовані типом БД. Дефолт — baseline core-схеми; магазин
підставляє **свій** `Database` (core + таблиці встановлених плагінів).

## Приклад

```ts
// src/server/engine.ts — лише серверний контекст: читаються request-cookies
import { createServerSupabase } from '@simplycms/supabase/server-client';
import type { StoreDatabase } from '../engine.shared';

const client = createServerSupabase<StoreDatabase>(cookieHeader);
await client.from('plg_loyalty_points').select('*'); // таблиця плагіна — типізована

// у React-дереві клієнт беруть з DI-контексту, а не з глобального singleton:
const supabase = useSupabaseClient<StoreDatabase>();
```

## 🔴 Кореневий барель свідомо не віддає клієнти

`server-client` тягне `@tanstack/react-start/server`, тож його попадання в барель
затягувало б серверний код у клієнтський бандл. Клієнти імпортуються **лише**
підшляхами (`@simplycms/supabase/browser-client` тощо).

## 🔴 Два файли типів БД — не плутати

`src/database.ts` цього пакета — **baseline** core-схеми: закомічений снапшот,
проти якого типізуються пакети ядра (доступу до БД магазину вони не мають).
Таблиці плагінів у baseline не входять ніколи — їх бачить лише генерат магазину
`supabase/types.ts`. Baseline регенерується після кожної core-міграції:
`pnpm db:generate-types` на еталонній dev-БД без плагінів → `pnpm types:baseline`.
Руками `src/database.ts` не редагується (він у `.prettierignore`).

## Ліцензія

MIT
