---
applyTo: "src/**/*.{ts,tsx},packages/**/*.{ts,tsx}"
description: "Правила роботи з даними та Supabase в SimplyCMS"
---

# Data Access Rules

## ✅ ALWAYS

### Supabase клієнти
- 🔴 **Шар даних вітрини на Supabase знесений повністю** (0.4.1): SSR-лоадери,
  клієнтські запити воронки й auth переведені на Drizzle поверх чистого
  Postgres (`withActor`) і Better Auth — див. «Storefront (SSR)». Supabase
  лишається живим **лише для адмінки** (`packages/simplycms/src/admin/**`) —
  її переписує трек К3.
- **Серверні функції (адмінка):** `createServerSupabase()` з `simplycms/supabase/server-client` (cookie-based, через `getHeaders`/`setCookie` TanStack Start).
- **Клієнтські компоненти (адмінка):** використовуй DI — `useSupabaseClient()` з `simplycms/supabase/SupabaseProvider`. 🔴 **Борг (роадмап 0.4.1-11):** `SupabaseProvider` НЕ монтується в проді — `CMSProvider` його не несе, і жодної точки інжекції в дереві застосунку немає. `useSupabaseClient()` без контексту-провайдера відкатується на `resolveDefaultClient()` → модульний singleton `getSupabaseBrowserClient()`, тож увесь код адмінки сьогодні фактично сидить на ньому, а не на DI. Пиши через `useSupabaseClient()` як і раніше (це форма, яку зніме трек К3) — просто май на увазі, що DI-шов декларований, а не підключений.
- **Анонімні cross-request сценарії** (SSR-резолв теми): `createAnonSupabaseClient()` з `simplycms/supabase/anon-client` — без cookies, лише RLS `anon`-читання.
- 🔴 Субшляху `simplycms/data-supabase` **НЕ ІСНУЄ** — шар репозиторіїв-портів
  знесений (0.4.1, 0 споживачів). Нові data-шляхи вітрини — лоадери
  `withStorefrontDb`/`withActor` над Drizzle-схемою (див. «Storefront (SSR)»);
  нові data-шляхи адмінки — прямий `useSupabaseClient()`/`createServerSupabase()`.
- **Інспекція БД** (структура таблиць, RLS policies, аналіз) — через MCP supabase у read-only режимі: `list_tables`, `execute_sql` (лише `SELECT`), `get_advisors`, `search_docs`. Зміни схеми — виключно міграціями (див. «Міграції»).

### Storefront (SSR)
- Data fetching — у route `loader` через `createServerFn`
  (`simplycms/storefront-routes/server/*`), який делегує в `simplycms/storefront/loaders`.
- 🔴 Лоадери вітрини ходять у БД **лише** через `withStorefrontDb` із
  `simplycms/storefront/loaders` (обгортка над `withActor`, роль `app_user` без
  `userId`). Кожен лоадер приймає `ActorDb` першим аргументом, тож уся сторінка
  збирається в ОДНІЙ транзакції. Supabase-клієнта в цьому шарі немає.
- 🔴 **Видимість фільтрує КОД.** На каталозі RLS немає — `app_user` має SELECT на
  всю таблицю, бо «активність» це правило показу, а не право доступу. Кожен
  публічний запит зобовʼязаний нести предикат явно (`is_active = true`,
  `has_page = true`). Забутий предикат не падає — він виводить чернетки у вітрину.
  ```typescript
  // packages/simplycms/src/storefront-routes/server/catalog.ts
  export const getSectionPageData = createServerFn({ method: 'GET' })
    .inputValidator(z.object({ slug: z.string().min(1) }))
    .handler(async ({ data }) =>
      withStorefrontDb(async (db) => {
        const section = await loadSectionBySlug(db, (data as { slug: string }).slug);
        return section ? { section, products: await loadProductList(db, section.id) } : null;
      }),
    );
  ```
- Типи рядків для НОВОГО серверного коду — з `simplycms/schema/types` (Drizzle),
  а не з `supabase/types.ts` / `supabase/database.ts`.
- `head` на кожній SSR-сторінці (title, description, og:*, canonical, JSON-LD де доречно).
- Кеш-інвалідація — через `staleTime`/router invalidate + in-memory TTL-кеші серверних функцій (ISR/`revalidatePath` не існує).

### Контракт ключів кешу (React Query)

🔴 **`queryKey` не пишеться літералом** (V2-К3, рішення К3-3). Сегмент 0
завжди йде з реєстру `simplycms/contracts/entities`, а не з довільного
рядка (`'admin'`, `'catalog'` тощо) — інакше та сама сутність отримує в
різних місцях різні ключі, і мутація в одному не інвалідовує кеш іншого
(виміряно: `pickup_points` жила під чотирма ключами до реєстру). Три
механізми:
- **`entityKey(ENTITY.x)`** — однотабличний ключ: `.all()` / `.list()` /
  `.detail(id)` / `.scoped(relation, parentId)`.
- **`AGGREGATE.x`** (`aggregateKey`) — запит, що одним походом читає
  КІЛЬКА таблиць: `.key` — стабільний префікс для інвалідації, `.deps` —
  повний список читаних таблиць (не декорація — саме звідси інвалідація
  бере, що скидати).
- **`SESSION_KEY`** — похідний/сесійний стан, що не належить жодній
  таблиці (наприклад обчислене право доступу).

Лінт (`eslint-rules/query-key-from-entity.mjs`) переводить це на `error`
для `core/`, `*-ui/`, `react-query/`, `storefront-routes/` пакета ядра. 🔴
`packages/simplycms/src/admin/**` — свідома виїмка з цієї зони: її ключі
переписує наступний етап (Е1б–Е6), а не цей документ.

### Admin (Client-side)
- TanStack React Query для data fetching в адмін-панелі:
  ```typescript
  import { ENTITY, entityKey } from 'simplycms/contracts/entities';

  const supabase = useSupabaseClient();
  const productKeys = entityKey(ENTITY.products);
  const { data: products } = useQuery({
    queryKey: productKeys.list(),
    queryFn: async () => {
      const { data, error } = await supabase.from('products').select('*');
      if (error) throw error;
      return data;
    },
  });
  ```
- `useMutation` з invalidation для CUD-операцій.
- Після mutations — інвалідація відповідних query keys.

### Контракт id: ключ генерує викликач, не БД

🔴 **Інваріант треку V2-К3 (етап Е0, 0.4.1; ревізія Е1а).** У 41 таблиці
«Категорії A» знято `DEFAULT gen_random_uuid()`, тож **кожен** шлях вставки
зобовʼязаний передати `id` явно:

```typescript
// сервер (SSR-лоадери, server fns, auth-провізія, реєстри тем/плагінів)
import { randomUUID } from 'node:crypto';
await db.insert(userAddresses).values({ id: randomUUID(), userId, ...input });

// клієнт (сторінки адмінки, плагіни через usePluginTable)
await port.insert({ id: crypto.randomUUID(), question, answer });
```

Чому не DEFAULT: оптимістичний рядок у клієнтському кеші мусить мати ТОЙ
САМИЙ ключ, що й рядок у БД, — інакше після відповіді сервера кеш ловить
дубль. Пропущений `id` тепер падає гучно (`23502 not_null_violation`), а не
розходиться тихо.

**Дві виїмки, і вони іменовані:**

| Виїмка | Чому | Хто стереже |
|---|---|---|
| `users`, `sessions`, `accounts`, `verifications` | Better Auth із `generateId: 'uuid'` не кладе `id` в INSERT узагалі | `id-defaults.test.ts` (Категорія B) |
| `packages/simplycms/src/admin/**` | застарілий шар на `supabase-js`, переписується в Е1–Е6 | `tests/admin-inserts-need-id.test.ts` — ратчет, число може лише зменшуватись |

🔴 Ревізія Е1а: `orders` вийшла з винятків і перейшла в Категорію A —
після Е0 її єдина вставка (`order-create.ts:99`) передає ключ явно, тож
DEFAULT перестав бути страхувальною сіткою і став fail-silent пасткою в
таблиці, яку адмінка отримує в керування.

Гейт інваріанта — `packages/simplycms/test-harness/pg/__tests__/explicit-ids.test.ts`
(`pnpm test:schema`): він **дискаверить** усі вставки в `packages/simplycms/src/**`,
а не звіряється зі списком, тож нова вставка без `id` червонить його одразу.

### Типи та валідація
- 🔴 `pnpm db:generate-types` і `pnpm types:baseline` — **ВИДАЛЕНІ** (0.4.1)
  разом із генератом `supabase/types.ts`: типи для НОВОГО серверного коду
  беруться з `simplycms/schema/types` (Drizzle). Baseline-файл адмінки
  (`packages/simplycms/src/supabase/database.ts`) заморожений до треку К3 і
  генератором більше не оновлюється.
- DB команди (`db:pull`, `db:diff`) працюють через `DATABASE_URL` з `.env.local`.
- Zod schemas для валідації форм (react-hook-form + @hookform/resolvers/zod).

### Env-матриця для DB команд

| Змінні | Команди |
|--------|---------|
| `DATABASE_URL` | `db:pull`, `db:diff` (прямий SQL-конект); 🔴 у V2 — ще й рантайм-пул `simplycms/db` |

### Міграції

Джерело правди схеми — **`packages/simplycms/src/schema/schema.ts`** (Drizzle).
Флоу зміни схеми:

```bash
# 1. правка packages/simplycms/src/schema/schema.ts
pnpm db:diff <name>       # 2. drizzle-kit generate → packages/simplycms/migrations/NNNN_<name>.sql
#                            3. РЕВʼЮ згенерованого SQL (git diff) — обовʼязково
pnpm test:schema          # 4. накат УСЬОГО канону на чисту БД харнеса (потребує Postgres)
```

- 🔴 Канон застосовного SQL — **`packages/simplycms/migrations/`**: baseline
  (`0000_prelude` → `0003_seed`) плюс усе, що додав `db:diff`. Історії з 33
  Supabase-міграцій більше немає (рішення B13); теки `supabase/migrations/`
  теж. Порядок накату задає числовий префікс імені, не таймстамп.
- 🔴 `pnpm db:migrate` виведено з експлуатації (B2/B13) — Supabase CLI
  виходить із тулчейна. Скрипт лишається надгробком і падає з поясненням.
- Журнал і snapshot Drizzle — окремо, у `packages/simplycms/drizzle/`
  (подвійна бухгалтерія навмисна, комітяться обидві теки; нумерація в них
  своя — drizzle не бачить рукописних файлів канону). 🔴 Schema-тулінг
  (`drizzle/`, `drizzle.config.ts`, `seed-migrations/`)
  живе на рівні ПАКЕТА, не в `src/schema/`.
- Seed-міграції ядра (reference): `packages/simplycms/seed-migrations/`.
- Копію канону для магазину везе шаблон скаффолдера
  (`template/supabase/migrations/`, `pnpm template:sync`); `simplycms db:diff`
  у магазині докочує з неї нове поверх baseline.
- Сайт може додавати власні міграції поруч з seed-файлами.
- 🔴 Ревʼю SQL перед накатом — обовʼязкове: drizzle-kit не бачить
  перейменувань (генерує `DROP`+`ADD`) і не діфить ролі, гранти й функції.
- 🔴 `packages/simplycms/src/supabase/database.ts` (baseline типів адмінки)
  **заморожений до треку К3**: генератор (`db:generate-types`/`types:baseline`)
  видалений разом із генератом `supabase/types.ts` (0.4.1), тож після зміни
  core-схеми файл руками НЕ оновлюється. Деталі — `packages/simplycms/src/supabase/README.md`.

## Supabase Data Patterns

### Server function + in-memory TTL cache (cross-request)
```typescript
// packages/simplycms/src/storefront-routes/server/theme-record.ts — еталон патерну
const CACHE_TTL = 5 * 60 * 1000;
let cache: { data: T | null; timestamp: number } | null = null;

export async function loadActiveTheme() {
  if (cache && Date.now() - cache.timestamp < CACHE_TTL) return cache.data;
  const record = await withStorefrontDb(async (db) => /* ... запит */);
  cache = { data: record, timestamp: Date.now() };
  return record;
}
```

### Mutations (admin)
```typescript
import { ENTITY, entityKey } from 'simplycms/contracts/entities';

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
    queryClient.invalidateQueries({ queryKey: entityKey(ENTITY.products).all() });
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
- Не пиши SQL-міграції руками з нуля і не застосовуй їх через MCP (`apply_migration`) чи `execute_sql` — тільки `pnpm db:diff` → ревʼю → `pnpm test:schema`.
- Не редагуй `packages/simplycms/drizzle/meta/*` вручну для звичайних змін
  схеми — зміни йдуть через `pnpm db:diff`. Виняток — точкова правка
  BASELINE (`drizzle/0000_init.sql` + `drizzle/meta/0000_snapshot.json`,
  синхронно з каноном і `schema.ts`), коли повний `db:diff` додав би зайвий
  журнальний запис замість виправлення `0000` (застосовано в Е0 і Е1а).
  Кожна така правка мусить лишити канон ≡ drizzle-baseline ≡ снапшот і
  підтверджуватись `drizzle-kit generate` → «No schema changes».
- Не імпортуй глобальний supabase-клієнт (його не існує) — тільки `useSupabaseClient()`/інжектований client.
- Не імпортуй `simplycms/data-supabase` — субшляху не існує (0.4.1, шар знесено).
- 🔴 Не покладайся на `DEFAULT gen_random_uuid()` при вставці — його знято
  (Категорія A). Не «лагодь» падіння `23502` поверненням DEFAULT у схему:
  ключ мусить передати викликач (див. «Контракт id»).
- Не забувай інвалідацію query keys після мутацій в адмінці.
- Не використовуй `queryClient.setQueryData()` для складних кейсів — invalidate замість цього.
- Не роби DB calls у серверних функціях без обробки помилок.
- Не хардкодь query keys — сегмент 0 з `entityKey`/`AGGREGATE`/`SESSION_KEY`
  (`simplycms/contracts/entities`), див. «Контракт ключів кешу».

## ℹ️ Де шукати деталі
- `packages/simplycms/src/supabase/` — клієнти Supabase адмінки (server/anon/SupabaseProvider).
- `packages/simplycms/src/storefront/` — SSR-лоадери вітрини (`withStorefrontDb`) поверх Drizzle.
- `packages/simplycms/src/react-query/` — `EngineProvider`, хуки.
- `packages/simplycms/src/schema/README.md` — Drizzle-baseline, RLS-parity gate, ручні правки після `pull`.
- `scripts/db-diff.mjs`, `scripts/db-migrate.mjs` — конвеєр міграцій.
- `docs/superpowers/specs/2026-07-30-platform-architecture-design.md` — порти, DI, цільова пакетна архітектура.
