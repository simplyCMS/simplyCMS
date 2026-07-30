---
applyTo: "src/**/*.{ts,tsx},packages/simplycms/**/*.{ts,tsx}"
description: "Правила роботи з даними та Supabase в SimplyCMS"
---

# Data Access Rules

## ✅ ALWAYS

### Supabase клієнти
- **Серверні функції / loaders:** використовуй `createServerSupabase()` з `@simplysoftua/core/supabase/server` (cookie-based, через `getHeaders`/`setCookie` TanStack Start).
- **Клієнтські компоненти:** використовуй DI — `useSupabaseClient()` з `@simplysoftua/core/supabase/SupabaseProvider` (глобального singleton-клієнта немає).
- **Анонімні cross-request сценарії** (SSR-резолв теми, sitemap): `createAnonSupabaseClient()` з `@simplysoftua/core/supabase/anon` — без cookies, лише RLS `anon`-читання.
- **Порти/репозиторії:** нові data-шляхи будуй через `@simplysoftua/data-supabase` (репозиторії з інжектованим клієнтом + `ScopeResolver`) та хуки `@simplysoftua/react-query` (`useEngine()`).
- Виконуй роботу з базою даних через MCP supabase, включаючи аналіз структури таблиць, RLS policies та виконання міграцій.

### Storefront (SSR)
- Data fetching — у route `loader` через `createServerFn` (`src/server/*`), який делегує в `@simplysoftua/storefront/loaders`:
  ```typescript
  // src/routes/_storefront/catalog/$sectionSlug/index.tsx
  export const Route = createFileRoute('/_storefront/catalog/$sectionSlug/')({
    loader: async ({ params }) => getSectionPageData({ data: params.sectionSlug }),
    component: CatalogSectionRoute,
  });
  ```
- `head` на кожній SSR-сторінці (title, description, og:*, canonical, JSON-LD де доречно).
- Кеш-інвалідація — через `staleTime`/router invalidate + in-memory TTL-кеші серверних функцій (ISR/`revalidatePath` не існує).

### Admin (Client-side)
- TanStack React Query для data fetching в адмін-панелі:
  ```typescript
  const supabase = useSupabaseClient();
  const { data: products } = useQuery({
    queryKey: ['admin', 'products'],
    queryFn: async () => {
      const { data, error } = await supabase.from('products').select('*');
      if (error) throw error;
      return data;
    },
  });
  ```
- `useMutation` з invalidation для CUD-операцій.
- Після mutations — інвалідація відповідних query keys.

### Типи та валідація
- Генеруй типи після змін схеми: `pnpm db:generate-types`.
- Не редагуй `supabase/types.ts` вручну — лише через генератор.
- DB команди працюють через `SUPABASE_PROJECT_ID` + `SUPABASE_ACCESS_TOKEN` з `.env.local` (Management API).
- Zod schemas для валідації форм (react-hook-form + @hookform/resolvers/zod).

### Міграції
- Всі міграції живуть на рівні проекту: `supabase/migrations/`.
- Seed-міграції ядра (reference): `packages/simplycms/schema/seed-migrations/`.
- Сайт може додавати власні міграції поруч з seed-файлами.
- Створюй міграції через MCP supabase `apply_migration`.

## Supabase Data Patterns

### Server function + in-memory TTL cache (cross-request)
```typescript
// src/server/themes.ts — еталон патерну
const CACHE_TTL = 5 * 60 * 1000;
let cache: { data: T | null; timestamp: number } | null = null;

export const getActiveTheme = createServerFn({ method: 'GET' }).handler(async () => {
  if (cache && Date.now() - cache.timestamp < CACHE_TTL) return cache.data;
  const supabase = createAnonSupabaseClient();
  // ... запит; заповнити cache; повернути
});
```

### Mutations (admin)
```typescript
const mutation = useMutation({
  mutationFn: async (product: ProductInput) => {
    const { data, error } = await supabase
      .from('products')
      .insert(product)
      .select()
      .single();
    if (error) throw error;
    return data;
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['admin', 'products'] });
    toast.success('Товар створено');
  },
  onError: (error) => {
    toast.error(`Помилка: ${error.message}`);
  },
});
```

## ⚠️ Винятки

### Анонімний клієнт у SSR-резолві теми
`getActiveTheme` / `getActiveThemeSSR` використовують `createAnonSupabaseClient()` замість
cookie-based клієнта. Це **навмисний виняток**: результат кешується cross-request (in-memory TTL),
тому per-request cookies тут недоречні. Анонімний клієнт (без auth) безпечний для цього кейсу,
бо таблиця `themes` має RLS `SELECT` для `anon`.

## ❌ NEVER
- Не створюй локальні файли міграцій — завжди через MCP supabase.
- Не імпортуй глобальний supabase-клієнт (його не існує) — тільки `useSupabaseClient()`/інжектований client/репозиторії.
- Не редагуй `supabase/types.ts` вручну — виключно через `pnpm db:generate-types`.
- Не забувай інвалідацію query keys після мутацій в адмінці.
- Не використовуй `queryClient.setQueryData()` для складних кейсів — invalidate замість цього.
- Не роби DB calls у серверних функціях без обробки помилок.
- Не хардкодь query keys — використовуй константи або фабрики.

## ℹ️ Де шукати деталі
- `packages/simplycms/core/src/supabase/` — клієнти Supabase (server/anon/SupabaseProvider).
- `packages/simplycms/data-supabase/src/` — репозиторії-порти.
- `packages/simplycms/react-query/src/` — `EngineProvider`, query-фабрики, хуки.
- `docs/architecture/core-engine-extraction.md` — порти, DI, tier-архітектура.
