# simplycms/data-supabase

Supabase-реалізації портів рушія SimplyCMS: каталог, замовлення, ідентичність.
Клієнт і `ScopeResolver` інжектуються у фабрику — глобального singleton немає.

Шар ядра [SimplyCMS](https://github.com/simplyCMS/simplyCMS) — відкритої
e-commerce CMS на TanStack Start + Supabase. Окремим пакетом він більше не
постачається: усе ядро приходить одним npm-пакетом `simplycms`, а магазин
створюється скаффолдером `pnpm create simplycms-store`.

## Встановлення

```bash
pnpm add simplycms
```

Вхід цього шару — субшлях `simplycms/data-supabase`.

## Що всередині

Експорт один — корінь пакета; самі контракти портів — у `simplycms/contracts`.

| Символ | Що робить |
|--------|-----------|
| `createSupabaseCatalogRepository(client, scope?)` | товари, розділи, властивості, типи цін, знижки, залишки, зони доставки |
| `createSupabaseOrderRepository(client, scope?)`   | створення й вибірка замовлень, резолв статусу за `code`/`name` |
| `createSupabaseIdentityProvider(client)`          | `getCurrentUser` / `signIn` / `signOut`; ролі — з `user_roles` + `app_metadata` |
| `singleTenantScope`                               | `ScopeResolver` без скоупу — режим simplyCMS (дефолт обох репозиторіїв) |
| `hubScope(hubId)`                                 | `ScopeResolver` для multi-tenant |
| `SCOPE_COLUMN`                                    | колонка скоупу (`'hub_id'`) |
| `mappers`                                         | namespace: `mapProduct`, `mapOrder`, `mapSection`, `buildDiscountTree`, … |

## Приклад

```ts
// src/server/engine.ts — збірка серверного рантайму магазину
import {
  createSupabaseCatalogRepository,
  createSupabaseOrderRepository,
  createSupabaseIdentityProvider,
  singleTenantScope,
} from 'simplycms/data-supabase';
import { defineRuntime } from 'simplycms/runtime';
import { createServerSupabase } from 'simplycms/supabase/server-client';

const client = createServerSupabase(cookieHeader);

export const runtime = defineRuntime({
  adapters: {
    catalog: createSupabaseCatalogRepository(client, singleTenantScope),
    orders: createSupabaseOrderRepository(client, singleTenantScope),
    identity: createSupabaseIdentityProvider(client),
    scope: singleTenantScope,
    // + links / media / config — адаптери самого магазину
  },
});
```

Так само збирається клієнтський `EngineContext` — ті самі фабрики, але клієнт
береться з `useSupabaseClient()`.

## 🔴 Scope застосовується лише коли визначений

Репозиторії додають `.eq(SCOPE_COLUMN, …)` лише якщо `scope.getScope()` повернув
не `undefined`. Тому `singleTenantScope` — не «порожня заглушка», а робочий режим:
запити йдуть без фільтра, і таблиці ядра колонки `hub_id` не потребують.

## Ліцензія

MIT
