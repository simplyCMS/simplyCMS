# Роутинг і рендеринг

Як збирається дерево роутів, що рендериться на сервері, а що в браузері, і правила
продуктивності вітрини. Дані роутів — `docs/architecture/data-layer.md`, теми —
`docs/architecture/themes.md`, межа клієнт/сервер — `contracts/server-only`
(`docs/development/TOOLING.md` § «Лінт»).

## 1. Дерево роутів

- `routes.ts` (корінь) — `virtualRouteConfig`: `rootRoute('__root.tsx', [physical(…), …])`.
  Сканування `src/routes` цілком **вимкнено**: монтуються лише теки
  `packages/simplycms/routes/{storefront,admin}`, роути плагінів
  (`packages/simplycms-plugin-faq/routes`, рядок `physical()` додається після
  встановлення плагіна з `adminRoutes`) і `src/routes/my/` — єдина тека роутів
  магазину. Файл, покладений поруч із `__root.tsx`, роутом **не стане**
  (`tests/virtual-routes-escape.test.ts` стереже, що `physical()` бачить теки
  пакетів поза `src/routes/`).
- Усі теки змерджені на одному рівні (префікс `''`), тож id роутів такі самі, як
  при звичайному файловому скані.
- Ключі `exports` роут-тек пакета лишились СТАРИМИ (`./storefront-routes/routes/*`,
  `./admin-routes/routes/*`) при новій фізичній теці `routes/{storefront,admin}` —
  перенос 1:1 зберіг публічні входи.

| Група | Де | Стратегія | Опис |
|---|---|---|---|
| `_storefront/` | `routes/storefront/` | SSR | публічні сторінки, SEO; loader надає `themeName` |
| `_protected/` | `routes/storefront/` | SSR guard + client | `beforeLoad` перевіряє сесію, редіректить на `/auth` |
| `auth/` | `routes/storefront/` | client-only + server route | форми входу; `callback` — server handler |
| `api/` | `routes/storefront/` | server routes | `server.handlers` (health, revalidate-theme, `auth/*` — монтування Better Auth) |
| `media/` | `routes/storefront/` | server route | роздача файлів `/media/*` з порту сховища |
| `admin/` | `routes/admin/` | client-only (`ssr: false`) | `ssr: false` стоїть на `admin.tsx`; дочірні роути його **не** повторюють |
| `my/` | `src/routes/my/` | за потребою магазину | кастомні сторінки |

Client-only на вітрині також `_storefront/cart` і `_storefront/checkout`
(`ssr: false`: кошик живе в localStorage, сервер його не знає).

## 2. Правила

- **SSR для публічних сторінок** (каталог, товари, головна) — SEO критично.
  Адмінка — client-only.
- `ssr: false`-роут оголошує `pendingComponent` (усуває hydration-розбіжність і
  «білі» стани): сервер рендерить його замість сторінки. Зразок — `AdminPending`
  в `admin.tsx`. (🔴 Прогалина: `cart`/`checkout` його не мають.)
- Route-файли — **тонкі обгортки**: `createFileRoute` + компонент із пакета, без
  бізнес-логіки. Нова сторінка магазину — у `src/routes/my/`; сторінка ядра — у
  route-теці відповідного пакета.
- 🔴 **Мутуючий запит захищений від CSRF за замовчуванням.** `csrfMiddleware`
  (`simplycms/runtime/csrf`, першою в `requestMiddleware` у `src/start.ts`)
  перевіряє КОЖЕН запит із методом поза GET/HEAD/OPTIONS — і server function, і
  server route (`server.handlers.POST/PUT/PATCH/DELETE`): `Sec-Fetch-Site:
  same-origin` → інакше `Origin` проти origin запиту (за проксі — з
  `x-forwarded-proto/host`) → інакше `Referer`; жодного заголовка — 403.
  Новий мутуючий роут нічого додатково не робить. Не вішай зміну стану на GET
  (GET не перевіряється). Виняток — зовнішній виклик без `Origin` (вебхук
  платіжної системи): його префікс додається в `CSRF_EXEMPT_PREFIXES` ядра
  СВІДОМО, з причиною в коментарі і з власною автентифікацією виклику
  (підпис). Зараз виняток один — `/api/auth/` (Better Auth перевіряє origin сам).
- Дані на сервері — через `createServerFn` (`simplycms/storefront-routes/server/*`) чи
  route `loader`.
- Списки товарів повні в SSR-HTML: DTO `ProductListItem` (`storefront-routes/server`) +
  `SsrProductGrid`; збагачення — на сервері, не в `useEffect`.
- `head` на кожній SSR-сторінці (title, description, og:*, canonical, JSON-LD де доречно).
- Корінь (`src/routes/__root.tsx`) має `errorComponent` і `notFoundComponent`.
- **Auth** — cookie-сесії Better Auth (не localStorage JWT). Request-guard для `/admin` —
  middleware `adminRequestGuard` у `src/start.ts` (закриває первинний HTTP-запит,
  бо `beforeLoad` client-only адмінки виконується лише після гідрації); для кабінету —
  серверний `beforeLoad` роуту `_protected`. Guard-логіку за межі `src/start.ts` і
  auth-роутів не виносити.
- Конфігурація CMS — `simplycms.config.ts` (`defineConfig`: локаль, валюта, теми, плагіни) — одне
  джерело істини для `theme-registry.ts`, `bootstrapPlugins` і вшитих тем (`declareBuiltThemes`
  у `src/server.ts`). `seo` і `siteUrl` там немає (Е6б-11). Назва, заголовок головної й опис —
  профіль магазину в БД. URL сайту — серверний env `VITE_SITE_URL`. До `head()` роутів обидва
  доходять кореневим лоадером host-а (`getStorefrontRoot` → `StorefrontRootData`).
- 🔴 `src/routeTree.gen.ts` автогенерований — не редагувати.

## 3. Гідрація й клієнтський стан

- Інтерактивні частини — звичайні React-компоненти з хуками. Це Vite/TanStack Start,
  не Next.js: Server Components, `'use client'` і `next/*` тут немає.
- Стан, якого сервер не знає (localStorage: кошик), читається через
  `useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)` з порожнім
  серверним снапшотом (зразки — `react-query/useCart.tsx`, `plugins/HookRegistry.ts`).
- 🔴 `suppressHydrationWarning` лишається для елемента, чиї АТРИБУТИ законно різняться
  між SSR і клієнтом (`<html>` у `__root.tsx`: dark mode), але не рятує умовно
  ПРИСУТНІЙ вузол (бейдж лічильника) — зайвий вузол дає React #418 попри нього.
  Гейт — `react-query/__tests__/cart-hydration.test.tsx`.

## 4. Продуктивність

- Cross-request кеш серверних даних — in-memory TTL (еталон —
  `storefront/loaders/theme-record.ts`); router-рівень — `staleTime` для loader-даних
  і `router.invalidate()`.
- Зображення вітрини: `loading="lazy"` + явні розміри (проти CLS). Structured data
  (Schema.org) для товарних сторінок.
- Адмінка (`ssr: false`) не потрапляє в серверний рендер; клієнтський код сплітиться
  по роутах автоматично.
- Теми завантажуються ліниво через `ThemeRegistry.load()` — не імпортуй теми напряму.
- `resolve.dedupe` у `vite.config.ts` для `react`, `react-dom`, `@tanstack/react-query`.
- Списки понад ~50 записів — пагінація; пошук і фільтри — debounce (~300 мс,
  `SEARCH_DEBOUNCE_MS` в `ProductSearchList.tsx`, `QUOTE_DEBOUNCE_MS` у чекауті).
