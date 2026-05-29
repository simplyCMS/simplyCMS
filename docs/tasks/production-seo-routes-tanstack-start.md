# Task: Production SEO routes для TanStack Start

## Контекст

Після міграції storefront SSR-маршрутів sitemap.xml і robots.txt зараз працюють лише в dev/preview через Vite plugin на основі configureServer/configurePreviewServer. У production цей підхід не працює, бо TanStack Start обробляє запити через server entry з єдиним fetch handler, а не через Vite middleware.

Потрібно перевести SEO routes на production-ready механізм, який працює однаково в dev, preview і production, не додає інфраструктурного боргу та не ламає TanStack Start SSR flow.

Це напряму пов’язано з SSR-стратегією з BRD_SIMPLYCMS_NEXTJS.md: storefront має залишатися SEO-friendly, а non-HTML endpoints повинні віддаватися як нативні HTTP responses без React route rendering.

Ця задача замінює попередню route-level інтерпретацію sitemap.xml і robots.txt з Phase 3, де вони розглядалися як server handlers на рівні routes. Для production canonical підхід тут інший: HTTP interception у custom server entry.

## Вимоги

- [ ] Реалізувати production-ready обробку sitemap.xml і robots.txt через custom server entry TanStack Start, а не через Vite-only middleware.
- [ ] Перехоплювати запити до /sitemap.xml і /robots.txt до передачі керування стандартному TanStack Start handler.
- [ ] Зберегти існуючу бізнес-логіку генерації контенту в окремих SEO-модулях, без дублювання логіки в server entry.
- [ ] Повертати коректні Response headers для XML і plain text.
- [ ] Забезпечити однакову поведінку в dev, preview і production.
- [ ] Прибрати або вивести з runtime поточний Vite plugin під SEO routes, щоб не лишався dev-only workaround як основний механізм.
- [ ] Не додавати нових залежностей, якщо не виникне жорстко обґрунтована потреба.
- [ ] Зберегти сумісність з поточними SSR storefront routes і не змішувати SEO endpoints з React page routes.
- [ ] Використовувати canonical site URL з конфігурації або env як source of truth для sitemap і robots, не змішуючи transport-level request routing з SEO base URL політикою.

## Clarify (питання перед імплементацією)

- [ ] Чи потрібен cache-control для sitemap.xml і robots.txt вже в цій задачі?
  - Чому це важливо: без цього endpoints працюватимуть коректно, але можуть створювати зайве навантаження в production.
  - Варіанти: A — поки лише коректний Response без cache headers; B — одразу додати контрольовані cache headers для CDN/browser.
  - Вплив на рішення: performance, CDN, експлуатація.

- [ ] Чи потрібно включати в sitemap лише sections і products, чи одразу розширювати перелік на properties та інші SEO-сторінки?
  - Чому це важливо: визначає контракт sitemap builder і повноту SEO-покриття.
  - Варіанти: A — зафіксувати поточний домен sitemap; B — розширити склад URL у межах цієї ж задачі.
  - Вплив на рішення: дані, SEO, обсяг змін.

- [ ] Чи залишати fallback dev plugin тимчасово як safety net, чи повністю прибирати після переходу на custom server entry?
  - Чому це важливо: паралельні механізми ускладнюють супровід і маскують помилки середовища.
  - Варіанти: A — повністю прибрати plugin після переводу; B — тимчасово лишити лише якщо є чітко задокументована причина.
  - Вплив на рішення: архітектура, підтримка, технічний борг.

## Рекомендовані патерни

### Custom server entry як єдина точка HTTP interception

Використати власний server entry для TanStack Start, який отримує всі HTTP-запити та першим перевіряє pathname. Для /sitemap.xml і /robots.txt він формує нативний Response, а для всіх інших URL делегує запит стандартному createStartHandler(defaultStreamHandler).

- Де шукати приклад: TanStack Start default server entry в node_modules/@tanstack/react-start/src/default-entry/server.ts
- Де застосовувати в проекті: src/server.ts, vite.config.ts, src/seo/

### SEO builders як чисті окремі модулі

Логіка побудови XML і robots має залишатися в окремих модулях, а server entry має лише маршрутизувати HTTP-запит і формувати Response. Це зберігає розділення відповідальності: business/data logic окремо, transport layer окремо.

- Де шукати приклад: src/seo/sitemap.ts, src/seo/robots.ts

### Pre-routing до React/router pipeline

SEO endpoints треба віддавати до того, як запит потрапляє в TanStack Start route rendering. Це гарантує, що sitemap.xml і robots.txt не проходять через HTML SSR pipeline, не залежать від React routes і не потребують route-level hacks.

- Де шукати приклад: дослідження flow createStartHandler у node_modules/@tanstack/start-server-core/dist/esm/createStartHandler.js

### Нативні Web Response для non-HTML endpoints

Для sitemap.xml і robots.txt повертати звичайний Response з коректним content-type. Це відповідає runtime-моделі TanStack Start і не вимагає окремих API routes або сторонніх бібліотек.

- Де шукати приклад: TanStack Start server entry contract і createServerFn типи, що допускають Response

### Мінімальний transport layer у server entry

Server entry не повинен містити SQL, Supabase queries або SEO-бізнес-логіку. Його роль: розпізнати endpoint, викликати відповідний builder, встановити заголовки, делегувати все інше стандартному handler.

- Де шукати приклад: src/seo/sitemap.ts, src/seo/robots.ts, src/server/products.ts як орієнтир на розділення data layer і orchestration

## Антипатерни (уникати)

### ❌ Залишати Vite plugin як production-рішення

configureServer і configurePreviewServer не є production transport layer. Якщо покластися на них як на основний механізм, SEO routes працюватимуть лише локально та в preview, але зламаються в production runtime.

### ❌ Реалізовувати sitemap.xml через React page route

Це non-HTML endpoint. Якщо проводити його через стандартний route rendering, з’являється неправильний abstraction layer, ризик HTML wrapping і заплутування відповідальностей між SSR pages і raw HTTP responses.

### ❌ Використовувати createServerFn як основний URL-механізм для sitemap.xml

Хоча createServerFn може повертати Response, він працює через RPC endpoint server functions, а не через canonical URL виду /sitemap.xml. Це підходить для internal transport, але не для публічного SEO endpoint.

### ❌ Дублювати генерацію sitemap/robots в кількох місцях

Не можна мати окрему реалізацію для dev plugin і окрему для production server entry. Має бути один набір builder-функцій і один production-aligned transport mechanism.

### ❌ Покладатися на built-in pages.sitemap для динамічного storefront каталогу

Built-in sitemap config TanStack Start орієнтований на static/prerendered pages і не вирішує задачу динамічного sitemap з даними з БД.

### ❌ Додавати зовнішній reverse proxy як перший крок без потреби

Nginx/Cloudflare worker або інший проксі може вирішити задачу, але це створює зайву зовнішню залежність. Поки TanStack Start вже підтримує custom server entry, логіку слід тримати в застосунку.

### ❌ Змішувати SEO endpoint orchestration з data-fetching деталями

Server entry не повинен знати, як саме працює Supabase query, структура sitemap чи fallback rules. Інакше endpoint layer стає важким для тестування і підтримки.

## Архітектурні рішення

- В який пакет додавати код: site-level runtime в src/server.ts; SEO builders залишаються в src/seo/; конфігурація підключення в vite.config.ts
- Rendering стратегія: Mixed
- Міграція з temp/: не застосовується
- Додаткові залежності: не потрібні; рішення реалізовується штатними можливостями TanStack Start і Web Response API
- Source of truth для base URL: canonical site URL з конфігурації або env; request host не повинен неявно змінювати SEO-адреси без окремого погодженого правила
- Основне рішення: custom server entry поверх createStartHandler(defaultStreamHandler)
- Відхилені альтернативи: Vite-only middleware як production шлях; createServerFn як canonical public endpoint; external reverse proxy без реальної потреби

## MCP Servers (за потреби)

- context7 — для перевірки актуального TanStack Start server entry API, createStartHandler, defaultStreamHandler
- supabase — якщо в межах задачі буде розширюватися склад sitemap на додаткові сутності або перевірятися структура таблиць

## Пов'язана документація

- BRD_SIMPLYCMS_NEXTJS.md секція 9 — SSR стратегія, SEO та серверний rendering storefront
- .github/instructions/architecture-core.instructions.md — SSR-first storefront, theme system, route strategy
- .github/instructions/data-access.instructions.md — правила data access для storefront і Supabase wrappers
- .github/instructions/tooling.instructions.md — команди перевірки build/typecheck
- docs/tasks/migration-phase3-storefront-ssr-routes.md — базова SSR-модель storefront routes і поточний контекст міграції
- docs/tasks/migration-phase3-storefront-ssr-routes.md — попередня постановка, яку ця задача уточнює для production SEO endpoints
- src/seo/sitemap.ts — поточний sitemap builder
- src/seo/robots.ts — поточний robots builder
- src/seo/plugin.ts — dev/preview workaround, який має бути замінений або прибраний
- vite.config.ts — поточне підключення SEO plugin і місце для переходу на server entry конфігурацію

## Definition of Done

- [ ] Створено або підключено custom server entry для TanStack Start, який обробляє /sitemap.xml і /robots.txt до стандартного SSR handler
- [ ] sitemap.xml і robots.txt повертаються як нативні Response з коректними content-type
- [ ] Поточні builder-функції SEO перевикористовуються без дублювання логіки
- [ ] Dev, preview і production використовують один і той самий transport pattern для SEO endpoints
- [ ] Vite plugin workaround для SEO routes прибрано або чітко виведено з основного runtime path
- [ ] Не додано зайвих сторонніх залежностей
- [ ] Звичайні storefront SSR routes продовжують працювати без регресій
- [ ] pnpm build проходить
- [ ] pnpm typecheck проходить
- [ ] Ручна перевірка підтверджує коректні відповіді для /sitemap.xml і /robots.txt у локальному production-like сценарії без опори на src/seo/plugin.ts як runtime-механізм
