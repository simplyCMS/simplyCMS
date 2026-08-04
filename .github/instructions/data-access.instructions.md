---
applyTo: "src/**/*.{ts,tsx},packages/**/*.{ts,tsx}"
description: "Правила роботи з даними та Supabase в SimplyCMS"
---

# Data Access Rules

## ✅ ALWAYS

### Supabase клієнти
- **Серверні функції / loaders:** використовуй `createServerSupabase()` з `@simplycms/supabase/server-client` (cookie-based, через `getHeaders`/`setCookie` TanStack Start).
- **Клієнтські компоненти:** використовуй DI — `useSupabaseClient()` з `@simplycms/supabase/SupabaseProvider` (глобального singleton-клієнта немає).
- **Анонімні cross-request сценарії** (SSR-резолв теми, sitemap): `createAnonSupabaseClient()` з `@simplycms/supabase/anon-client` — без cookies, лише RLS `anon`-читання.
- **Порти/репозиторії:** нові data-шляхи будуй через `@simplycms/data-supabase` (репозиторії з інжектованим клієнтом + `ScopeResolver`) та хуки `@simplycms/react-query` (`useEngine()`).
- **Інспекція БД** (структура таблиць, RLS policies, аналіз) — через MCP supabase у read-only режимі: `list_tables`, `execute_sql` (лише `SELECT`), `get_advisors`, `search_docs`. Зміни схеми — виключно міграціями (див. «Міграції»).

### Storefront (SSR)
- Data fetching — у route `loader` через `createServerFn`
  (`@simplycms/storefront-routes/src/server/*`), який делегує в `@simplycms/storefront/loaders`:
  ```typescript
  // packages/storefront-routes/routes/_storefront/catalog/$sectionSlug/index.tsx
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
- Генеруй типи після змін схеми: `pnpm db:generate-types` (`pnpm db:migrate` робить це сам).
- Не редагуй `supabase/types.ts` вручну — лише через генератор.
- DB команди працюють через `SUPABASE_PROJECT_ID` + `SUPABASE_ACCESS_TOKEN` з `.env.local` (Management API).
- Zod schemas для валідації форм (react-hook-form + @hookform/resolvers/zod).

### Env-матриця для DB команд

| Змінні | Команди |
|--------|---------|
| `SUPABASE_PROJECT_ID` + `SUPABASE_ACCESS_TOKEN` | `db:generate-types`, `db:migrate` (Management API) |
| `DATABASE_URL` | `db:pull`, `db:diff`, `db:dump-rls` (прямий SQL-конект, session pooler) |

### Міграції

Джерело правди схеми — **`packages/schema/src/schema.ts`** (Drizzle).
Флоу зміни схеми:

```bash
# 1. правка packages/schema/src/schema.ts
pnpm db:diff <name>       # 2. drizzle-kit generate → supabase/migrations/<ts>_<name>.sql
#                            3. РЕВʼЮ згенерованого SQL (git diff) — обовʼязково
pnpm db:migrate           # 4. supabase link + db push + автоматичний db:generate-types
pnpm types:baseline       # 5. ТІЛЬКИ якщо змінилась CORE-схема (не плагінна) —
#                            на еталонній dev-БД без встановлених плагінів
```

- Всі застосовні міграції живуть на рівні проекту: `supabase/migrations/`
  (формат Supabase CLI: `<YYYYMMDDHHmmss>_<slug>.sql`).
- Журнал і snapshot Drizzle — окремо, у `packages/schema/drizzle/`
  (подвійна бухгалтерія навмисна, комітяться обидві теки).
- Seed-міграції ядра (reference): `packages/schema/seed-migrations/`.
- Сайт може додавати власні міграції поруч з seed-файлами.
- 🔴 Ревʼю SQL перед `db:migrate` — обовʼязкове: drizzle-kit не бачить
  перейменувань (генерує `DROP`+`ADD`) і не діфить RLS-політики/тригери.
- 🔴 Крок 5 (`types:baseline`) — НЕ автоматизований навмисно: `db:migrate`
  застосовується й до dev-БД із встановленими плагінами, а baseline
  (`packages/supabase/src/database.ts`) публікується на npm і
  повинен містити ЛИШЕ core-таблиці. Автозапуск мовчки затягнув би плагінні
  таблиці в опублікований пакет за одного невдалого запуску. Деталі й повний
  розклад двох файлів типів — `packages/supabase/README.md`.

## Supabase Data Patterns

### Server function + in-memory TTL cache (cross-request)
```typescript
// packages/storefront-routes/src/server/themes.ts — еталон патерну
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
- Не пиши SQL-міграції руками з нуля і не застосовуй їх через MCP (`apply_migration`) чи `execute_sql` — тільки `pnpm db:diff` → ревʼю → `pnpm db:migrate`.
- Не редагуй `packages/schema/drizzle/meta/*` вручну — це snapshot drizzle-kit.
- Не імпортуй глобальний supabase-клієнт (його не існує) — тільки `useSupabaseClient()`/інжектований client/репозиторії.
- Не редагуй `supabase/types.ts` вручну — виключно через `pnpm db:generate-types`.
- Не забувай інвалідацію query keys після мутацій в адмінці.
- Не використовуй `queryClient.setQueryData()` для складних кейсів — invalidate замість цього.
- Не роби DB calls у серверних функціях без обробки помилок.
- Не хардкодь query keys — використовуй константи або фабрики.

## ℹ️ Де шукати деталі
- `packages/supabase/src/` — клієнти Supabase (server/anon/SupabaseProvider).
- `packages/data-supabase/src/` — репозиторії-порти.
- `packages/react-query/src/` — `EngineProvider`, query-фабрики, хуки.
- `packages/schema/README.md` — Drizzle-baseline, RLS-parity gate, ручні правки після `pull`.
- `scripts/db-diff.mjs`, `scripts/db-migrate.mjs` — конвеєр міграцій.
- `docs/superpowers/specs/2026-07-30-platform-architecture-design.md` — порти, DI, цільова пакетна архітектура.
