---
applyTo: "app/**/*.{ts,tsx},packages/simplycms/**/*.{ts,tsx}"
description: "Правила роботи з даними та Supabase в SimplyCMS"
---

# Data Access Rules

## ✅ ALWAYS

### Supabase клієнти
- **Server Components / Server Actions:** використовуй `createServerSupabase()` з `@simplysoftua/core/supabase/server` (cookie-based).
- **Client Components:** використовуй `supabase` з `@simplysoftua/core/supabase/client` (browser client).
- **Proxy:** використовуй `createProxySupabaseClient()` з `@simplysoftua/core/supabase/proxy` (cookie-based session refresh + guards).
- **API Routes:** використовуй `createServerSupabase()` для authenticated запитів.
- Виконуй роботу з базою даних через MCP supabase, включаючи аналіз структури таблиць, RLS policies та виконання міграцій.

### Storefront (SSR)
- Data fetching у Server Components для SEO-сторінок:
  ```typescript
  // app/(storefront)/catalog/[sectionSlug]/page.tsx
  export default async function CatalogSectionPage({ params }) {
    const { sectionSlug } = await params;
    const supabase = await createServerSupabase();
    const { data: products } = await supabase
      .from('products')
      .select('*, sections(*)')
      .eq('section_slug', sectionSlug)
      .eq('is_active', true);

    return <ThemedCatalogSectionPage products={products} />;
  }
  ```
- ISR revalidation через `/api/revalidate` endpoint.
- `generateMetadata` для SEO на кожній SSR-сторінці.

### Admin (Client-side)
- TanStack React Query для data fetching в адмін-панелі:
  ```typescript
  const { data: products } = useQuery({
    queryKey: ['products'],
    queryFn: () => supabase.from('products').select('*'),
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

### SSR Fetching (storefront)
```typescript
// Server Component
const supabase = await createServerSupabase();
const { data, error } = await supabase
  .from('products')
  .select('*, sections(name, slug)')
  .eq('is_active', true)
  .order('created_at', { ascending: false });
```

### Client Fetching (admin)
```typescript
// Client Component з TanStack Query
const { data, isLoading } = useQuery({
  queryKey: ['admin', 'products'],
  queryFn: async () => {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },
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

### On-demand ISR
```typescript
// Після збереження товару в адмінці — тригер revalidation
await fetch('/api/revalidate', {
  method: 'POST',
  body: JSON.stringify({ type: 'product', slug, sectionSlug }),
});
```

## ⚠️ Винятки

### Анонімний клієнт у `unstable_cache` (getActiveThemeSSR)
`getActiveThemeSSR()` використовує `createAnonSupabaseClient()` замість `createServerSupabase()`.
Це **навмисний виняток**: `unstable_cache` — cross-request кеш (Data Cache), а `cookies()` —
динамічний per-request API. Next.js забороняє виклик `cookies()` всередині `unstable_cache`,
тому cookie-based серверний клієнт тут неможливий. Анонімний клієнт (без cookies, без auth)
безпечний для цього кейсу, бо таблиця `themes` має RLS `SELECT` для `anon`.

## ❌ NEVER
- Не створюй локальні файли міграцій — завжди через MCP supabase.
- Не використовуй прямий `supabase-js` без обгорток з `@simplysoftua/core` (виняток: `unstable_cache`, див. вище).
- Не редагуй `supabase/types.ts` вручну — виключно через `pnpm db:generate-types`.
- Не забувай ISR revalidation після змін даних в адмінці.
- Не використовуй `queryClient.setQueryData()` для складних кейсів — invalidate замість цього.
- Не роби DB calls з Server Components без try-catch обробки помилок.
- Не хардкодь query keys — використовуй константи або фабрики.

## ℹ️ Де шукати деталі
- `BRD_SIMPLYCMS_NEXTJS.md` секція 9 — SSR стратегія, ISR revalidation.
- `BRD_SIMPLYCMS_NEXTJS.md` секція 10 — автентифікація та Supabase SSR.
- `BRD_SIMPLYCMS_NEXTJS.md` секція 11 — міграції ядра vs проекту.
- `packages/simplycms/core/src/supabase/` — клієнти Supabase.
- `packages/simplycms/core/src/hooks/` — бізнес-хуки з data fetching.
