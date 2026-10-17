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
| `api/` | `routes/storefront/` | server routes | `server.handlers` (health — `GET` і явний `HEAD` (Start 1.167 HEAD на GET не виводить), решта методів 405 з `Allow: GET, HEAD` через `ANY`; `auth/*` — монтування Better Auth) |
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
- 🔴 **Стеля тіла POST на server functions** — `bodyLimitMiddleware` (`simplycms/runtime/body-limit`,
  другою в `requestMiddleware` після CSRF): `Content-Length` понад `MAX_REQUEST_BODY_BYTES` → 413,
  без нього → 411 для всього, що не JSON (і для всього, що Start читає як форму;
  `UPSTREAM:START-BODY-1`). Перший рубіж — Node-раннер `server.mjs`: стеля 1 МіБ на ВСІ шляхи
  (26 МіБ лише для multipart на serverFn), лічильник байтів для chunked; міддлвара розрізняє
  server function за `handlerType`, а не за сирим шляхом.
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
- **Адреса картки товару** — `/<path>` в основній мові й `/<lower(code)>/<path>` в інших; `path` береться
  з реєстру `url_paths` (мова × шлях), а не зі slug-а товару чи розділу. Сторінку віддає роут сутності з одним параметром-сегментом
  (`routes/storefront/_storefront/$path.tsx`; не splat: `/admin/<щось>` він не перехоплює),
  тип сутності визначає реєстр. Канонічний шлях будує лише
  `productPath` (`simplycms/domain`): картка, sitemap, адмінка, `canonical` і JSON-LD беруть його звідти.
  Нормалізація (`storefront-routes/seo/normalize`) складає мову, історичну адресу, історичний `?mod=`, слеш і
  форму query (серіалізатор — той самий, що в роутера) в ОДИН 301; адреса, якої немає в реєстрі, — 404.
  Текст і адреса товару на вітрині — з проєкції `catalog_product_texts`; неперекладена версія має `noindex`,
  canonical на основну, і поза hreflang та sitemap (`storefront/seo/indexPolicy`).
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

## 5. Помилки й заголовки серверного входу (К3-Е8, Р23/Р27)

- **Непередбачені помилки не течуть клієнту.** У проді (`isProductionRuntime`)
  клієнт отримує `Internal server error [ref <id>]`, а повна помилка (через
  `redactUrls`, зі стеком і ланцюжком `cause`) пишеться в лог сервера з тим самим
  ідентифікатором. Канали: (1) server function — глобальна function-middleware в
  `createStart({ functionMiddleware })` (`src/start.ts`) ловить усе, що кидає
  `next()`, і кличе `maskUnexpectedError` (`simplycms/server-guard`); SSR-лоадери
  ходять у БД лише server functions, тож їхня помилка вже замаскована до того, як
  потрапить у стан роуту й HTML-потік (скрипт дегідрації стану роутера); (2) екран помилки
  (`src/route-error.tsx`) — і `errorComponent` кореня, і `defaultErrorComponent`
  у `getRouter()` — друкує текст лише доменної помилки з кодом або в dev, інакше
  загальну фразу й ідентифікатор (`describePublicError`, T0
  `contracts/masked-error`). Поза продом поведінка не змінюється.
- **Проходять немасковані:** уся родина `DOMAIN_ERROR_NAME` (предикат —
  членство в ній, а не перелік класів), `redirect`, `notFound`, `Response`.
  Статус відповіді server function виставляє межа операції, як і раніше.
- **Помилка поза server function** (лоадер чи `beforeLoad` кидає сам) закрита
  штатним серіалізаційним адаптером в `serializationAdapters` (`src/start.ts`):
  адаптери застосунку йдуть у дегідратацію router-core ПЕРЕД `ShallowErrorPlugin`
  (доменний — перед маскувальним), серверна половина — `createIsomorphicFn()`,
  тож server-only ядро в клієнтський бандл не потрапляє. Гейт —
  `tests/server-guard-domain-errors.test.ts` (дегідратація з реєстрації
  `createStart`).
- Статус відповіді server function при помилці виставляє межа операції
  (`setResponseStatus` до кидка, як 403/409 для доменних); без нього Start віддає
  серіалізовану помилку зі статусом за замовчуванням. Міддлвара статус не чіпає.
- **Заголовки безпеки** (`X-Content-Type-Options`, `Referrer-Policy`,
  `X-Frame-Options`, `Content-Security-Policy: frame-ancestors 'self'`,
  `Permissions-Policy`; `Strict-Transport-Security` лише коли `VITE_SITE_URL` —
  https): динаміка (SSR, server functions, `/media`, sitemap/robots) —
  `withSecurityHeaders` навколо fetch-хендлера в `src/server.ts`; статика `sirv`
  і власні 400/413/500 раннера — `server.mjs`, що ядро не імпортує й тримає копію
  переліку в `server-headers.mjs` під тестом парності
  (`tests/server-headers-parity.test.ts`). Магазин не можна вбудувати в `iframe`
  чужого origin — скіли й теми цього не роблять.

## 6. Мовний контекст запиту (Мультимовність М1, Task 9)

- **URL:** основна мова — без префікса, інші — `/<lower(code)>/…` для всіх вітринних роутів;
  `/admin`, `/api`, `/_serverFn`, `/assets`, `/media` мови не мають (`NON_STOREFRONT_SEGMENTS`).
  Мова лише з першого сегмента (`resolveRequestLocale`), без cookie й `Accept-Language`.
- **Серверний вхід** (`src/server.ts`): `withRequestContext(withSecurityHeaders(withStorefrontNormalize(…)))`.
  `withStorefrontNormalize` (`simplycms/storefront-routes/seo/normalize`, server-only) читає набір мов
  із `languagesCache` (покоління в БД), віддає ОДИН 301 (префікс основної мови, завершальний слеш) або
  404 (відома, але не опублікована мова), інакше пише `{ locales }` у `RequestContext.storefront`.
  Роутерна канонізація router-core дає лише 307 без опцій — вона лишається страховкою; тому
  інтерсептор віддає рівно той шлях, який роутер вважає канонічним (без слеша), і циклу немає.
  Task 15 дописує в ту саму функцію історію адрес і `?mod=` кроками тієї ж кінцевої адреси.
- **Роутер:** `getRouter()` кличе `createRouterLocale()`: набір мов — з контексту запиту (сервер)
  або `window.__SCMS_LOCALES__` (клієнт; скрипт у `<head>` пише кореневий роут). Набір їде в
  `router.options.context.locales`, `rewrite` (`createLocaleRewrite`) знімає префікс на вході й
  додає на виході; стан «поточна мова» — per-router (на сервері роутер на запит). До ALS ні
  лоадер, ні екрани не звертаються: ALS читається один раз, у `getRouter()`.
- **Корінь:** лоадер `loadStorefrontRoot(location.publicHref, context.locales)` повертає
  `locale` і `languages: { primary, published }`; `<html {...htmlLangAttrs(locale)}>`
  (`lang` + `dir` з `Intl.Locale.getTextInfo()`), `<I18nProvider locale fallback={primary}>`.

