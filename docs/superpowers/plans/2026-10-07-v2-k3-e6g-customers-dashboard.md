# V2-К3 · Етап Е6г: покупці й дашборд — картка покупця від реєстрації до видалення

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Легасі-сторінки `Users`, `UserEdit` і `Dashboard` переходять на `simplycms/admin-server`. Власник веде покупця від реєстрації до видалення: категорія з блоком автоправил, контакти й email, роль адміна, блокування входу, видалення акаунта зі знеособленням замовлень. Дашборд показує нові замовлення, виручку за 7 і 30 днів та останні замовлення. Модуль «Послуги» зникає. Доводить це `pnpm live:smoke`.

**Architecture:** Записи — іменовані операції в `admin-server/impl/customers/**` під `runAdmin`. Роль, бан і видалення серіалізує advisory-лок `admin-roles`, тож інваріанти «адмін не забанений», «адміна не видалити» й «останній адмін лишається» тримає один лок. Бан — колонка `users.banned_at`, хук `databaseHooks.session.create.before`, тригер БД на `INSERT sessions` і видалення сесій в одній транзакції. Видалення знеособлює замовлення за реєстром ПД-колонок `orders` (`commerce/order-privacy.ts`, тип + харнес), а решту графа користувача прибирають FK-каскади baseline. Читання — три serverFn (`listCustomers` з keyset, `getCustomerCard`, `dashboardSummary`) поверх React Query, без колекцій `admin-data`.

**Tech Stack:** TanStack Start 1.167, React Query, `@tanstack/react-db` (лише наявна `ordersCollection`), Drizzle, Zod 4, Better Auth 1.7.7 (без плагінів), Vitest, PostgreSQL 17 (`pnpm test:schema`), Playwright (`pnpm live:smoke`).

**Spec:** [`docs/superpowers/specs/2026-10-07-customers-dashboard-design.md`](../specs/2026-10-07-customers-dashboard-design.md) (Г-1…Г-8, із правками архітектора за розвилками Е6г-2/3/4/7/8). Зразки — план [Е6в](2026-10-07-v2-k3-e6v-discounts-categories.md): baseline-правка Е6в-1, детермінований тест локу, live-smoke крок із прибиранням. Еталон операції — `admin-server/impl/customers/assign-category.ts` (лок першим запитом, `FOR UPDATE`, `changedBy` із grant).

**Передумова:** гілка `claude/k3-e6g-customers-dashboard` від `main` 3afd3052 (v0.11.0); спека — коміт `a4e9bf1a` плюс docs-коміт з уточненнями за розвилками.

**Обсяг:** 3 легасі-файли. Лічильник `useSupabaseClient` у `src/admin/**`: 9 → **6**.

## Ухвалені рішення етапу

| № | Рішення | Причина |
|---|---|---|
| Е6г-1 | *(архітектор)* **Зайнятий email — помилка поля.** Новий код `taken` у T0-переліку `VALIDATION_ISSUE_CODES` і ключ `admin.validation.taken`. Операція нормалізує email (`trim().toLowerCase()`), у транзакції перевіряє `lower(email)` серед інших користувачів і кидає `ValidationError([{ path: ['email'], code: 'taken' }])` зі статусом 400. Гонку `23505 users_email_key` перехоплює та сама гілка. Прецедент описується в `data-layer.md` §10 | `users_email_key` чутливий до регістру, тоді як BA і `ownerInviteStore` порівнюють email у нижньому регістрі. Тост 409 «дубль» не каже, яке поле виправити |
| Е6г-2 | *(архітектор)* **`revokeUserVerifications(db, { userId, email })`** видаляє `verifications`, де `identifier LIKE 'reset-password:%' AND value = userId`, і рядок `identifier = 'owner-invite:' \|\| lower(email)`. Кличуть зміна email (зі СТАРИМ email) і видалення | У BA 1.7.7 скидання пароля пише `reset-password:<token>` з `value = userId` (`password.mjs:75-78`). Email-ідентифікатор має лише наш invite (`auth/invite.ts:36`) |
| Е6г-3 | *(архітектор)* **Guard не змінюється.** Після зняття ролі `GET /admin` дає 3xx на `/`, а адмін-serverFn — `AuthzError` 403. Після бану сесій немає, тож `/admin` дає 3xx на `/auth` | `start.ts:43-44` відповідає редіректом, а не 403 |
| Е6г-4 | *(архітектор)* **Лок `admin-roles`** (`ADMIN_ROLES_LOCK`). Його беруть `setAdminRole`, `setCustomerBan` і `deleteCustomer`; перевірки «не адмін», «не я» й «не останній» виконуються під ним. Канон §13: `customer-category:<userId>` → `admin-roles`, зворотного порядку не бере ніхто. Захисні перевірки `deleteCustomer` йдуть до кроку аватара (читанням) і повторно в транзакції | Без спільного лока гонка «видати роль ↔ забанити чи видалити» дала б забаненого або видаленого адміна |
| Е6г-5 | *(архітектор)* **Фільтр замовлень у URL.** `/admin/orders` отримує `validateSearch({ status?: uuid })`, і стан фільтра живе в search. `dashboardSummary` віддає `newStatusId: string \| null` | Зараз фільтр — локальний `useState` (`OrdersPage.tsx:14`), тож глибоке посилання неможливе |
| Е6г-6 | *(архітектор)* **Читання покупців без колекцій.** `listCustomers` → `{ rows, nextCursor }`, keyset `(created_at desc, id desc)`, сторінка 50, `useInfiniteQuery`. Ключі — `entityKey(ENTITY.profiles).variant('admin-customers')` + фільтри та `.variant('admin-customer', userId)`. Мутації інвалідовують префікс `[ENTITY.profiles]`; видалення ще кличе `ordersCollection.utils.refetch()` | `ENTITY` — імена таблиць, сутності `customers` немає. Префікс `profiles` зачіпає й агрегати цін, і це коректно: категорія впливає на ціну |
| Е6г-7 | *(архітектор)* **Реєстр ПД `orders`** — `commerce/order-privacy.ts`: `ORDER_COLUMN_PRIVACY: { readonly [K in keyof Order]: 'personal' \| 'operational' }`, нова drizzle-колонка червонить `typecheck`. Харнес звіряє реєстр з `information_schema`. Personal: `firstName`, `lastName`, `email`, `phone`, `deliveryAddress`, `deliveryCity`, `notes`, `recipientFirstName`, `recipientLastName`, `recipientPhone`, `recipientEmail`, `userId`, `savedAddressId`, `savedRecipientId`, `accessToken`, `shippingData`. Решта — operational. Знеособлюються лише замовлення з `user_id` покупця; гостьові з тим самим email — беклог | Без реєстру наступна колонка з ПД тихо пережила б «право на забуття». Тип — найсильніший гейт: мутація не компілюється |
| Е6г-8 | *(архітектор)* Легасі `Reviews.tsx`/`ReviewDetail.tsx` **не чіпаємо** (хвиля Е6д). «Колишній покупець» показує вітрина; «Видалений покупець» — жива картка й список замовлень адмінки та останні замовлення дашборду | Легасі на `supabase-js` на новому стеку не працює, тож null-guard у ньому нічого не доводить |
| Е6г-9 | *(архітектор)* **Гейт-греп «Послуг»**: `rg -n "service_requests\|serviceRequests\|service_id\|serviceId\|\bservices\b" packages scripts tests docs/architecture docs/guides docs/development -g '!**/seed-migrations/**' -g '!**/node_modules/**' -g '!**/dist/**' -g '!packages/simplycms/src/supabase/**'` дає рівно два рядки allowlist: `packages/simplycms-theme-solarstore/src/messages.ts:78` і `:89` («installation services»). `src/supabase/database.ts` руками не правимо: файл зноситься в Е7 | `seed-migrations/` — історичні знімки, `CHANGELOG.md` і спеки — історія |
| Е6г-10 | *(план)* **Знеособлена адреса в знімку:** `destination` `{ kind: 'address', city: null, address: null }`. У контракті `ShippingSnapshot` поле `city` стає `string \| null`, `parseShippingSnapshot` приймає `null`, а три читачі (`OrderDeliveryCard`, `OrderSuccess`, `ProfileOrderDetail`) показують «Не вказано». Точку видачі (`kind: 'pickup-point'`) і зіпсований `{}` знеособлення не змінює. 🔴 *(умова архітектора)* `city: null` допускає лише ЧИТАЛЬНА сторона: запис знімка (`prepareCheckout`/`placeOrder`, перерахунок у `order-items/totals.ts`) і далі будує `destination` з непорожнім `city`. Наявний тест «чекаут відхиляє порожнє місто» лишається зеленим без змін, а `null` на записі прибиває окремий асерт | `kind` і точка видачі лишаються (спека §7.3), і знімок має розбиратися після стирання. Послаблений контракт на записі тихо пропустив би живе замовлення без міста |
| Е6г-11 | *(план)* **Взаємовиключність «адмін ↔ бан» з обох боків:** видати роль забаненому → 409 `admin_role_banned` (той самий лок) | Інакше інваріант «адмін не забанений» тримав би лише бан |
| Е6г-12 | *(план)* `loadCustomerStats` лишається в гривнях, бо на ньому стоять пороги автоправил. Центи — на межі serverFn картки (`toCents`). `dashboardSummary` працює під `order.manage`. Застарілі записи мапи `PlaceholderPage` (`users`, `user-categories`, `settings`, `order-statuses`, `services`, `service-requests`) зносяться; лишається `languages` | Погоджено з архітектором («дрібне») |
| Е6г-13 | *(план)* **Бан у хуку:** `createSessionBanHook(isBanned)` кидає `APIError.from('FORBIDDEN', { code: 'BANNED', message })`. Реалізація за замовчуванням — `isUserBannedInDb`, підміна — `deps.isUserBanned` (як `provisionUser`). Повернення `false` заборонене: клієнт отримав би загальний `FAILED_TO_CREATE_SESSION`. Тест через реальний `auth.handler` ОБОВʼЯЗКОВИЙ, бо те, що `better-call` 1.4.0 донесе код до клієнта, не доведено прогоном | `with-hooks.mjs:16-20` пропускає throw хука крізь себе, а `false` перетворює на загальну помилку |
| Е6г-14 | *(архітектор, аудит Codex №1)* **Бан тримає БД.** Хук Е6г-13 лишається і дає чистий `BANNED` у звичайному випадку. До нього додається тригер `sessions_refuse_banned` `BEFORE INSERT ON sessions` з функцією `refuse_banned_session()`: `SELECT banned_at FROM users WHERE id = NEW.user_id FOR SHARE` (лок безумовно за `id`, перевірка значення — після), і на забаненому — `raise exception`. Тригер і функція живуть у baseline (`0001_init.sql`) і в асертах `baseline.test.ts`. `SECURITY DEFINER` не вмикається: proxy пише під `app_admin` (`drizzle-proxy.ts` `AUTH_ROLE`), а йому `FOR SHARE` дозволяє грант `UPDATE` на `users`. У гонці клієнт отримує загальну помилку, а не `BANNED`, — це прийнятно й задокументовано в коментарі тригера | `drizzle-proxy.ts:8-13`: кожен запит адаптера — окрема транзакція, тож між читанням хука й вставкою сесії бан міг закомітитись. Обидва порядки з `FOR SHARE` коректні (Task 5) |
| Е6г-15 | *(архітектор, аудит Codex №2)* **Аватар стирається в ГОЛОВНІЙ транзакції.** Порядок `deleteCustomer` *(уточнено, раунд 2)*: `customer-category:<id>` → `admin-roles` → `profiles … FOR UPDATE` → перевірки → прочитати ref аватара → знеособлення → відгуки → `revokeUserVerifications` → `DELETE users` → `eraseMedia(tx, ref)` ОСТАННІМ кроком перед COMMIT. Рядок `media` переживає каскад, бо `uploaded_by` має `SET NULL`. Окремої транзакції для аватара немає; операція йде через `runAdmin`, а не `runAdminTransactions` | Інакше роль, видана між перевіркою й аватаром, змусила б видалення відмовити, але аватар нового адміна вже було б стерто. Канон К3-Е2 лишається: усередині `eraseMedia` — DELETE рядка `media` → видалення файла → COMMIT викликача (`storage/record.ts:133-169`). Останнім кроком — бо файл тоді губиться лише при збої самого COMMIT (повтор лікує: `local-fs` вважає `ENOENT` успіхом) |
| Е6г-16 | *(архітектор, аудит Codex №3)* **Позиції стертого замовлення не редагуються:** 409 `order_personal_data_erased` у `lockEditableOrder` (`order-items/editable.ts`), поруч із `order_cancelled_final`. Зміна статусу й скасування дозволені. UI картки замовлення блокує редагування позицій за `personalDataErasedAt` (`useOrderLocked`). Гілку знімка в `totals.ts` Е6г не чіпає й не тестує як живу | `recomputeOrderTotals` кличе `validateShippingChoice` з `orders.delivery_city`. Для адресної доставки `null` дає `shipping_unavailable` (`commerce/shipping-providers.ts:64`) |
| Е6г-17 | *(архітектор, аудит Codex №6)* **`loadOrderDetail` без фільтра стертих.** Канонічний коментар (`storefront/loaders/orders.ts:60-68`: доступ вирішує RLS-роль, а не предикат) лишається. Guard на null-ПД лишається. Харнес доводить, що після видалення замовлення не читається старим токеном | Стерте замовлення недосяжне за побудовою: `user_id NULL` і `access_token NULL` |
| Е6г-18 | *(архітектор, аудит Codex р4 №1)* **Guard у `sendResetPassword`** (`auth/instance.ts`). BA вставляє `reset-password:<token>` окремим запитом ПЕРЕД викликом колбека (`password.mjs:64-86`). Колбек відкриває транзакцію `app_admin` і БЕЗУМОВНО робить `select email from users where id = $1 for share` (урок р2: умова в `WHERE` ламає `FOR SHARE`). Якщо рядка немає або `lower(email) ≠ lower(user.email)` (знімок BA), колбек видаляє `reset-password:<token>` і листа не шле. Назовні винятку немає: BA і так відповідає однаково. Цей guard закриває й видалення акаунта | Інакше зміна email між `findUserByEmail(старий)` і вставкою токена лишає чинний токен, і лист іде на стару адресу. Той самий клас, що Е6г-14: «рішення BA окремими транзакціями» |
| Е6г-19 | *(архітектор, аудит Codex р4 №2)* **Invite власника під `admin-roles`.** `ADMIN_ROLES_LOCK` живе в `simplycms/auth` (`auth/admin-roles-lock.ts`); `admin-server` імпортує його звідти. Store invite має ОДИН метод `issueAdminInvite({ userId, identifier, valueHash, expiresAt })` в одній транзакції `app_admin`: `advisoryXactLock(ADMIN_ROLES_LOCK)` → `select banned_at from users where id = $1 for share` → на бані типізована відмова `banned`, нічого не записано → `insert user_roles … on conflict do nothing` → upsert токена (`delete` + `insert` за `identifier`). `storeToken` і `grantAdminRole` прибираються (інших споживачів, крім двох тестових фейків, немає). CLI друкує «спершу розблокуйте покупця». Invite бере лише `admin-roles`, тож канон порядку локів не порушено | Сьогодні `grantAdminRole` — безумовний `INSERT` без лока й бану, і повторний invite робить забаненого адміна. Окрема перевірка перед `storeToken` лишала б щілину «токен є, ролі немає» |

## Ступінь обовʼязковості — читати ПЕРШИМ

- **КАНОН** (розбіжність → зупинка і звернення до архітектора): рішення Е6г-1…Е6г-19, Global Constraints, імена операцій, serverFn, типів і state-кодів у блоках Interfaces, склад гейтів, асерти Review Focus, рядки i18n, позначені як КАНОН.
- **ОРІЄНТИР** (виконавець адаптує сам і пише про це у звіті): якорі `файл:рядок`, імена внутрішніх компонентів і хуків, розкладка JSX, розбиття UI-файлів, текст SQL.
- 🔴 Звіт «гейт зелений» — не доказ. Доказ — вивід команди у звіті задачі. На К3-Е2 двоє виконавців відрапортували повний ланцюг зеленим, а вісім файлів були без `prettier --write`.
- 🔴 Крок «має бути ЗЕЛЕНИМ одразу» перевіряє припущення плану. Червоний — знахідка: зупинка, а не «полагодити тест».
- 🔴 Лок доводиться детерміновано хелперами `holdAdvisoryLock`/`stillPending` (`test-harness/pg/__tests__/fixtures/advisory-lock.ts`). Тест `Promise.all` двох операцій як єдиний доказ заборонено: на К3-Е4 без локу він червонів лише в ~4 % прогонів.
- Задачі адресуються заголовками `## Task N:`; заголовок незмінний, статус — окремим рядком під ним.

## Протокол виконання

- **Ролі.** Виконує сесія-оркестратор (subagent-driven). **Архітектор — сесія `dashboard-design-spec`** (рішення Е6г-N), звернення — `SendMessage`. Автор плану — `simplycms-43`. Ескалація ДО коду: розбіжність із КАНОНОМ; «зелений одразу» вийшов червоним; потрібне рішення, якого план не містить. Відповідь — рішення `Е6г-N`, вписане в таблицю окремим docs-комітом.
- **Рев'ю.** Після кожної задачі — рев'ю задачі (SDD). Після Task 12 — фінальне рев'ю гілки архітектором; межа дифу — від коміту спеки `a4e9bf1a` (`git diff a4e9bf1a^..HEAD`). Архітектор у спільному дереві git не чіпає. Мерж і пуш вирішує власник.
- **Стенд.** `PG_HARNESS_URL=postgresql://pgtest@127.0.0.1:55434/postgres`. RED одного файлу харнеса: `pnpm exec vitest run --config vitest.schema.config.ts <фільтр>`.

## Global Constraints

- TypeScript 6.0 strict (`UPSTREAM:TSESL-1`). Node `>=22.12`.
- Коментарі й доки українською; рядки інтерфейсу — лише i18n (обидва каталоги `uk`/`en`, парність — `catalog-integrity.test.ts`). Гроші — `useFormatPrice()`, у застосунку — центи.
- `pnpm lint` = 0 errors / 7 warnings.
- 🔴 Ліміт 150 рядків на новий або переписаний файл. `wc -l` нових файлів іде у звіт кожної задачі: на К3-Е4 без цього девʼять файлів вийшли до 350 рядків. Виняток — `admin-server/index.ts` (К3-9′). Легасі `UserEdit.tsx` (556 рядків) і `Users.tsx` (322) переписуються з нуля у `admin/features/customers/**`; сторінки в `admin/pages/` стають однорядковими реекспортами (зразок `admin/pages/Orders.tsx`).
- Повний ланцюг: `pnpm install --frozen-lockfile → format:check → lint → build → typecheck → test → test:schema → build:packages → typecheck:template → test:packaging → pilot:pack --skip-build`.
- Мінімальний гейт задачі: `pnpm lint && pnpm typecheck && pnpm test`. Плюс `pnpm test:schema`, якщо зачеплено `schema/`, `migrations/`, `commerce/`, `auth/`, `storefront/loaders/`, `admin-server/impl/**`, `test-harness/`. Плюс `pnpm build:packages`, якщо зачеплено серверний код пакета або `exports`. 🔴 Задача, що додає чи видаляє файл роуту, запускає `pnpm build` ПЕРЕД `pnpm typecheck`: `typecheck` — це `tsc --noEmit`, і генерат `src/routeTree.gen.ts` він не оновлює (аудит Codex №4: після Task 1 генерат досі імпортує роути «Послуг»).
- К3-4′/К3-9′: `createServerFn` — лише топ-рівневий `const` в `admin-server/index.ts`; нутрощі — `admin-server/impl/**` через bare-специфікатор `simplycms/admin-server/impl`. Кожен `.validator(...)` — `adminInput(...)`.
- К3-13: кожна адмін-операція йде через `runAdmin(operation, fn)` (або `runAdminTransactions` для кількох транзакцій); 409 ставиться до `throw` (`stateConflict`).
- К3-7: синк кешу в тій самій функції, що й мутація (`eslint-rules/mutation-cache-sync.mjs`), без `cache-sync-ok`.
- Нові serverFn — у фабрику моку `admin-server/__tests__/support/admin-server-mock.ts` (без запису червоніє `typecheck`).
- Ключ `id` генерує викликач (`crypto.randomUUID()`); `DEFAULT gen_random_uuid()` у схему не повертати.
- Тіри: `contracts` = T0, `domain` = T1, `commerce`/`admin-server`/`auth`/`storefront` = T2, `admin-data` = T4, `admin`/`storefront-routes` = T5.
- Нові state-коди йдуть у `ADMIN_STATE_CONSTRAINT`, `STATE_KEYS` (`admin/lib/admin-error.ts`) і `admin.errors.*` разом. Тип `Record<AdminStateConstraint, MessageKey>` змушує зробити це одночасно.
- `console.log` у production-коді не лишати.
- Коміти: `feat(k3-e6g): …`, `test(k3-e6g): …`, `docs(k3-e6g): …`; без трейлерів `Co-Authored-By`/`Generated with`.

## Review Focus

1. **Власник змінює email покупця на `Buyer@Shop.test`, а в іншого користувача вже є `buyer@shop.test`** → поле email показує «вже використовується», у БД нічого не змінилось (ні `users`, ні `profiles`, ні `verifications`). Збереження власного email в іншому регістрі (`buyer@x` → `Buyer@X`) — не конфлікт і записує нижній регістр. Тест — Task 6.
2. **Видаляється покупець, у якого є замовлення з точкою видачі, замовлення з адресою і замовлення зі зіпсованим `shipping_data = '{}'`** → операція не падає: адреса стерта, точка видачі й `{}` лишились як були, усі три замовлення мають `personal_data_erased_at`. Тест — Task 7.
3. **Видалення обірвалось на стиранні файла аватара** (збій `driver.delete`) → транзакція відкотилась, нічого не змінилось: покупець, замовлення з ПД, відгук і рядок `media` на місці; повтор операції завершує видалення. Покупця без аватара видалення теж не ламає. Тест — Task 7.
4. **Забанений покупець скидає пароль за посиланням з листа й пробує увійти** → скидання проходить (сесії не створює), вхід відмовлено з `BANNED`. Відкрита вкладка забаненого на вітрині працює як гостьова, а не 500. Тест — Task 5.
5. **Власник, створений CLI `owner:invite`, не має рядка `profiles`** → він є в `listCustomers` (база — `users LEFT JOIN profiles`) з роллю адміна, його картка відкривається, а статистика — `null` і показується як «—». Тест — Task 3.

Додатково: пошук із `%` чи `_` не повертає всіх (`escapeLike`); пошук `0671234567` знаходить `+38 (067) 123-45-67` (порівняння цифр) — Task 3. Два адміни одночасно знімають роль один з одного → рівно одне зняття проходить, друге отримує `admin_role_last` (детермінований лок) — Task 4. Виручка рахує замовлення зі `status_id NULL` і не рахує скасовані — Task 3.

## Граф залежностей задач

```
Task 1 (знос «Послуг») ─► Task 2 (схема графа користувача, реєстр ПД, читачі) ─┬─► Task 3 (читання: список, картка, дашборд)
                                                                               ├─► Task 4 (роль адміна)
                                                                               ├─► Task 5 (бан)
                                                                               └─► Task 6 (контакти й email)
Task 4 (лок, guards), Task 5 (`customer_is_admin`), Task 6 (`fieldIssue`, `revokeUserVerifications`) ─► Task 7 (видалення)
Task 3 ─► Task 8 (UI дашборду, фільтр у URL) ─┐
Task 3 ─► Task 9 (UI списку покупців)         ├─► Task 12 (live:smoke, доки, ланцюг)
Task 3, 6 ─► Task 10 (картка: перегляд, категорія, контакти)
Task 4, 5, 7, 10 ─► Task 11 (картка: роль, бан, видалення) ─┘
```

Задачі виконуються послідовно, бо комітять у спільну гілку. Task 4–6 між собою незалежні й додають state-коди в один перелік. Task 7 стоїть після них, бо споживає їхні guards, коди й хелпери.

## File Structure

**Створюються:**
- `src/commerce/order-privacy.ts` (реєстр ПД і `eraseOrderPersonalData`);
- `src/auth/{admin-roles-lock,reset-guard}.ts` (Е6г-18, Е6г-19);
- `src/auth/ban.ts` (`createSessionBanHook`, `isUserBannedInDb`);
- `src/admin-server/impl/customers/{list,card,roles,ban,contacts,verifications,delete,guards}.ts`, `src/admin-server/impl/dashboard/summary.ts`;
- `src/contracts/objects/admin-dashboard.ts`, `src/contracts/objects/admin-customer.ts`;
- `src/admin/features/dashboard/**`, `src/admin/features/customers/{list,card}/**`;
- харнес: `test-harness/pg/__tests__/{user-graph,order-privacy-registry,admin-customers-read,admin-dashboard,admin-customer-roles,admin-customer-ban,auth-ban,admin-customer-contacts,admin-customer-delete}.test.ts`;
- `scripts/live-smoke/admin-customers{,-setup,-owner,-roles,-ban,-delete,-sql,-cleanup}.mjs`.

**Змінюються:** `schema/{schema,auth,types}.ts`, `migrations/{0001_init,0002_grants}.sql`, `drizzle/0000_init.sql` + `drizzle/meta/0000_snapshot.json`, копії `template:sync`; `contracts/{domain-errors,shipping-providers}.ts`, `contracts/objects/index.ts`; `domain/{media,shipping-snapshot}.ts`; `auth/{authz,instance}.ts`; `admin-server/{index,impl/index,impl/validation}.ts`, `impl/orders/resource.ts`, `impl/order-items/resource.ts`, мок; `storefront/loaders/{entities/order,reviews}.ts`, `core/lib/reviews.ts`, `reviews-ui/ReviewCard.tsx`; `storefront-routes/pages/{Auth,OrderSuccess,ProfileOrderDetail}.tsx`; `admin/features/orders/{list,detail}/**`, `routes/admin/admin/orders/index.tsx`; `admin/layouts/AdminSidebar.tsx`, `admin/pages/{PlaceholderPage,Dashboard,Users,UserEdit}.tsx`; `admin/lib/admin-error.ts`; `plugins/types.ts` (тип контексту слота); i18n; харнес-фікстури (`rls-actors`, `grants`), `baseline.test.ts`, `grants-parity.test.ts`, `rls-behaviour.test.ts`; `tests/{admin-server-first/registry,dev-stand-seed,admin-inserts-need-id}.test.ts`; `scripts/live-smoke/owner-steps.mjs`; доки.

**Видаляються:** `routes/admin/admin/services/index.tsx`, `routes/admin/admin/service-requests/index.tsx`; тіла легасі `Users.tsx`, `UserEdit.tsx`, `Dashboard.tsx`.

---

## Task 1: Знос «Послуг» (Г-2, Е6г-9)

**Files:**
- Modify: `schema/schema.ts` (−`services`, −`serviceRequests`, −`orderItems.serviceId` з FK та індексом; коментар про кількість політик у рядку 18 перерахувати), `schema/types.ts` (−`Service`, `ServiceRequest`, `NewServiceRequest`), `migrations/0001_init.sql`, `migrations/0002_grants.sql` (рядки 83, 118-119, 158-159), `drizzle/0000_init.sql`, `drizzle/meta/0000_snapshot.json`, `domain/media.ts` (−`services.image_url` з коментарем 136-138), `admin-server/impl/order-items/resource.ts` (−`'serviceId'`), `admin/features/orders/detail/__tests__/support.ts`, `admin/layouts/AdminSidebar.tsx` (−`servicesItems`, група, невживані іконки), `admin/pages/PlaceholderPage.tsx` (Е6г-12), `admin/pages/Dashboard.tsx` (лише −запити й картки «Послуг», бо сторінку переписує Task 8), i18n uk/en `admin/{nav,common,dashboard}.ts`, харнес `fixtures/{rls-actors,grants}.ts`, `baseline.test.ts`, `grants-parity.test.ts`, `rls-behaviour.test.ts`, `tests/dev-stand-seed.test.ts`, `scripts/dev-stand/{table-specs.mjs,README.md}`; копії `pnpm template:sync`
- Delete: `routes/admin/admin/{services,service-requests}/index.tsx`

**Interfaces:** немає нових.

- [ ] **Step 1: Червоний.** У `baseline.test.ts`: точне число таблиць `44 → 42` (`:120`, з коментарем «Е6г прибрала `services` і `service_requests`»); з переліку RLS-таблиць (`:146-168`) прибрати `service_requests`; число політик, якщо тест його асертить, — мінус три політики `service_requests` (виміряти, не вгадувати); новий асерт «колонки `order_items.service_id` немає» (`information_schema.columns`). Run: `pnpm exec vitest run --config vitest.schema.config.ts baseline` → FAIL саме на цих асертах.
- [ ] **Step 2: Знос** за Files. Порядок у SQL: політики → індекси → FK → таблиці, `order_items.service_id`. `pnpm template:sync`.
- [ ] **Step 3: Зелене.** Run: `cd packages/simplycms && pnpm exec drizzle-kit generate --config ./drizzle.config.ts` → «No schema changes»; `pnpm exec vitest run --config vitest.schema.config.ts baseline grants-parity rls-behaviour rls-parity id-defaults explicit-ids demo-seed seed-determinism` → PASS; `pnpm lint && pnpm build && pnpm typecheck && pnpm test` → PASS (`build` регенерує `routeTree.gen.ts` без двох роутів).
- [ ] **Step 4: Гейт-греп** Е6г-9 → рівно два рядки allowlist (вивід у звіт). Негативний контроль: тимчасово повернути `'serviceId'` у `order-items/resource.ts` → греп дає третій рядок; відкотити.
- [ ] **Step 5: Коміт** — `feat(k3-e6g): знос модуля «Послуги»`.

---

## Task 2: Граф користувача, реєстр ПД замовлень, читачі nullable (Г-5, Г-6, Е6г-7, Е6г-10)

**Files:**
- Create: `commerce/order-privacy.ts`, `test-harness/pg/__tests__/{user-graph,order-privacy-registry}.test.ts`
- Modify: `schema/schema.ts`, `schema/auth.ts` (`users.bannedAt`, `users.banReason`), `migrations/0001_init.sql`, `drizzle/**`, копії `template:sync`; `contracts/shipping-providers.ts` (`city: string | null` у `kind: 'address'`), `domain/shipping-snapshot.ts` (+тест); `admin-server/impl/orders/resource.ts` (`personalDataErasedAt` у `readonly`); `storefront/loaders/{entities/order,orders,reviews}.ts` (`loadOrderDetail` — `orders.ts:69`), `core/lib/reviews.ts`, `reviews-ui/ReviewCard.tsx`; `admin/features/orders/{list/OrdersTable,list/useOrdersList,detail/OrderCustomerCard,detail/OrderDeliveryCard}.tsx`; `checkout-ui/ShippingSnapshotLines.tsx` (спільний рендер знімка для `OrderSuccess` і `ProfileOrderDetail`: `city: null` → `t('common.notSet')`, а не порожній рядок); `storefront-routes/pages/{OrderSuccess,ProfileOrderDetail}.tsx`; i18n

**Interfaces:**
- Склад схеми (КАНОН): `orders.first_name/last_name/email/phone` стають nullable; `+ personal_data_erased_at timestamptz NULL`; `CHECK orders_personal_data_present (personal_data_erased_at IS NOT NULL OR (first_name IS NOT NULL AND last_name IS NOT NULL AND email IS NOT NULL AND phone IS NOT NULL))`. FK `orders.user_id` → `ON DELETE SET NULL`. Нові FK на `users(id)`: `user_addresses.user_id` і `user_recipients.user_id` → `CASCADE`, `user_category_history.user_id` → `CASCADE`, `user_category_history.changed_by` → `SET NULL`. `product_reviews.user_id` nullable з FK `SET NULL` (unique `(product_id, user_id)` лишається). `users.banned_at timestamptz NULL`, `users.ban_reason text NULL`. Нових грантів немає.
- `ORDER_COLUMN_PRIVACY: { readonly [K in keyof Order]: OrderColumnPrivacy }`, `type OrderColumnPrivacy = 'personal' | 'operational'` (склад — Е6г-7; `personalDataErasedAt` — operational).
- `eraseOrderPersonalData(db: ActorDb, userId: string, now: Date): Promise<number>` — ОДИН `UPDATE orders … WHERE user_id = $1 RETURNING id`. SET будується з реєстру (кожна `personal` колонка → `NULL`), крім `shippingData`: для `destination.kind = 'address'` — `jsonb_set(…, '{destination}', '{"kind":"address","city":null,"address":null}')`, інакше без змін. Плюс `personal_data_erased_at = now`. Повертає кількість рядків. Нова `personal` колонка стирається без правки функції.
- `ProductReviewRow.user_id: string | null`. `ReviewCard`: `user_id === null` → `t('reviews.formerCustomer')`, інакше нинішня логіка. `loadReviewAuthors` отримує лише не-null id.
- Storefront-лоадер замовлення (`loadOrderDetail`, `orders.ts`) НЕ фільтрує стерті (Е6г-17): доступ вирішує RLS-роль, і канонічний коментар `:60-68` лишається. ПД звужуються guard-ом, що кидає на `null`, а не підставляють `''` (інваріант тримає CHECK, а стерте замовлення недосяжне, бо `user_id` і `access_token` — `NULL`).
- Адмінка: `personalDataErasedAt !== null` → імʼя `t('admin.orders.erasedCustomer')`, контакти й блок одержувача приховані.
- i18n (КАНОН): `reviews.formerCustomer` — «Колишній покупець» / «Former customer»; `admin.orders.erasedCustomer` — «Видалений покупець» / «Deleted customer».

- [ ] **Step 1: Харнес (червоний).** `user-graph.test.ts` (БД через `createTempDatabase`/`applySqlFiles`, засів SQL):
  - покупець з адресою, одержувачем, історією категорій (свій рядок і рядок іншого покупця, де він `changed_by`), відгуком, вішлистом, порівнянням, рядком `media` (`uploaded_by`) і замовленням зі стертими ПД. Під роллю `app_admin` `delete from users where id = $1` → адреси, одержувачі, власна історія, вішлист і порівняння зникли; чужа історія має `changed_by NULL`; відгук і `media` лишились з `NULL`; замовлення — з `user_id NULL`;
  - сиріт немає: для кожної колонки `user_id`/`changed_by`/`uploaded_by` з `information_schema` у схемі `public` кількість значень, яких немає в `users`, = 0;
  - CHECK: `update orders set first_name = null` при `personal_data_erased_at IS NULL` → `23514`; разом із `personal_data_erased_at = now()` → OK.
  - `order-privacy-registry.test.ts`: множина колонок `orders` з `information_schema` = множина `getTableColumns(orders)[k].name` для ключів реєстру. `eraseOrderPersonalData` на трьох замовленнях покупця (адреса, точка, `{}`) і одному чужому → три стерті; усі `personal` колонки, КРІМ `shippingData`, — `NULL`; `shippingData` перевіряється окремо для кожного з трьох варіантів: адреса → як в Е6г-10, точка й `{}` — байт у байт як до стирання; чуже замовлення незмінне (Review Focus 2).
  - Run → FAIL з очікуваної причини.
- [ ] **Step 2: Юніт `parseShippingSnapshot`** — `{ kind: 'address', city: null, address: null }` розбирається; `city: 5` → `null`. Запис (Е6г-10): тип побудови знімка в `prepareCheckout` лишається `city: string` (окремий тип запису або `NonNullable` — ОРІЄНТИР), і асерт «чекаут з `city: null`/`''` відхилено» зелений; наявний тест порожнього міста не змінюється.
- [ ] **Step 3: Реалізація** за Interfaces (baseline як Task 1). Читачі: рендер-тести `OrderCustomerCard` і `OrdersTable` зі стертим замовленням (немає `null null`, є «Видалений покупець», email і телефону в DOM немає) і `ReviewCard` з `user_id: null`.
- [ ] **Step 4: Зелене** — `drizzle-kit generate` → «No schema changes»; `pnpm test:schema && pnpm lint && pnpm typecheck && pnpm test && pnpm build:packages` → PASS. Негативні контроли (вивід у звіт): (а) додати в `schema.ts` колонку `orders.foo text` → `typecheck` червоніє на `ORDER_COLUMN_PRIVACY`; (б) додати колонку лише в SQL харнеса (`alter table orders add column bar text`) → `order-privacy-registry` червоніє; (в) прибрати FK CASCADE з `user_addresses` → `user-graph` червоніє на сиротах. Відкотити.
- [ ] **Step 5: Коміт** — `feat(k3-e6g): FK-граф користувача, реєстр ПД замовлень`.

---

## Task 3: Читання — список, картка, дашборд (Г-1, Г-4, Е6г-5, Е6г-6, Е6г-12)

**Files:**
- Create: `admin-server/impl/customers/{list,card}.ts`, `admin-server/impl/dashboard/summary.ts`, `contracts/objects/{admin-customer,admin-dashboard}.ts`, харнес `{admin-customers-read,admin-dashboard}.test.ts`
- Modify: `contracts/objects/index.ts`, `admin-server/{index,impl/index}.ts`, мок, `plugins/types.ts` (JSDoc контексту слота `admin.dashboard.stats`)

**Interfaces:**
- `listCustomersInput = z.object({ search: z.string().trim().min(2).max(100).optional(), categoryId: z.uuid().optional(), role: z.enum(['admin', 'customer']).optional(), banned: z.boolean().optional(), cursor: z.object({ createdAt: z.date(), id: z.uuid() }).optional() })`.
- `listCustomersOp({ data }) → Promise<{ rows: AdminCustomerRow[]; nextCursor: { createdAt: Date; id: string } | null }>` під `customer.manage`, `CUSTOMERS_PAGE_SIZE = 50`. База — `users u LEFT JOIN profiles p` (Review Focus 5). Категорія ефективна (`coalesce(p.category_id, <дефолтна>)`), фільтр — за ефективною. Агрегати замовлень — SQL з тією самою умовою, що в `loadCustomerStats` (`status.code is distinct from 'cancelled'`, `status_id NULL` рахується). Пошук через `escapeLike` по `u.email`, `u.name`, `p.first_name`, `p.last_name`, `p.phone`; якщо в запиті ≥ 3 цифр — ще й `regexp_replace(p.phone, '\D', '', 'g') like '%<цифри>%'`.
- `AdminCustomerRow = { userId: string; email: string; name: string | null; phone: string | null; categoryId: string | null; categoryName: string | null; ordersCount: number; ordersTotalCents: number; isAdmin: boolean; bannedAt: Date | null; createdAt: Date }`.
- `getCustomerCardInput = z.object({ userId: z.uuid() })`; `getCustomerCardOp → Promise<AdminCustomerCard | null>` під `customer.manage`.
- `AdminCustomerCard = { userId; email; emailVerified: boolean; firstName: string | null; lastName: string | null; phone: string | null; createdAt: Date; avatarRef: string | null; authProviders: string[]; utmSource: string | null; utmCampaign: string | null; stats: { ordersCount: number; totalPurchasesCents: number } | null; category: { id: string; name: string; locked: boolean } | null; isAdmin: boolean; bannedAt: Date | null; banReason: string | null; history: AdminCategoryHistoryEntry[] }`. `history` — останні 50, новіші зверху: `{ id; fromName: string | null; toName: string; reason: string | null; byRule: boolean; changedByEmail: string | null; createdAt: Date }` (знімок назв, закриває К3-Е6в-5). `stats` — з `loadCustomerStats(db, userId, now)` + `toCents`; без профілю — `null`.
- `dashboardSummaryOp() → Promise<AdminDashboardSummary>` під `order.manage`, без валідатора (зразок `countCustomersByCategory`).
- `AdminDashboardSummary = { newOrders: number; newStatusId: string | null; revenue7dCents: number; revenue30dCents: number; recentOrders: { id: string; orderNumber: string; customerName: string | null; erased: boolean; totalCents: number; statusId: string | null; createdAt: Date }[] }`. Вікна — `created_at >= now() - interval '7 days'` / `'30 days'` від серверного `now()`; «нові» — код `new` з `ORDER_STATUS_CODE`; 10 останніх — `created_at desc, id desc`.
- `AdminDashboardStats = Pick<AdminDashboardSummary, 'newOrders' | 'revenue7dCents' | 'revenue30dCents'>` — форма `context.stats` слота `admin.dashboard.stats` (JSDoc у `plugins/types.ts`).
- serverFn (GET): `listCustomers`, `getCustomerCard`, `dashboardSummary`.

- [ ] **Step 1: Харнес (червоний).**
  - `admin-customers-read.test.ts`: 3 покупці з різними `created_at` + власник без `profiles` (вставка лише `users` + `user_roles`). Сторінка з лімітом (тестовий шов `pageSize`) дає `nextCursor`, друга сторінка продовжує без дублів і пропусків, у тому числі для двох рядків з однаковим `created_at`. Власник є в списку з `isAdmin: true` і `categoryName` дефолтної категорії. Фільтри: `role: 'admin'` → лише власник; `banned: true` → лише покупець із `banned_at`; `categoryId` дефолтної → включає покупця з `category_id NULL`. Пошук `%` → 0 рядків; `0671234567` знаходить `+38 (067) 123-45-67`. Агрегати: покупець з замовленнями «нове» 100.50, «скасоване» 999, `status_id NULL` 10 → `ordersCount: 2`, `ordersTotalCents: 11050`.
  - Картка: історія з `from_category_id NULL` і назвою зі знімка; `changedByEmail` — email адміна; картка власника без профілю → `stats: null`, не виняток (Review Focus 5); неіснуючий `userId` → `null`.
  - `admin-dashboard.test.ts`: замовлення «нове» сьогодні 100.00, «скасоване» сьогодні 500.00, `status_id NULL` 3 дні тому 20.00, «нове» 8 днів тому 7.00, 31 день тому 1000.00 → `newOrders: 2`, `revenue7dCents: 12000`, `revenue30dCents: 12700`. Кожне число звірено з прямим SQL у тому ж тесті (спека «Що етап доводить» п.3). `newStatusId` = id статусу з кодом `new`. `recentOrders` стертого замовлення → `customerName: null`, `erased: true`.
  - Run → FAIL.
- [ ] **Step 2: Реалізація** за Interfaces; експорти з `impl/index.ts`, serverFn в `index.ts`, мок.
- [ ] **Step 3: Зелене** — `pnpm test:schema && pnpm lint && pnpm typecheck && pnpm test && pnpm build:packages` → PASS. Негативний контроль: прибрати `id` з keyset (лише `created_at`) → кейс однакових `created_at` червоніє; відкотити.
- [ ] **Step 4: Коміт** — `feat(k3-e6g): серверні читання покупців і дашборду`.

---

## Task 4: Роль адміна (Г-3, Е6г-3, Е6г-4, Е6г-11, Е6г-19)

**Files:**
- Create: `auth/admin-roles-lock.ts` (експорт з `simplycms/auth`), `admin-server/impl/customers/{roles,guards}.ts`, харнес `admin-customer-roles.test.ts`, `owner-invite-ban.test.ts`
- Modify: `auth/{invite,invite-store}.ts` (Е6г-19), `auth/__tests__/invite.test.ts`, `tests/owner-invite.test.ts` (фейки store), CLI-команда `owner:invite` (повідомлення `banned`), `auth/authz.ts` (+`customer.delete`), `contracts/domain-errors.ts`, `admin/lib/admin-error.ts`, i18n `admin/errors.ts`, `admin-server/{index,impl/index}.ts`, мок

**Interfaces:**
- `ADMIN_ROLES_LOCK = 'admin-roles'` у `auth/admin-roles-lock.ts` (Е6г-19).
- `OwnerInviteStore.issueAdminInvite(input: { userId: string; identifier: string; valueHash: string; expiresAt: Date }): Promise<'issued' | 'banned'>` замість `storeToken` + `grantAdminRole`; `issueOwnerInvite` на `'banned'` кидає `OwnerInviteError` з кодом `banned` і URL не повертає.
- `customer.delete` у `Operation` і `AUTHZ_MATRIX` як `{ admin: 'any' }` (споживає Task 7).
- `guards.ts`: `isAdminUser(db: ActorDb, userId: string): Promise<boolean>`, `countAdmins(db: ActorDb): Promise<number>` — спільні для Task 4, 5 і 7.
- `setAdminRoleInput = z.object({ userId: z.uuid(), admin: z.boolean() })`; `setAdminRoleOp → Promise<{ isAdmin: boolean }>` під `runAdmin('user.role.assign')`. `advisoryXactLock(db, ADMIN_ROLES_LOCK)` — першим запитом. Далі:
  - зняття з себе (`userId === grant.subject.userId`) → `admin_role_self`;
  - зняття, коли `countAdmins = 1` → `admin_role_last`;
  - видача забаненому → `admin_role_banned`;
  - видача — `insert user_roles { id: randomUUID(), role: 'admin' } on conflict do nothing`; зняття — `delete … where role = 'admin'` (рядок `user` не чіпається). Повтор того самого стану — no-op без помилки.
- Нові state-коди (КАНОН): `admin_role_self`, `admin_role_last`, `admin_role_banned`. Тексти: `admin.errors.adminRoleSelf` — «Не можна зняти роль адміністратора із себе»; `admin.errors.adminRoleLast` — «Це останній адміністратор — роль зняти не можна»; `admin.errors.adminRoleBanned` — «Спершу розблокуйте покупця».
- serverFn (POST): `setAdminRole`.

- [ ] **Step 1: Харнес (червоний).** Видача → рядок `admin`; повтор → без помилки й без дубля. Зняття з себе → `admin_role_self`, роль на місці. Єдиний адмін знімає роль з іншого не-адміна → no-op; два адміни, A знімає роль з B → OK, B знімає з A → `admin_role_last`. Видача забаненому → `admin_role_banned`. **Лок:** зовнішнє зʼєднання тримає `holdAdvisoryLock(url, 'admin-roles')` → `setAdminRoleOp` `stillPending` → `release` → завершилась. **Гонка без лока (Review Focus «додатково»):** A і B — адміни; зовнішнє зʼєднання тримає лок; запустити `A знімає B` і `B знімає A` → обидві `stillPending` → `release` → рівно одна OK, друга `admin_role_last`, адмінів 1. **Наступний запит (Е6г-3):** після зняття ролі `readSessionSubject` для сесії B (реальна сесія з `auth-integration`-фікстур) повертає `roles` без `admin`, а `requireGrant('admin.access')` → `AuthzError`. **Invite (Е6г-19), харнес `owner-invite-ban.test.ts`:** повторний invite на email забаненого → відмова `banned`, ролі `admin` і рядка `owner-invite:<email>` немає; незабаненому → роль і токен є; зовнішній клієнт тримає `admin-roles` → `issueAdminInvite` `stillPending` → `release` → завершився; бан ↔ invite: окремий клієнт (`app_runtime` + `set local role app_admin`) бере `admin-roles` і ставить `banned_at` без коміту → invite `stillPending` → commit → invite повертає `banned`, ролі немає. Юніти `invite.test.ts`/`owner-invite.test.ts` — на новий метод store. Run → FAIL.
- [ ] **Step 2: Реалізація** за Interfaces.
- [ ] **Step 3: Зелене** + негативні контроли: прибрати лок з `issueAdminInvite` → червоніє кейс «зовнішній клієнт тримає `admin-roles` → `stillPending`» (кейс «бан ↔ invite» для цієї мутації не годиться: конкурентний `UPDATE users` сам блокує `FOR SHARE`, аудит Codex р5). 🔴 Коментар у тесті (КАНОН): лок потрібен для ЗВОРОТНОГО порядку «invite першим». Invite взяв `FOR SHARE` і вставив роль без коміту; бан без лока не бачить незакоміченої ролі, чекає на рядку `users`, а після коміту забанює вже адміна. `FOR SHARE` цього не закриває, тож лок не «зайвий»; прибрати `advisoryXactLock` у `setAdminRoleOp` → кейс «гонка» червоніє (обидва зняття проходять, адмінів 0); відкотити. Вивід у звіт.
- [ ] **Step 4: Коміт** — `feat(k3-e6g): роль адміна з картки покупця`.

---

## Task 5: Блокування входу (Г-4, Е6г-4, Е6г-13, Е6г-14)

**Files:**
- Create: `auth/ban.ts`, `admin-server/impl/customers/ban.ts`, харнес `{admin-customer-ban,auth-ban}.test.ts`, юніт `auth/__tests__/ban.test.ts`
- Modify: `migrations/0001_init.sql` (функція `refuse_banned_session()` і тригер `sessions_refuse_banned`, Е6г-14) + копії `pnpm template:sync`, `test-harness/pg/__tests__/baseline.test.ts` (тригер існує на `sessions`); `auth/instance.ts` (`databaseHooks.session.create.before`, `AuthDeps.isUserBanned?`), `storefront-routes/pages/Auth.tsx`, `checkout-ui/CheckoutAuthBlock.tsx` (свій вхід, `:54-69`; гілка `BANNED` обовʼязкова — інакше там покажеться сире `error.message`), `contracts/domain-errors.ts`, `admin/lib/admin-error.ts`, i18n `auth.ts`, `admin/errors.ts`, `admin-server/{index,impl/index}.ts`, мок

**Interfaces:**
- `createSessionBanHook(isBanned: (userId: string) => Promise<boolean>): (session: { userId: string }) => Promise<void>` — на забаненому кидає `APIError.from('FORBIDDEN', { code: 'BANNED', message: 'Account is banned' })` (імпорт з `better-auth/api`). `isUserBannedInDb(userId)` — `withActor({ role: 'app_admin' })`, `select banned_at from users`.
- `setCustomerBanInput = z.object({ userId: z.uuid(), banned: z.boolean(), reason: z.string().trim().max(500).optional() })`; `setCustomerBanOp → Promise<{ bannedAt: Date | null }>` під `customer.manage`. `ADMIN_ROLES_LOCK` першим запитом; адмін → `customer_is_admin`. Бан — `banned_at = now()`, `ban_reason`, `delete from sessions where user_id = $1`, все в ОДНІЙ транзакції. Зняття — `banned_at = NULL`, `ban_reason = NULL`.
- Тригер (КАНОН Е6г-14): `refuse_banned_session()` — `plpgsql`, без `SECURITY DEFINER`; `select banned_at into v from users where id = new.user_id for share` — БЕЗ умови на `banned_at` у `WHERE` (аудит Codex р2 №1: з умовою `READ COMMITTED` бачить стару версію рядка з `NULL`, рядок не проходить фільтр, і `FOR SHARE` його не блокує), і лише потім `if v is not null then raise exception 'user % is banned', new.user_id`. Коментар над тригером пояснює, навіщо він поруч із хуком і чому в гонці клієнт бачить загальну помилку. Якщо під роллю proxy `FOR SHARE` відмовляє (`42501`) — зупинка й ескалація, а не `SECURITY DEFINER`.
- Новий state-код (КАНОН): `customer_is_admin` — `admin.errors.customerIsAdmin` «Спершу зніміть роль адміністратора».
- Вітрина: `error.code === 'BANNED'` → тост `t('auth.login.banned', …)` з `useStoreProfile().contacts.{phone,email}`. Відсутній контакт не показується.
- i18n (КАНОН): `auth.login.banned` — «Акаунт заблоковано. Звʼяжіться з магазином» + контакти (синтаксис параметрів — як у каталозі) / «Your account is blocked. Please contact the store».
- serverFn (POST): `setCustomerBan`.

- [ ] **Step 1: Тести (червоні).**
  - Юніт `ban.test.ts`: memory-адаптер + `isUserBanned: async () => true`, реальний `auth.handler`, `POST /sign-in/email` → статус 403, у JSON-тілі `code === 'BANNED'`. Через `authClient` (fetch на handler) — `error.code === 'BANNED'`. Це доказ Е6г-13. Незабанений вхід → 200.
  - Харнес `admin-customer-ban.test.ts`: у покупця дві сесії; бан → `sessions` порожні, `banned_at` стоїть, `ban_reason` записано; адмін → `customer_is_admin`, сесії на місці; зняття → `banned_at NULL`; лок (`holdAdvisoryLock('admin-roles')` → `stillPending`).
  - Харнес `admin-customer-ban.test.ts`, **тригер, обидва порядки (детерміновано, окремі `pg.Client`, підключені як `app_runtime`, після `begin` — `set local role app_admin`, бо `app_admin` — `nologin`, `0000_prelude.sql:74`):** (1) клієнт B робить `begin; update users set banned_at = now() where id = $1` і не комітить → клієнт A робить `insert into sessions (…)` для цього користувача: `stillPending` = true → B `commit` → вставка A падає з винятком тригера, сесій 0. (2) Клієнт A робить `begin; insert into sessions …` і не комітить → `setCustomerBanOp`: `stillPending` = true → A `commit` → бан завершився, сесій 0 (його `DELETE` побачив сесію A). Незабанений → вставка проходить.
  - Харнес `auth-ban.test.ts` (патерн `auth-integration.test.ts`, реальна БД): забанений → вхід 403 `BANNED`, нової сесії немає; скидання пароля (`requestPasswordReset` → токен з `verifications` → `resetPassword`) → 200, сесії немає, потім вхід → `BANNED` (Review Focus 4); після бану `getSession` зі старою cookie → `null`; зняття бану → вхід 200.
  - Рендер-тести `Auth.tsx` і `CheckoutAuthBlock.tsx`: `signIn.email` повертає `{ error: { code: 'BANNED', message: 'Account is banned' } }` → перекладений текст бану з телефоном магазину; рядка `Account is banned` у DOM немає.
  - Run → FAIL.
- [ ] **Step 2: Реалізація** за Interfaces.
- [ ] **Step 3: Зелене** + негативні контроли (вивід у звіт): (0) перенести умову `banned_at is not null` у `WHERE` тригера → кейс тригера (1) червоніє (вставка не чекає); (а) прибрати `delete from sessions` → кейс «сесії порожні» й `getSession` червоніють; (б) хук повертає `false` замість `throw` → юніт червоніє на `code`; (в) прибрати тригер → кейс тригера (1) червоніє: сесія вставилась після бану. Відкотити.
- [ ] **Step 4: Коміт** — `feat(k3-e6g): блокування входу покупця`.

---

## Task 6: Контакти й email (Г-4, Г-8, Е6г-1, Е6г-2, Е6г-18)

**Files:**
- Create: `admin-server/impl/customers/{contacts,verifications}.ts`, харнес `admin-customer-contacts.test.ts`
- Modify: `auth/instance.ts` (guard Е6г-18 у `sendResetPassword`, винесений у `auth/reset-guard.ts`: `isResetStillValid(userId: string, emailSnapshot: string, token: string): Promise<boolean>`, який сам видаляє токен на `false`; підміна — `AuthDeps.resetGuard?`), `contracts/domain-errors.ts` (`'taken'` у `VALIDATION_ISSUE_CODES`), `admin/lib/apply-server-validation.ts` (`taken` у `KEYS`, який `satisfies Record<ValidationIssueCode, MessageKey>` — без запису червоніє `typecheck`), `admin-server/impl/validation.ts`, i18n `admin/validation`, `admin-server/{index,impl/index}.ts`, мок

**Interfaces:**
- `fieldIssue(path: readonly (string | number)[], code: ValidationIssueCode): never` у `impl/validation.ts` — `setResponseStatus(400)` + `throw new ValidationError([{ path, code }])`.
- `revokeUserVerifications(db: ActorDb, { userId, email }: { userId: string; email: string }): Promise<number>` — Е6г-2; ідентифікатор invite — через `inviteIdentifier` з `simplycms/auth`, не літералом.
- `updateCustomerContactsInput = z.object({ userId: z.uuid(), firstName: z.string().trim().min(1).max(100), lastName: z.string().trim().max(100).nullable(), phone: z.string().trim().max(30).nullable(), email: z.string().trim().pipe(z.email()) })` (`z.email()` сам крайових пробілів не прибирає й відхиляє ` Buyer@x.test `); `updateCustomerContactsOp → Promise<{ email: string }>` під `customer.manage`. Одна транзакція:
  - `users … FOR UPDATE`; email нормалізується;
  - якщо email змінився: існує інший `lower(email)` → `fieldIssue(['email'], 'taken')`; інакше `users.email`, `email_verified = false`, `revokeUserVerifications(db, { userId, email: <старий> })`;
  - `users.name = [firstName, lastName].filter(Boolean).join(' ')`;
  - `profiles.first_name/last_name/phone/email` (профілю немає → створити з `id: randomUUID()`);
  - `23505 users_email_key` → `fieldIssue(['email'], 'taken')`;
  - сесії не чіпаються.
- i18n (КАНОН): `admin.validation.taken` — «Таке значення вже використовується» / «This value is already in use».
- serverFn (POST): `updateCustomerContacts`.

- [ ] **Step 1: Харнес (червоний).** Зміна контактів → `profiles` і `users.name`. Зміна email → `users.email` у нижньому регістрі, `email_verified = false`, сесії на місці. `reset-password:<t>` з `value = userId` і `owner-invite:<старий>` видалені, а чужий `reset-password` — ні. Зайнятий `Buyer@Shop.test` при наявному `buyer@shop.test` → `ValidationError`, `issues = [{ path: ['email'], code: 'taken' }]`, статус 400, у БД нічого не змінилось (Review Focus 1). Власний email в іншому регістрі → OK, записано нижній. Вхід ` Buyer@X.test ` (пробіли) → записано `buyer@x.test`. **Гонка `23505` (детерміновано):** окремий `pg.Client` робить `begin; insert into users (…, email) values (…, 'race@x.test')` і НЕ комітить → операція зміни email на `race@x.test` проходить перевірку (READ COMMITTED не бачить чужої вставки) і блокується на унікальному індексі: `stillPending` = true → клієнт робить `commit` → операція завершується `ValidationError` `taken` на `email` (саме гілка `users_email_key`, не перевірка), у покупця старий email. **Наскрізний доказ Е6г-2:** покупець просить скидання (`requestPasswordReset`), адмін змінює email, `resetPassword` зі старим токеном → `INVALID_TOKEN`. **Guard скидання (Е6г-18), харнес на реальному `auth.handler`:** (1) окремий клієнт тримає незакомічений `update users set email = 'new@x.test'` → `requestPasswordReset('old@x.test')`: `stillPending`, і `pg_blocking_pids` доводить, що чекає саме guard на `users` (а не інший запит BA) → commit → рядка `reset-password:*` з `value = userId` немає, `sendEmail` не викликано; (2) те саме з незакоміченим `delete from users` → токена немає, листа немає; (3) без конкурента → токен є, лист пішов. Run → FAIL.
- [ ] **Step 2: Юніт** `domain-errors.test.ts`: `sanitizeValidationIssues` пропускає `taken`; повнота `admin.validation.<code>` (наявний тест) червоніє без ключа.
- [ ] **Step 3: Реалізація** за Interfaces.
- [ ] **Step 4: Зелене** + негативні контроли: прибрати виклик `revokeUserVerifications` → наскрізний кейс червоніє (скидання старим токеном проходить); прибрати guard Е6г-18 → кейс (1) червоніє (токен живий, лист пішов); прибрати `for share` з guard-а, лишивши порівняння email → кейс (1) червоніє (guard читає стару закомічену версію й пропускає токен). Відкотити.
- [ ] **Step 5: Коміт** — `feat(k3-e6g): контакти й email покупця`.

---

## Task 7: Видалення акаунта (Г-4, Г-5, Г-6, Е6г-2, Е6г-4, Е6г-7, Е6г-15…Е6г-17)

**Files:**
- Create: `admin-server/impl/customers/delete.ts`, харнес `admin-customer-delete.test.ts`
- Modify: `admin-server/impl/order-items/editable.ts` (гвард Е6г-16 у `lockEditableOrder`), `admin/features/orders/detail/useOrderLocked.ts` (+ `personalDataErasedAt`, і виклики), `contracts/domain-errors.ts`, `admin/lib/admin-error.ts`, i18n, `admin-server/{index,impl/index}.ts`, мок

**Interfaces:**
- Споживає: `eraseOrderPersonalData` (Task 2), `isAdminUser` (Task 4), `ADMIN_ROLES_LOCK` (`simplycms/auth`, Task 4), state-код `customer_is_admin` (Task 5), `revokeUserVerifications`, `fieldIssue` (Task 6), `customerCategoryLock` (`simplycms/commerce`), `eraseMedia(db, ref, driver?)` (`simplycms/storage`).
- `deleteCustomerInput = z.object({ userId: z.uuid(), confirmEmail: z.string().trim() })`; `deleteCustomerOp → Promise<{ erasedOrders: number; anonymizedReviews: number }>` під `runAdmin('customer.delete', …)`, ОДНА транзакція в порядку Е6г-15:
  1. `advisoryXactLock(customerCategoryLock(userId))` → `advisoryXactLock(ADMIN_ROLES_LOCK)`;
  2. `users` і `profiles … FOR UPDATE`;
  3. перевірки: користувач існує (`customer_not_found`), не актор (`customer_self`), не адмін (`customer_is_admin`), `lower(confirmEmail) = users.email` (інакше `fieldIssue(['confirmEmail'], 'invalid_value')`);
  4. прочитати ref аватара (`profiles.avatar_url`);
  5. `eraseOrderPersonalData(db, userId, now)` → `update product_reviews set user_id = NULL where user_id = $1` → `revokeUserVerifications(db, { userId, email })` → `delete from users where id = $1`;
  6. якщо ref є — `eraseMedia(tx, ref)` ОСТАННІМ кроком (усередині: DELETE рядка `media` → файл; Е6г-15, уточнено в раунді 2).
- `lockEditableOrder`: після гварда «скасоване» — `order.personalDataErasedAt !== null` → `stateConflict(order_personal_data_erased)`. `useOrderLocked` повертає `true` і для стертого замовлення.
- Нові state-коди (КАНОН): `customer_not_found`, `customer_self`, `order_personal_data_erased`. Тексти: `admin.errors.customerNotFound` — «Покупця не знайдено»; `admin.errors.customerSelf` — «Не можна видалити власний акаунт»; `admin.errors.orderPersonalDataErased` — «Покупця видалено — позиції замовлення змінити не можна».
- serverFn (POST): `deleteCustomer`.

- [ ] **Step 1: Харнес (червоний).**
  - **Успіх:** покупець з 3 замовленнями (адреса, точка, `{}`), відгуком (рейтинг 4), аватаром (рядок `media` + файл у тимчасовому `MEDIA_ROOT`), адресою, історією, сесією і `reset-password` → `{ erasedOrders: 3, anonymizedReviews: 1 }`. Після цього: `users` немає; замовлення є з сумами й позиціями, ПД `NULL`, `access_token NULL`, `personal_data_erased_at` стоїть; відгук є, `user_id NULL`, середній рейтинг товару той самий; файла й рядка `media` немає; сиріт немає (запит з Task 2); `verifications` користувача немає.
  - **Відмови:** адмін → `customer_is_admin`, файл аватара цілий. Себе → `customer_self`. Невірний `confirmEmail` → `ValidationError` на `confirmEmail`. Неіснуючий → `customer_not_found`.
  - **Роль видана під час видалення (аудит Codex №2, детерміновано):** окремий `pg.Client`, підключений як `app_runtime` (не `holdAdvisoryLock`: той не дає виконати `INSERT` у своїй транзакції), робить `begin; set local role app_admin; select pg_advisory_xact_lock(hashtextextended('admin-roles', 0)); insert into user_roles (id, user_id, role) values (…, 'admin')` і не комітить → `deleteCustomerOp`: `stillPending` = true, і В ЦЕЙ МОМЕНТ файл аватара на місці → клієнт `commit` → операція падає з `customer_is_admin`, файл і рядок `media` цілі, покупець є.
  - **Обрив (Review Focus 3):** `vi.spyOn(getMediaDriver(), 'delete').mockRejectedValueOnce(…)` (драйвер кешований, параметр `driver?` операції не потрібен), тобто `delete` кидає один раз → операція падає, транзакція відкотилась: покупець є, ПД замовлень на місці, `user_id` відгуку на місці, рядок `media` є. Повтор зі справним драйвером → успіх. Окремо: файла вже немає, рядок `media` є → успіх (`ENOENT`). Покупець без аватара → успіх.
  - **Лок:** зовнішнє зʼєднання тримає `customer-category:<id>` → `stillPending`; окремо тримає `admin-roles` → `stillPending`.
  - **Е6г-16:** після видалення `updateOrderItemQuantityOp` стертого замовлення → 409 `order_personal_data_erased`, суми й позиції не змінились, ПД `NULL`; `changeOrderStatus` на «скасоване» → OK. Рендер-тест: картка стертого замовлення не показує контролів редагування позицій.
  - **Е6г-17:** старий `access_token` стертого замовлення → `withOrderTokenDb` + `loadOrderDetail` повертає `null`.
  - Run → FAIL.
- [ ] **Step 2: Реалізація** за Interfaces.
- [ ] **Step 3: Зелене** + негативні контроли (вивід у звіт): (а) прибрати виклик `eraseOrderPersonalData` → кейс «ПД NULL» червоніє (FK `SET NULL` лишає ПД із `user_id NULL`, тому сітка безпеки не заміняє явний крок); (б) винести `eraseMedia` в окрему транзакцію перед локами (стара схема) → кейс «роль видана під час видалення» червоніє: файла вже немає, поки операція чекає; (в) прибрати гвард Е6г-16 → кейс `updateOrderItemQuantityOp` червоніє. Відкотити.
- [ ] **Step 4: Коміт** — `feat(k3-e6g): видалення акаунта зі знеособленням`.

---

## Task 8: Дашборд і фільтр замовлень у URL (Г-1, Г-7, Е6г-5)

**Files:**
- Create: `admin/features/dashboard/**` (`DashboardPage.tsx`, `useDashboardSummary.ts`, картки, `__tests__/`)
- Modify: `admin/pages/Dashboard.tsx` (реекспорт), `routes/admin/admin/orders/index.tsx` (`validateSearch`), `admin/features/orders/list/OrdersPage.tsx`, `tests/admin-server-first/registry.ts` (−`Dashboard`), i18n `admin/dashboard.ts` (−лічильники)

**Interfaces:**
- Споживає `dashboardSummary`, `AdminDashboardStats` (Task 3), `CORE_VERSION` (`simplycms/contracts/semver`).
- Ключ: `entityKey(ENTITY.orders).variant('admin-dashboard')`.
- Сторінка: картка «Нові замовлення» (посилання `/admin/orders?status=<newStatusId>`, без посилання, якщо `null`), «Виручка за 7 днів», «Виручка за 30 днів» (`useFormatPrice`), таблиця 10 останніх (рядок веде на `/admin/orders/$orderId`; стерте — «Видалений покупець»; назва статусу — з наявної eager-колекції статусів). Швидкі дії лишаються. Блок «про систему» — лише `CORE_VERSION`. Слоти: `admin.dashboard.stats` з `context={{ stats }}`, де `stats: AdminDashboardStats`, і `admin.dashboard.widgets`.
- `/admin/orders`: `validateSearch` → `{ status?: string }` (uuid, невалідне → відсутнє); `OrdersPage` читає й пише фільтр через `useSearch`/`navigate`, локального `useState` немає.

- [ ] **Step 1: Рендер-тести (червоні):** дашборд з моком `dashboardSummary` → три числа, 10 рядків, посилання на фільтр містить `status=<id>`, стерте замовлення показує «Видалений покупець»; слот отримує `stats` рівно `{ newOrders, revenue7dCents, revenue30dCents }`; `OrdersPage` з `?status=<id>` фільтрує, а зміна фільтра оновлює URL; `?status=abc` → без фільтра.
- [ ] **Step 2: Реалізація.** `wc -l` нових файлів у звіт.
- [ ] **Step 3: Зелене** — `pnpm lint && pnpm typecheck && pnpm test` → PASS; `rg -l useSupabaseClient packages/simplycms/src/admin | wc -l` → 8.
- [ ] **Step 4: Коміт** — `feat(k3-e6g): дашборд на серверному шарі`.

---

## Task 9: Список покупців (Г-4, Е6г-6)

**Files:**
- Create: `admin/features/customers/list/**` (`CustomersPage.tsx`, `useCustomersList.ts`, `CustomersFilters.tsx`, `CustomersTable.tsx`, `__tests__/`)
- Modify: `admin/pages/Users.tsx` (реекспорт), `tests/admin-server-first/registry.ts` (−`Users`), i18n `admin/users.ts`

**Interfaces:**
- `useCustomersList(filters)` — `useInfiniteQuery` з ключем `[...entityKey(ENTITY.profiles).variant('admin-customers'), filters]`, `getNextPageParam: (p) => p.nextCursor ?? undefined`. Пошук — з debounce, не раніше 2 символів.
- Рядок: імʼя (або email), email, категорія, кількість і сума замовлень, бейдж «Адмін», бейдж «Заблоковано». Клік → `/admin/users/$userId`. Кнопка «Показати ще» — як `/admin/orders`.

- [ ] **Step 1: Рендер-тести (червоні):** перша сторінка + «Показати ще» викликає `listCustomers` з `cursor` попередньої. Для КОЖНОГО контрола окремий кейс з асертом на аргумент serverFn і скинутий курсор: пошук (1 символ → `search` відсутній; 2 → передано), категорія → `categoryId`, роль → `role: 'admin' | 'customer'`, «заблоковані» → `banned: true`. Бейджі; порожній стан.
- [ ] **Step 2: Реалізація.** `wc -l` у звіт.
- [ ] **Step 3: Зелене** — `pnpm lint && pnpm typecheck && pnpm test` → PASS.
- [ ] **Step 4: Коміт** — `feat(k3-e6g): список покупців`.

---

## Task 10: Картка покупця — перегляд, категорія, контакти (Г-4, Г-8)

**Files:**
- Create: `admin/features/customers/card/**` (`CustomerCardPage.tsx`, `useCustomerCard.ts`, `CustomerInfoCard.tsx`, `CustomerStatsCard.tsx`, `CustomerCategoryCard.tsx`, `CustomerHistoryList.tsx`, `CustomerContactsForm.tsx`, `CustomerRecentOrders.tsx`, `__tests__/`)
- Modify: `admin/pages/UserEdit.tsx` (реекспорт), i18n `admin/users.ts`

**Interfaces:**
- Ключ картки: `entityKey(ENTITY.profiles).variant('admin-customer', userId)`. Після будь-якої мутації — `invalidateQueries({ queryKey: [ENTITY.profiles] })` у тій самій функції (Е6г-6).
- Категорія: селект категорій + перемикач «Закріпити вручну» + причина → `assignCustomerCategory({ userId, categoryId, reason, locked })` (закриває К3-Е6в-4).
- Контакти: форма RHF + Zod → `updateCustomerContacts`; помилка через `applyServerValidation` (поле email показує `admin.validation.taken`).
- Останні замовлення: наявна `ordersCollection` з `eq(o.userId, userId)`, 10 рядків, посилання на картку замовлення.
- Аватар — лише перегляд, ref → URL через `resolveMediaUrl` з `simplycms/domain/media` (як `admin/features/catalog-dictionaries/MediaThumb.tsx`). `simplycms/storage` — server-only, з клієнта його не імпортувати. Рендер-тест перевіряє `src` аватара.

- [ ] **Step 1: Рендер-тести (червоні):** картка з моком `getCustomerCard` (провайдери, UTM, історія з «правило»/email адміна); `stats: null` → «—»; `null` картка → «не знайдено»; збереження контактів з `ValidationError taken` → повідомлення під email, тосту немає; закріплення категорії викликає `assignCustomerCategory` з `locked: true` і інвалідовує `[profiles]`.
- [ ] **Step 2: Реалізація.** `wc -l` у звіт.
- [ ] **Step 3: Зелене** — `pnpm lint && pnpm typecheck && pnpm test` → PASS.
- [ ] **Step 4: Коміт** — `feat(k3-e6g): картка покупця — категорія й контакти`.

---

## Task 11: Картка покупця — роль, бан, видалення (Г-3, Г-4, Г-5)

**Files:**
- Create: `admin/features/customers/card/{CustomerAccessCard,CustomerBanDialog,CustomerDeleteDialog}.tsx`, `__tests__/`
- Modify: `CustomerCardPage.tsx`, `tests/admin-server-first/registry.ts` (−`UserEdit`), `tests/admin-inserts-need-id.test.ts` (ратчет, якщо число впало), i18n `admin/users.ts`

**Interfaces:**
- Роль — `Switch` → `setAdminRole`; помилка — `adminErrorKey` → тост. Перемикач вимкнений для себе й для забаненого (сервер однаково відмовляє).
- Бан — діалог із причиною (внутрішня примітка) → `setCustomerBan`. Для адміна кнопки немає, є підказка «Спершу зніміть роль адміністратора». Банер «Заблоковано з <дата>» з кнопкою «Розблокувати».
- Видалення — `AlertDialog`; кнопка активна, лише коли введений email збігається з карткою (без урахування регістру). Після успіху: `invalidateQueries([profiles])`, `ordersCollection.utils.refetch()`, перехід на `/admin/users`, тост.

- [ ] **Step 1: Рендер-тести (червоні):** перемикач ролі шле `{ admin: false }`; 409 `admin_role_last` → тост «останній адміністратор»; кнопки бану й видалення немає для адміна; кнопка видалення неактивна з іншим email; успішне видалення → навігація і `refetch` колекції замовлень.
- [ ] **Step 2: Реалізація.** `wc -l` у звіт.
- [ ] **Step 3: Зелене** — `pnpm lint && pnpm typecheck && pnpm test` → PASS; `rg -l useSupabaseClient packages/simplycms/src/admin | wc -l` → **6**.
- [ ] **Step 4: Коміт** — `feat(k3-e6g): роль, бан і видалення з картки покупця`.

---

## Task 12: Живий прогін, доки, повний ланцюг

**Files:**
- Create: `scripts/live-smoke/admin-customers{,-setup,-owner,-roles,-ban,-delete,-sql,-cleanup}.mjs` (`runAdminCustomersStep({ context, buyerPage, base, dbUrl, check })`)
- Modify: `scripts/live-smoke/owner-steps.mjs` (крок після знижок, ПЕРЕД «системою»), `scripts/live-smoke/register.mjs` (експорт пароля); доки: `docs/architecture/data-layer.md` (§10 — прецедент `taken`, Е6г-1; §13 — `admin-roles` (живе в `simplycms/auth`, його беруть і операції адмінки, і invite власника — Е6г-19) і порядок `customer-category:<userId>` → `admin-roles`, Е6г-4; поруч — клас «рішення BA окремими транзакціями» і два його закриття: тригер `sessions_refuse_banned` (Е6г-14) і guard `sendResetPassword` (Е6г-18); рядок про invite: лок `admin-roles` в `issueAdminInvite` закриває порядок «invite першим» (роль без коміту невидима для бану), а `FOR SHARE` — лише «бан першим», тож одне не заміняє другого; новий §14 «Покупці: роль, бан, видалення» — бан у хуку, тригер `sessions_refuse_banned` (Е6г-14) і видалення сесій, порядок `deleteCustomer` (Е6г-15), стерте замовлення не редагується (Е6г-16), реєстр ПД `orders`, `revokeUserVerifications`, FK-граф, межі «гостьове замовлення — не акаунт» і «бан блокує обліковий запис, а не особу: гостьове оформлення він не зупиняє»), `docs/architecture/plugins.md` (форма `context.stats`), `docs/tasks/v2-state-map.md` (легасі 6), `docs/tasks/platform-roadmap.md` (статус; борги: стирання гостьових замовлень за email, тимчасовий бан, ролі й запрошення персоналу, самостійне видалення й зміна email у кабінеті, модерація відгуків з `user_id IS NULL` — Е6д), `CHANGELOG.md`

**Interfaces:**
- Крок створює все сам і прибирає в `finally`. Покупці реєструються через `register(page, base)`, у кожного свій `browser.newContext()`.
- **Контакти й email.** Власник знаходить покупця A пошуком, змінює імʼя й email → A виходить і входить з новим email.
- **Категорія.** Власник закріплює категорію A вручну → A оформлює замовлення → SQL: категорія незмінна попри автоправило з Е6в (або тимчасове правило з прибиранням).
- **Роль.** Власник видає роль покупцю B → B відкриває `/admin` (200). Власник знімає роль → наступний `GET /admin` для B дає редірект на `/`, а виклик serverFn адмінки з контексту B — 403.
- **Бан.** Власник банить B → відкрита вкладка B після перезавантаження гостьова, `GET /admin` → `/auth`; вхід B → текст бану.
- **Видалення.** A залишає відгук і має замовлення → власник видаляє A (вводить email) → SQL: замовлення є, ПД і `access_token` `NULL`, адреса знімка стерта; відгук є з `user_id NULL`; вітрина показує «Колишній покупець»; вхід A неможливий; сиріт немає (запит з Task 2).
- **Дашборд.** Числа на сторінці = прямий SQL на демо-даних.
- Прибирання (`finally`): розбанити й видалити B через SQL (`delete from users`, каскади), тимчасові правила й категорії — як в Е6в. Тестові замовлення лишаються.

- [ ] **Step 1: Крок `live:smoke`** — Run: `pnpm live:smoke` → 0 FAIL; вивід цілком — у «Факти виконання».
- [ ] **Step 2: Негативні контроли** — у `setCustomerBanOp` тимчасово прибрати `delete from sessions` → крок червоніє на «вкладка B гостьова»; у `deleteCustomerOp` прибрати `eraseOrderPersonalData` → червоніє на «ПД NULL». Вивід у звіт; відкотити.
- [ ] **Step 3: Регрес** — пари «підпис | результат» рядків попередніх кроків ідентичні прогону Е6в (`diff` порожній, крім нових рядків).
- [ ] **Step 4: Лічильники й гейти** — `rg -l useSupabaseClient packages/simplycms/src/admin | wc -l` → **6**; `rg -n "Dashboard|Users|UserEdit" tests/admin-server-first/registry.ts` → порожньо; гейт-греп Е6г-9 → два рядки allowlist (вивід у звіт).
- [ ] **Step 5: Доки** за Files.
- [ ] **Step 6: Повний ланцюг** (Global Constraints) → усі PASS; коміт — `docs(k3-e6g): живий прогін покупців і дашборду, канон, changelog`.

## DoD етапу Е6г

1. `pnpm live:smoke` зелений із кроком покупців; обидва негативні контроли Task 12 червоні.
2. Повний ланцюг гейтів зелений; `pnpm lint` = 0 errors / 7 warnings.
3. `useSupabaseClient` у `src/admin/**` — 6 файлів; `Users`, `UserEdit`, `Dashboard` у реєстрі легасі відсутні.
4. Гейт-греп «Послуг» (Е6г-9) — лише allowlist.
5. Review Focus 1–5 закриті тестами, названими в задачах; негативні контроли Task 2, 4, 5, 6, 7 червоніли (вивід у звітах).
6. Фінальне рев'ю гілки архітектором; коміти без трейлерів (`git log --format=%B a4e9bf1a^..HEAD | grep -ciE "co-authored|generated with"` = 0).

## Точка передачі

Після Е6г — хвиля «контент» (`Banner*`, `Review*`; модерація відгуків враховує `user_id IS NULL`), далі Е7 (знос `LegacySupabaseBoundary` і `src/supabase/`) → Е8. Тимчасовий бан, ролі й запрошення персоналу — беклог, операції `customer.delete` і `user.role.assign` уже розділені під них.
