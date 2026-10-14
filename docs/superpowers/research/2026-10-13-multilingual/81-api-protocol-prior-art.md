# Протокол API та командний шар для SimplyCMS: прецеденти (prior art)

Дата: 2026-10-14. Лише читання репозиторіїв; нічого в коді не змінено.
Попереднє дослідження: `20-api-integrations.md` (знімок `cd2d18d5`) — не повторюю його фактів, а посилаюся (§ у ньому).
Позначки: **[підтв.]** — прочитано у первинному джерелі (URL у тексті/§8); **[не підтв.]** — не знайшов первинного джерела або сторінка не відповіла; **[висновок]** — мій висновок, не твердження джерела.
Версії пакетів — з реєстру npm на 2026-10-14 (`registry.npmjs.org`), дата — дата публікації версії.

---

## 0. Короткий підсумок

1. **Жодна платформа не розв'язує всі чотири задачі одним механізмом.** Часткове оновлення однієї локалі + «outdated» разом є лише у Shopify (окремий ресурс перекладу + `translatableContentDigest` + `outdated`), частковий merge по локалі — в Akeneo, bulk-переклад — у Saleor. commercetools — заміна всієї мапи `LocalizedString` (+`version`). [підтв.] Наша модель OpenCart (рядок на мову + позначка джерела + `source_hash`) за семантикою найближча до Shopify, а не до мап-в-полі.
2. **`source_hash` ≈ Shopify `digest` — але є два відмінні наслідки.** (а) У Shopify digest є *вхідним обов'язковим* параметром запису перекладу («Each translation requires a digest…»): запис проти застарілого оригіналу формально неможливий без нового читання. (б) `outdated` — похідне від зміни оригіналу після запису перекладу. Для API це означає: переклад пишеться як «переклад *версії оригіналу H*», а не «переклад поля». [підтв. для Shopify, API 2026-10]
3. **TanStack Start: serverFn і HTTP не поєднуються з одного визначення «безкоштовно».** Документація: server functions «meant to be called by your TanStack Start application», для зовнішніх викликів — server routes; ID серверної функції — згенерований SHA-256 хеш, стабільність між збірками — лише за детермінованими входами [підтв.]. Спільне — лише **request middleware** (працює і в routes, і в serverFn); server-function middleware — тільки для serverFn [підтв.]. Отже єдине визначення операції мусить жити *нижче* обох транспортів (наш власний шар, або oRPC).
4. **Зрілість командного шару (npm, 2026-10-14):** `oRPC` 1.15.6 (12.10.2026, активний, MIT) — єдиний кандидат із готовим набором «контракт → HTTP/OpenAPI → серверний клієнт → TanStack Query → AI SDK tools»; `ts-rest` 3.52.1 — останній реліз **2025-03-04**, peer `zod ^3.22.3` → практично не підходить для Zod 4 [підтв. npm]; `trpc-openapi` — **архівований** (19.11.2024, «not having maintainers», tRPC v10, Zod v3), заміна — спільнотний `trpc-to-openapi` 3.3.0 (22.05.2026, peer `zod ^3.25 || ^4`); `Effect HttpApi` — у v4 лежить у `effect/http-api`, сторінка має мітку «unstable» на кожному експорті [підтв.].
5. **MCP-інструменти з однієї схеми — це JSON Schema 2020-12 за замовчуванням** (поточна специфікація MCP `2026-07-28`) [підтв.], а `z.toJSONSchema()` у Zod 4 також дефолтить на Draft 2020-12 → Zod-схема операції природно дає і OpenAPI 3.1-компоненти, і `inputSchema`/`outputSchema` MCP-інструмента без третього джерела правди. Готового пакета «oRPC → MCP» у списку пакетів репозиторію oRPC **немає** (є `@orpc/ai-sdk` для AI SDK, MCP не згадано) [підтв. README]; для MCP потрібен власний тонкий адаптер над `@modelcontextprotocol/sdk` 1.32.1.
6. **Скоуп (зміна власника):** 1С-обмін (CommerceML, модулі) з дослідження виключено; 1С для API — лише один із клієнтів: масовий upsert за `id`, одна мова на запит, перейменування. Звільнене місце віддано протоколу й командному шару (§2–3, §5).
7. **Рекомендація (коротко):** модель «команди» (іменовані операції з Zod-схемами) як ядро; HTTP-адаптер — REST-подібні ресурси для CRUD/upsert/зміни + командні ендпоінти для іменованих операцій, OpenAPI 3.1 із схем; CLI/MCP — окремі тонкі адаптери над тим самим реєстром. Два варіанти реалізації реєстру — власний мінімальний або oRPC (§6). Рішення архітектора — §6.

---

## 1. Як e-commerce API передають перекладні поля (доповнення до `20-api-integrations.md` §2)

У `20-…` §2 фактури вже зібрано (commercetools, Shopify, Saleor, Medusa, Akeneo, Sylius, Shopware). Тут — лише те, що додано/перевірено цього разу, і зведена оцінка за *чотирма критеріями цього завдання*.

### 1.1. Нові/перевірені факти

| Платформа | Факт | Джерело |
|---|---|---|
| Shopify | `translationsRegister(resourceId, translations:[TranslationInput!]!)`; поле `translatableContentDigest` «required»: «supply the digest of the source content… from the `translatableResource` query»; для метаполів — `compareDigest`; scope `write_translations`; сторінка показує API **2026-10**; ліміту кількості в одному виклику не названо | https://shopify.dev/docs/api/admin-graphql/latest/mutations/translationsRegister |
| Shopify | `translatableContent{key,value,digest,locale}`; `translations(locale, marketId, outdated)`; `outdated` — «чи змінився оригінал після останнього оновлення перекладу»; digest — «хеш, потрібний при реєстрації перекладу» (алгоритм хешування сторінка не називає) | https://shopify.dev/docs/api/admin-graphql/latest/queries/translatableResource |
| Medusa v2 | Модуль Translation **експериментальний**: «behind a feature flag», вимагає ≥ v2.12.3; запис `{reference_id, reference, locale_code, translations:{поле:текст}}`; admin REST-маршрутів/batch на сторінці немає (керування — через дашборд) | https://docs.medusajs.com/resources/commerce-modules/translation |
| PrestaShop | Webservice: пагінація `limit=offset,count`, фільтри `filter[field]=[…]`, `sort=[field_ASC]`, `display=full|[полів]`; сторінки про мультимовні поля за очікуваними адресами повернули 404 → **як саме передаються `language`-масиви і чи потрібен повний набір мов при PUT — не підтверджено** | https://devdocs.prestashop-project.org/9/webservice/tutorials/advanced-use/additional-list-parameters/ ; мовна сторінка [не підтв.] |
| commercetools, Saleor, Akeneo, Sylius, Shopware, Payload | без змін проти `20-…` §2 (мапа `LocalizedString` заміщується цілком; `productTranslate`/`productBulkTranslate`; PATCH по парі `locale/scope`; `translations:{en_US:{…}}`; `sw-language-id` + `translated.*`) | див. `20-…` §11 |

### 1.2. Зведена оцінка за критеріями цього завдання

Позначки: ◎ добре · ○ можливо з доробкою · ✕ слабке місце · ? немає даних. Це **[висновок]** з фактів вище та `20-…`.

| Платформа | Часткове оновлення (одна локаль, інші не чіпає) | «Імпорт однією мовою» (джерело) | Перейменування джерела | Позначка застарілості |
|---|---|---|---|---|
| commercetools | ✕ мапа заміщується цілком; захист — `version` ресурсу (ConcurrentModification) | ○ імпорт `key`-upsert, але мапа з однією локаллю **стирає** решту, якщо не злити на клієнті | ○ `changeSlug` → Message `ProductSlugChanged` (подія, не редирект) | ✕ немає |
| Shopify | ◎ запис за `(resource, locale, key)` | ◎ база = сам ресурс (мова магазину), переклади окремо | ◎ `redirectNewHandle` — явна опція; переклади лишаються, стають `outdated` | ◎ `digest` + `outdated` |
| Saleor | ◎ `productTranslate(id, languageCode, input)` | ◎ базові поля + окремий переклад | ○ slug перекладається окремо; редиректів не знайдено [за `20-…`] | ✕ немає (вебхук `PRODUCT_UPDATED` → свій сервіс) |
| Akeneo | ◎ merge по `locale/scope`, `data:null` стирає | ◎ PIM між 1С і магазином | ? | ○ лише completeness |
| Sylius (API Platform) | ◎ ключ локалі в мапі `translations` + під-ресурс `/translations/{locale}` | ○ | ? | ? |
| Shopware 6 | ◎ за iso-кодом / language-id; формальний пріоритет (ADR 2022-03-29) | ○ | ? | ✕ |
| Medusa v2 | ◎ рядок на `(reference, locale)` | ○ | ? | ? (експериментально) |
| PrestaShop | ? [не підтв.] | ? | ? | ✕ [не знайдено] |

**Урок для нас [висновок]:** найближчий аналог — Shopify, і саме його три рішення слід переймати свідомо: (1) переклад — окремий ресурс/операція, а не поле мапи; (2) запис перекладу прив'язаний до хеша оригіналу; (3) `redirect` — явна опція перейменування. Слабке місце всіх «мап у полі» (commercetools, Payload) — немає місця для `source_hash` та `updated_at` на рівні мови.

---

## 2. Стиль протоколу

### 2.1. Первинні факти по стандартах/практиках

| Тема | Факт | Джерело |
|---|---|---|
| Idempotency-Key | IETF draft `draft-ietf-httpapi-idempotency-key-header-07`; статус **Expired I-D** (оновлено 2026-04-18, остання ревізія 2025-10-15), RFC не присвоєно. Вимоги: Structured Field **String**; ключ унікальний і **не** повторюється з іншим payload; дубль після завершення — повернути результат оригіналу (успіх чи помилку); дубль «in flight» — **409**; той самий ключ з іншим payload — **422**; відсутній обов'язковий ключ — **400**; політика закінчення ключів має бути опублікована | https://datatracker.ietf.org/doc/draft-ietf-httpapi-idempotency-key-header/ ; текст https://www.ietf.org/archive/id/draft-ietf-httpapi-idempotency-key-header-07.txt |
| Idempotency у Stripe (практика) | ключ до 255 символів; для API v1 зберігається статус+тіло першого виконання **включно з 500**; ключі можна прибирати після ≥24 год; параметри порівнюються з оригіналом і розбіжність — помилка; результат не зберігається, якщо запит не дійшов до виконання (валідація/конкурентний конфлікт) → такі запити можна повторювати | https://docs.stripe.com/api/idempotent_requests |
| Problem Details | RFC 9457 (2023, Proposed Standard, obsoletes RFC 7807), `application/problem+json`, члени `type,title,status,detail,instance` | https://www.rfc-editor.org/rfc/rfc9457 |
| Вебхуки з підписом | Standard Webhooks: заголовки `webhook-id`, `webhook-timestamp` (unix секунди), `webhook-signature` (`v1,<base64>` — HMAC-SHA256, `v1a` — ed25519; кілька підписів через пробіл для ротації ключа); перевіряти допуск за часом (replay) і використовувати `webhook-id` як ключ дедуплікації; ретраї з експоненційною затримкою на кілька днів + jitter, поважати `retry-after` | https://github.com/standard-webhooks/standard-webhooks/blob/main/spec/standard-webhooks.md |
| JSON:API | поточна 1.1 (стабільна), `application/vnd.api+json`, sparse fieldsets `fields[TYPE]`; **профілю cursor-пагінації сторінка не визначає** (лише резервує `page[...]`); Atomic Operations на сторінці формату не описано (лише як приклад URI розширення) | https://jsonapi.org/format/ |
| ETag / `If-Match` для версій рядків | RFC 9110 (умовні запити) — первинне джерело мною **не відкривалося** [не підтв. у цій сесії]; практика конкурентного захисту у commercetools — `version` у тілі, `ConcurrentModification` [за `20-…` §2.2] | — |
| Keyset-пагінація, changes feed | commercetools радить для повного обходу сортувати за `id` і фільтрувати `id>`, `offset ≤ 10000`; Akeneo має фільтр `updated`; Saleor — `updatedAt: DateTimeRangeInput` [за `20-…`]. Окремого стандарту «changes feed» для REST-комерції не знайшов [не підтв.] | `20-…` §2 |
| Версіонування | Shopify — версія в URL (`2026-10`) і календарний цикл [підтв. на сторінці мутації]; Stripe — v1/v2 у URL [підтв. посилання зі сторінки ідемпотентності] | shopify.dev, docs.stripe.com |

### 2.2. Порівняння стилів для нашого набору споживачів

Споживачі: 1С/облікові системи як звичайний клієнт (масовий upsert за id, ціни, залишки), адмінка (типізований клієнт), CLI, MCP для AI-агентів, плагін-перекладач.

| Критерій | REST + OpenAPI 3.1 (ресурси + командні ендпоінти) | RPC/команди (`POST /api/v1/<operation>`, JSON; oRPC-стиль) | GraphQL | JSON:API |
|---|---|---|---|---|
| 1С (HTTP-сервіси/скрипти, CSV/JSON-пакети) | ◎ прості URL, кеш/ETag/статуси | ○ працює, але менш «звично» для інтеграторів | ✕ складно для 1С-розробників [висновок] | ○ |
| Bulk / async jobs | ◎ `POST /imports` → 202 + job-ресурс | ◎ команда `import.start` + job | ○ Shopify робить це окремим `bulkOperationRunMutation` JSONL ≤100 МБ [за `20-…`] | ○ Atomic Operations — розширення (не вивчав) |
| Часткові оновлення, upsert за id | ◎ `PUT/PATCH /products/{id}` (id від клієнта природно ідемпотентний) | ◎ `products.upsert({id,…})` | ○ `productSet` у Shopify | ○ |
| Генерація MCP-інструментів | ○ OpenAPI → інструменти (1 операція = 1 інструмент) — потрібне ручне зрізання, бо «ресурсна» граніцість погана для LLM | ◎ операція = інструмент, схема вже input/output | ○ мутації як інструменти, схема об'ємна | ✕ |
| Генерація CLI | ◎ з OpenAPI | ◎ з реєстру | ○ | ○ |
| Типізований клієнт адмінки | ○ згенерований із OpenAPI | ◎ спільні типи (якщо командний шар TS) | ○ codegen | ○ |
| Кешування/ETag/CDN | ◎ вбудоване в HTTP | ✕ POST-орієнтовано | ✕ | ◎ |
| Ризик «подвійного» опису | помірний (OpenAPI виводиться зі схем) | низький | високий (SDL окремо) | помірний |
| Відповідність нашому стеку (Zod 4, serverFn) | ◎ | ◎ | ✕ нова runtime-залежність | ✕ |

**[висновок]**: GraphQL і JSON:API не дають переваг для цього набору споживачів і додають третє представлення схеми. Реальний вибір — між **P-A: REST+OpenAPI 3.1 з командними ендпоінтами** і **P-B: чисто командний RPC**; практично їх можна зводити в один реєстр і публікувати обидва вигляди (деталі — §5).

---

## 3. Один командний шар для всіх каналів

### 3.1. Що кажуть документи TanStack Start (первинні)

- Server functions: «meant to be called by your TanStack Start application»; «If you need an endpoint that can be called from outside your Start app, use server routes instead»; адресуються «generated, stable function ID» (SHA-256 за замовчуванням, дублікати отримують числовий суфікс; для стабільності між збірками — детерміновані входи filename+functionName; власна генерація ID — «experimental and subject to change») → https://tanstack.com/start/latest/docs/framework/react/guide/server-functions [підтв.]
- Server routes: `createFileRoute(...)({ server: { middleware: [...], handlers: { GET, POST, PUT, PATCH, DELETE } } })`; handlers — об'єкт або функція `createHandlers` (middleware на метод) → https://tanstack.com/start/latest/docs/framework/react/guide/server-routes [підтв.]
- Middleware: request middleware («any server request», тільки `.server()`) діє і в routes, і в serverFn; server-function middleware (`.client()`, `.validator()`) — лише serverFn; «Request middleware cannot depend on server function middleware» → https://tanstack.com/start/latest/docs/framework/react/guide/middleware [підтв.]
- Поточна версія `@tanstack/react-start` — 1.169.1 (13.10.2026) [npm].
- **З одного визначення і serverFn, і HTTP route** документація не пропонує; прямого механізму «експортуй цей serverFn як HTTP» не знайдено [не підтв. як відсутність]. Практичний патерн — спільна функція-обробник нижче обох транспортів + два тонкі адаптери [висновок]. У `20-…` §1.4 це вже було висновком: основа — ядра `*In(db,input)`.
- Специфіка нашого репо (з `20-…` §1.2): дерево роутів збирає `routes.ts`, API-роути постачає пакет ядра; `csrfMiddleware` відкидає POST/PUT/PATCH/DELETE без same-origin, виняток лише `/api/auth/` → потрібен свідомий виняток для `/api/v1/` з власною автентифікацією.

### 3.2. Зрілість кандидатів (версії з реєстру npm 14.10.2026)

| Кандидат | Версія / дата | Zod 4 | OpenAPI | Стрімінг | Файли | MCP/CLI | Зауваження / ризик |
|---|---|---|---|---|---|---|---|
| **oRPC** (`@orpc/*`, repo middleapi/orpc) | 1.15.6 / 12.10.2026, MIT | `@orpc/zod` peer `zod >=3.25.0`; без `@orpc/zod` — fallback на Standard JSON Schema [підтв. docs]; **явне «Zod 4 supported» на прочитаних сторінках не знайшов** | `OpenAPIGenerator`; за замовчуванням документ будується як **3.2.0**, `version` приймає 3.0.x/3.1.x/3.2.x, старі версії — «downgrade, що видаляє нездатне виразитися» [підтв. docs]; `OpenAPIHandler` віддає REST-маршрути; без `.route` процедура = `POST` | типізований SSE (таблиця порівняння) [підтв.] | типізований File/Blob [підтв.]; `@orpc/node` — великі завантаження | `@orpc/ai-sdk` (контракт → AI SDK tool, потрібен AI SDK ≥7) [підтв.]; **пакета MCP у README немає** | Інтеграція з TanStack Start описана: server route `api/rpc.$.ts` + `createRouterClient` для SSR без HTTP [підтв.]; пільга/ризик: один основний мейнтейнер-організація (sponsors-модель) [висновок] |
| **ts-rest** | 3.52.1 / **04.03.2025** | peer `zod ^3.22.3` → Zod 4 не заявлено | є (`@ts-rest/open-api`) | ? | ? | — | Останній реліз > 18 міс. тому; на головній GitHub-сторінці 3.3k ★, 110 open issues, TanStack Start не згадано [підтв.] → **ризик занедбаності** |
| **tRPC + OpenAPI** | `@trpc/server` 11.19.0 / 16.09.2026; `trpc-openapi` **архівовано** (19.11.2024, tRPC v10, Zod v3); `trpc-to-openapi` 3.3.0 / 22.05.2026, peer `zod ^3.25 \|\| ^4`, `@trpc/server ^11.1` | через `trpc-to-openapi` — так | через сторонній форк (не tRPC-team) | SSE/streaming у tRPC є (таблиця oRPC: ✅) | 🟡 | — | OpenAPI-шар живе поза проєктом tRPC, мейнтейнер змінювався [підтв.] |
| **Hono + `@hono/zod-openapi`** | hono 4.13.13 (04.10.2026); `@hono/zod-openapi` 1.6.3 (04.09.2026), peer `zod ^4.0.0`; `@hono/mcp` 0.3.2 (18.08.2026), peer zod 3.25/4 | так (peer ^4) | `app.doc()` (довільний рядок версії, приклад 3.0.0) і `app.doc31()`/`getOpenAPI31Document()` → **OpenAPI 3.1** [підтв.] | SSE — у таблиці oRPC «🛑 для typesafe SSE» | 🟡 | `@hono/mcp`: `StreamableHTTPTransport` для MCP [підтв.] | Додає другий HTTP-фреймворк усередині server route (catch-all); клієнт адмінки — окрема робота [висновок] |
| **Effect `HttpApi`** | `effect` 4.0.4 / 13.10.2026 (v4.0.0 — 01.10.2026); модуль `effect/http-api`, позначено **unstable** [підтв.]; `@effect/openapi-generator` 4.0.4 (зворотний напрям: OpenAPI → Effect) | власна Effect Schema, не Zod | `OpenApi.fromApi` → OpenAPI **3.1** [підтв. через пошук docs v4] | так (Effect) | ? | — | Вимагає перейти на Effect-стек; суперечить Zod-інваріантам репо [висновок] — відкинуто |
| **Encore.ts** | не встановлював; docs: потрібен `encore` CLI; OpenAPI-клієнт — `encore gen client --lang=openapi`, позначено **experimental** | схеми виводяться з TS-типів, не Zod | experimental | ? | ? | — | Власний рантайм/CLI, платформний lock-in; на TanStack Start сторінка не згадує [підтв. як відсутність згадки] — відкинуто |
| **Власний мінімальний реєстр** (Zod 4 + `z.toJSONSchema`) | `zod` 4.6.7 / 12.10.2026 | native | `z.toJSONSchema(target: draft-2020-12 \| draft-07 \| openapi-3.0)`, метадані через registries; **для 3.1 потрібно самим зібрати «paths»** (або взяти `@asteasolutions/zod-to-openapi` 9.1.0 peer zod ^4 / `zod-openapi` 6.0.2 peer zod ^4) [підтв. npm + zod.dev] | довільне | довільне | MCP через `@modelcontextprotocol/sdk` 1.32.1 (peer zod 3.25/4) | Найменший lock-in; всю «клейку» пишемо й підтримуємо самі |

Примітка про `Unrepresentable`: `z.toJSONSchema` **кидає** на `bigint/date/map` за замовчуванням (`unrepresentable:"any"` дає `{}`) [підтв. zod.dev] — важливо, бо наші внутрішні `Date` мають мати JSON-представлення на межі (див. `20-…` §1.4: seroval vs JSON ISO).

### 3.3. Що значить «MCP з тієї ж схеми» за специфікацією MCP (редакція 2026-07-28)

[підтв., https://modelcontextprotocol.io/specification/latest/server/tools]
- Інструмент: `name` (1–128 символів, `A-Za-z0-9_-.`), `title`, `description`, `inputSchema` (JSON Schema, за замовчуванням **2020-12**), опційний `outputSchema`, `annotations` (поведінкові; клієнт має вважати їх недовіреними).
- Результат: `content[]` (+ `structuredContent`, що має відповідати `outputSchema`; для зворотної сумісності серіалізований JSON дублюється в text-блоці); помилки валідації/бізнес-логіки — `isError:true` у результаті (щоб модель могла виправитися), протокольні — JSON-RPC помилки.
- Набір інструментів **може залежати від наданої авторизації** (скоупи) — але не від з'єднання.
- `tools/list` підтримує пагінацію й кешування; детермінований порядок — SHOULD.
- Інструмент має бути «дрібнішим за ресурс»: стан між викликами передається явним handle, а не сесією (розділ Stateful Tools).
**[висновок]** Для MCP потрібен *інший гранулярний зріз*, ніж для REST: `products.rename`, `translations.set`, `translations.list_outdated`, `catalog.import_batch` — «команди», не CRUD-ресурси. Це аргумент за реєстр команд як першоджерело, з якого REST-адаптер *виводить* ресурсні маршрути (а не навпаки).

---

## 4. Протокол для мультимовних даних: чого вчимося у Shopify-digest і що це дає нашій моделі

Модель власника: тексти кожної мови — рядки `<entity>_translations`; є позначений рядок мови-джерела; `source_hash` — хеш джерела, з яким узгоджений переклад. Нижче — **вимоги до протоколу, що випливають з прецедентів** [висновок на основі §1]:

1. **Читання.** Два представлення (як Shopware `name` vs `translated.name`): *збережене* (рядок конкретної мови, `null`/відсутній, якщо немає) і *розв'язане* (з фолбеком на мову-джерело, з прапорцем `fallback:true`). Запит `locale=uk` / `locale=all` (мапа локаль→збережене). Кожен рядок перекладу віддає `{locale, fields…, sourceHash, outdated, updatedAt}`; `outdated` — обчислюване (`sourceHash` перекладу ≠ хеш поточного джерела), як у Shopify фільтр `translations(outdated:true)` [за `20-…` §4].
2. **Запис джерела (1С, адмінка).** Окрема операція «записати рядок мови-джерела» (upsert за `entity.id`, `locale` = джерельна мова магазину); вона **не торкається** рядків інших мов (на відміну від commercetools-мапи) і як побічний результат змінює `source_hash` → усі переклади стають `outdated` без жодного запису в них. Для 1С — це єдиний мовний виклик.
3. **Запис перекладу (адмінка, плагін-перекладач, CLI, MCP).** Операція `translations.set(entityId, locale, fields, expectedSourceHash)` — аналог Shopify `translationsRegister` із digest: якщо `expectedSourceHash` ≠ поточному — відмова типу `stale_source` (409), клієнт перечитує джерело й повторює. Це закриває гонку «перекладач переклав стару версію, поки менеджер правив джерело». Гранулярність хеша — **рядок** (за вашою моделлю) vs **поле** (Shopify: digest на ключ `title`, `body_html`…) — питання архітектору (див. §6, Q3): рядковий хеш простіший, але зміна `description` позначає застарілим і переклад `name`.
4. **Часткове оновлення.** Переклад — PATCH-семантика «передані поля змінюються, відсутні — ні, `null` — стирає» (Akeneo), на рівні рядка локалі; не заміна цілої мапи.
5. **Перейменування.** Окрема команда `…rename` / `…changeSlug` з опцією `redirect:true` (Shopify `redirectNewHandle`) — зміна назви джерела і зміна slug мають бути різними подіями (інакше виправлення опечатки в 1С ламає URL; див. `20-…` §5.2).
6. **Масові операції.** Пакет мовних записів — з `errorPolicy` (Saleor `productBulkTranslate(errorPolicy)`) і результатом *по рядках*; Akeneo-подібне JSON-lines з відповіддю по рядках. Конкретні ліміти платформ: Akeneo ≤100 елементів/запит [за `20-…`], commercetools Import ≤20 [за `20-…`], Shopify bulk ≤100 МБ JSONL [за `20-…`]; лімітів `translationsRegister` Shopify не називає [підтв.].
7. **Каталог мов і мова-джерело — частина контракту.** Операції приймають `locale` як BCP 47 з реєстру `languages` магазину; відсутня мова → типізована помилка `unknown_locale`; «мова за замовчуванням» не має мати двох джерел істини (`20-…` §9.1 п.4).

---

## 5. Конкурентні варіанти (2–3) для рішення архітектора

### Варіант 1. Власний реєстр команд (Zod 4) + власні адаптери — «мінімальний lock-in»

- **Суть.** Одна структура `defineOperation({name, input: Zod, output: Zod, authz: <операція AUTHZ_MATRIX>, kind: 'read'|'write', idempotent, handler(ctx, input)})`; реєстр операцій. Адаптери: (а) серверна функція для адмінки (`createServerFn` у єдиному диспетчері, або по одному на операцію, генеровано), (б) server route `/api/v1/*` (Bearer, Idempotency-Key, problem+json), (в) OpenAPI 3.1 документ (з `z.toJSONSchema` або `@asteasolutions/zod-to-openapi` 9.1.0 / `zod-openapi` 6.0.2), (г) CLI (з реєстру), (д) MCP через `@modelcontextprotocol/sdk` 1.32.1.
- **Сильне.** Максимум відповідності репо (Zod 4, `withActor`, `CoreActor`, `AdminConflictError`); немає залежності від чужого фреймворку; MCP — тонкий, скоупи можна зрізати за `tools/list` на рівні токена; тип клієнта адмінки — спільні TS-типи реєстру.
- **Слабке.** Все «клеївся» (маршрути, парсинг query/body, помилки, SSE, файли, OpenAPI paths, CLI-парсер, типізований клієнт) пишемо й тестуємо самі; ризик «ще один мікрофреймворк у репо».
- **Ризики.** Власний OpenAPI-обробник відстає від стандартів; зворотна сумісність схем потребує дисципліни (див. правило мажорної версії в `AGENTS.md`).

### Варіант 2. oRPC як командний шар

- **Суть.** Процедури/контракти oRPC у ядрі; `OpenAPIHandler` (REST-маршрути й OpenAPI) і/або `RPCHandler` змонтовано в server route; адмінка — серверний клієнт `createRouterClient` (SSR без HTTP) + `RPCLink` у браузері + `@orpc/tanstack-query`; плагіни — `@orpc/ai-sdk` для AI-інструментів; MCP — власний адаптер (готового немає).
- **Сильне.** Усе, що в Варіанті 1 доводиться писати, вже є: контракт-first, middleware/контекст, OpenAPI 3.0–3.2, типізований SSE і File/Blob, інтеграція з TanStack Start і TanStack Query, інтеграція з tRPC [підтв.]. Активний (реліз 12.10.2026).
- **Слабке.** Нова центральна залежність у ядрі, яка *замінює* `createServerFn` для адмінки (≈125 функцій переписуються в цій хвилі — шанс, але і ціна міграції); дефолтний вихід OpenAPI — 3.2 з даунґрейдом (треба зафіксувати 3.1 і перевірити споживачів); `Zod 4`-статус не підтверджено явним текстом [не підтв.] — перевірити тестом на нашому наборі схем; `AUTHZ_MATRIX`/`CoreActor` треба вмонтувати як oRPC-контекст.
- **Ризики.** Vendor lock середній (контракти — на Standard Schema/Zod, тобто переносні; обробники й middleware — ні); залежність від одного мейнтейнера (спонсорська модель, [висновок]); ітерації мажорних версій oRPC ламають (поточна 1.15.x; мажорність зламів не вивчав).

### Варіант 3. Гібрид «Hono + zod-openapi (+ `@hono/mcp`) усередині server route»

- **Суть.** Один catch-all server route віддає Hono-застосунок; маршрути — `createRoute` + `app.openapi` (3.1 через `doc31`), MCP — `StreamableHTTPTransport` з `@hono/mcp`; адмінка лишається на `createServerFn`, що викликає ті самі ядра.
- **Сильне.** OpenAPI 3.1 «з коробки», Zod 4 (peer ^4), зрілий HTTP-фреймворк, готовий MCP-транспорт.
- **Слабке.** **Два** шари визначення (serverFn адмінки окремо від HTTP-маршрутів) → якраз той дубль, який завдання хоче усунути; типізованого клієнта адмінки з тієї ж схеми немає (клієнт Hono — окремо, не вивчав); другий HTTP-фреймворк у збірці.
- **Ризик.** Розходження схем між serverFn і Hono-маршрутами; вигода лише для зовнішнього API.

### Порівняння варіантів

| Критерій | В1 власний | В2 oRPC | В3 Hono-гібрид |
|---|---|---|---|
| Єдине визначення для адмінки+HTTP+CLI+MCP | ◎ | ◎ (MCP — адаптер) | ✕ (адмінка окремо) |
| Обсяг власного коду «клею» | великий | малий | середній |
| Zod 4 підтверджено | ◎ | ○ [не підтв. явно] | ◎ |
| OpenAPI 3.1 | ○ (збирати paths) | ◎/○ (3.2 → downgrade 3.1) | ◎ |
| Стрімінг/файли | своє | ◎ | ○ |
| Lock-in | мінімальний | середній | низький |
| Ризик занедбання залежності | немає | помірний | низький |
| Вплив на ≈125 serverFn | переписати у реєстр | переписати у процедури | нічого для адмінки |

---

## 6. Висновки для SimplyCMS

1. **Фіксуємо: серверні функції адмінки — не зовнішній API** (документація TanStack + `20-…` §1.4). Зовнішній контур — server routes з Bearer-токеном і винятком у `csrfMiddleware` для `/api/v1/`; серверні функції лишаються клієнтським транспортом адмінки або замінюються серверним клієнтом командного шару.
2. **Першоджерело правди — реєстр команд із Zod 4-схемами входу/виходу і прив'язкою до операції авторизації** (Варіанти 1 або 2). Усі канали — адаптери. Висновок підкріплено тим, що MCP потребує дрібніших інструментів-команд, а REST для 1С/зовнішніх — стабільних ресурсних URL: з реєстру можна вивести обидва, зворотне — ні.
3. **Помилки — `application/problem+json` (RFC 9457) з нашим вайтлістом кодів** (`unique`, `reference`, `not_found`, `stale_source`, `slug_taken`, `unknown_locale`, `idempotency_key_reused`…); MCP-адаптер відображає бізнес-помилки в `isError:true`, не в JSON-RPC помилки.
4. **Ідемпотентність.** Upsert за `id` (GUID 1С) — ідемпотентний сам по собі. Для POST-команд без природного ключа — заголовок `Idempotency-Key` за семантикою чернетки `-07` (409 при in-flight дублі, 422 при іншому payload, повернення збереженої відповіді для дубля) + таблиця ключів з прив'язкою до токена й TTL; чернетка — **expired I-D**, тому посилатися на неї як на «практику Stripe-типу», а не на стандарт.
5. **Конкурентність.** Рівень рядка — `version`/ETag + `If-Match` (RFC 9110 не перевірявся в цій сесії); для перекладів — додатково `expectedSourceHash` (аналог digest). Це два різних захисти: перший — від одночасних правок одного рядка, другий — від перекладу застарілого джерела.
6. **Пагінація/синхронізація.** Keyset `(updated_at, id)` для списків; для інкрементальної синхронізації — «changes feed» як операція `changes.since(cursor)` зі стійким курсором (+ журнал видалень, `20-…` §9.2); окремого відраслевого стандарту не знайдено [не підтв.]. Вебхуки — за Standard Webhooks (HMAC-SHA256, `webhook-id` як ключ дедуплікації, ретраї з jitter) — це готова специфікація, яку варто взяти цілком.
7. **Bulk/async.** Синхронний пакет з малим лімітом + асинхронний job для великого імпорту (202 + job-ресурс, результат по рядках, `errorPolicy`); розмір чанка 1С-адаптера — налаштування. Конкретні числа конкурентів — тільки орієнтир (§4 п.6).
8. **Мовний контур API = Shopify-подібний, на нашій моделі:** операція «записати джерело» не пише в інші мови; «записати переклад» вимагає `expectedSourceHash`; `outdated` обчислюється; slug-зміна окремою командою з `redirect`. Імпорт 1С використовує лише першу операцію.
9. **MCP-сервер — окремий адаптер, не вшитий у ядро схемою агентного протоколу** (узгоджується зі спекою пошуку §11 за `20-…` §7; схема Shopify Storefront MCP/UCP нестабільна). Інструменти — це команди реєстру з анотаціями `readOnly/destructive/idempotent`, набір залежить від скоупів токена (дозволено специфікацією).

### Відкриті питання для архітектора

- **Q1.** Реєстр: власний (В1) чи oRPC (В2)? Рішення залежить від готовності замінити ≈125 `createServerFn` у цій хвилі й прийняти oRPC як центральну залежність ядра. Перед В2 — короткий spike: (i) Zod 4 на 5–10 реальних схемах (`z.date()`, `z.uuid()` vs `z.guid()`, `.refine`), (ii) OpenAPI з `version:'3.1.0'`, (iii) вбудовування `CoreActor`/`AUTHZ_MATRIX` у контекст, (iv) поведінка в `routes.ts` (virtual routes) і в збірці `tsdown`.
- **Q2.** Форма HTTP-поверхні: ресурсний REST (`PATCH /products/{id}`) + командні ендпоінти, чи суто командний `POST /api/v1/<op>`? Для 1С-розробників REST звичніший; для MCP/CLI — команди. Чи публікувати обидва з одного реєстру?
- **Q3.** Гранулярність `source_hash`: на рядок чи на поле (Shopify: на ключ)? Рядковий простіший, але одна правка опису маркує застарілим весь переклад.
- **Q4.** Яку версію OpenAPI фіксуємо як контракт (3.1.0 — найширша підтримка інструментів; 3.2 — дефолт oRPC) і чи гарантуємо OpenAPI-документ як публічний артефакт версії API (`/api/v1/openapi.json`)?
- **Q5.** «Одна мова на запит»: чи параметр `locale` обов'язковий у запитах запису джерела, чи береться мова-джерело за замовчуванням; що робити, коли клієнт пише мовою, відмінною від джерельної?
- **Q6.** Токени: власна таблиця `api_tokens` проти `@better-auth/api-key` (суперечить «нуль плагінів BA», `20-…` §1.2); скоупи = операції `AUTHZ_MATRIX`? Одночасно визначає, чи фільтрується `tools/list` MCP за скоупами.
- **Q7.** Версіонування API: URL `/api/v1` (+ календарні версії як Shopify `2026-10`) чи заголовок; політика сумісності відносно правила semver з `AGENTS.md` (зламний API → мажорна).
- **Q8.** Ідемпотентність: чи реалізовувати `Idempotency-Key` для всіх POST-команд, чи лише для обраного списку (створення замовлення, імпорт-джоб)? TTL ключів (Stripe: ≥24 год) і зберігання відповіді.
- **Q9.** ETag/`If-Match`: підтвердити первинним джерелом (RFC 9110 §13) і з'ясувати, чи `version int` (адитивна колонка) замінює `updated_at` як валідатор — у `20-…` §9.2 вказано, що µs/мс розбіжність `updated_at` не вимірювалась.

---

## 7. Джерела (первинні, відкривалися цієї сесії)

- Shopify Admin GraphQL (API 2026-10): https://shopify.dev/docs/api/admin-graphql/latest/mutations/translationsRegister ; https://shopify.dev/docs/api/admin-graphql/latest/queries/translatableResource
- Medusa Translation Module: https://docs.medusajs.com/resources/commerce-modules/translation
- PrestaShop webservice (list parameters): https://devdocs.prestashop-project.org/9/webservice/tutorials/advanced-use/additional-list-parameters/ (сторінка про мультимовність — 404)
- TanStack Start: https://tanstack.com/start/latest/docs/framework/react/guide/server-functions ; …/server-routes ; …/middleware
- oRPC: https://orpc.dev/docs/adapters/tanstack-start ; https://orpc.dev/docs/openapi/openapi-specification ; https://orpc.dev/docs/comparison ; https://orpc.dev/docs/integrations/ai-sdk ; https://raw.githubusercontent.com/middleapi/orpc/main/README.md
- ts-rest: https://github.com/ts-rest/ts-rest ; trpc-openapi (архів): https://github.com/trpc/trpc-openapi
- Hono: https://github.com/honojs/middleware/tree/main/packages/zod-openapi ; …/packages/mcp
- Effect HttpApi (v4, unstable): https://effect.website/docs/v4/api/effect/unstable/httpapi/HttpApi ; OpenApi.fromApi — https://effect.website/docs/v4/api/effect/unstable/httpapi/OpenApi (через пошук)
- Encore: https://encore.dev/docs/ts ; https://encore.dev/docs/ts/cli/client-generation (через пошук: OpenAPI-клієнт experimental)
- MCP tools (spec 2026-07-28): https://modelcontextprotocol.io/specification/latest/server/tools
- Zod 4 JSON Schema: https://zod.dev/json-schema
- IETF Idempotency-Key: https://datatracker.ietf.org/doc/draft-ietf-httpapi-idempotency-key-header/ ; https://www.ietf.org/archive/id/draft-ietf-httpapi-idempotency-key-header-07.txt
- Stripe idempotency: https://docs.stripe.com/api/idempotent_requests
- RFC 9457: https://www.rfc-editor.org/rfc/rfc9457
- Standard Webhooks: https://github.com/standard-webhooks/standard-webhooks/blob/main/spec/standard-webhooks.md
- JSON:API 1.1: https://jsonapi.org/format/
- Версії/дати пакетів: https://registry.npmjs.org/<пакет> (oRPC 1.15.6; ts-rest 3.52.1; trpc-to-openapi 3.3.0; @trpc/server 11.19.0; hono 4.13.13; @hono/zod-openapi 1.6.3; @hono/mcp 0.3.2; effect 4.0.4; @modelcontextprotocol/sdk 1.32.1; zod 4.6.7; @asteasolutions/zod-to-openapi 9.1.0; zod-openapi 6.0.2; @tanstack/react-start 1.169.1)

**Не вдалося підтвердити:** явне «Zod 4 supported» у документації oRPC; мультимовні поля та PUT у PrestaShop webservice; сторінку Shopware про Sync API (URL 404); RFC 9110 про `If-Match`/ETag (не відкривав); модель дедуплікації/хешування `digest` у Shopify (алгоритм не названо); Effect HttpApi/Encore — глибоко не вивчав (відкинуті за критеріями стеку).
