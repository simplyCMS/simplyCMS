# Task: Готовність ядра до adoption у MetaHub HUB (домен «Продукти»)

> Статус: **open**. Створено 2026-06-11.
> Дизайн-першоджерело: [`docs/architecture/core-engine-extraction.md`](../architecture/core-engine-extraction.md).
> Загальний стан екстракції: [`core-engine-extraction-implementation.md`](./core-engine-extraction-implementation.md).
> Парна задача на боці споживача: `metahub/docs/tasks/products-domain-simplycms-integration.md`.

## Мета

Виокремити з великої extraction-задачі **мінімальну підмножину**, яка
розблоковує перший зовнішній adoption: MetaHub HUB бере «тільки товарні
механізми» (профіль «HUB Продукти» з дизайн-доку §4) з поставкою через
GitHub. Усе, що стосується Marketplace (storefront/`*-ui`/runtime-wiring),
свідомо **поза скоупом** цієї задачі.

## Що вже готово (не чіпати)

- `@simplysoftua/objects` (T0) — контракти + порти, 0 runtime deps (P1 ✅).
- `@simplysoftua/domain` (T1) — pure pricing/discounts/inventory/shipping,
  27 unit-тестів (P2 ✅).
- Singleton `supabase` знесено, DI через `SupabaseProvider` (P3 ✅).
- Build/publish: tsup + `publish-packages.yml` для T0/T1/T2 (P10 ✅).
- Subtree-флоу `cms:remote`/`cms:pull`/`cms:push` робочий.

## Чекліст готовності (скоуп цієї задачі)

### 1. Канал поставки: GitHub Packages (рішення оновлено 2026-06-12)

**Рішення власника: публікуємо в GitHub Packages одразу; subtree для
зовнішніх споживачів не використовується** (внутрішній subtree-флоу
simplyCMS-app ↔ simplyCMS-core `cms:pull/push` лишається без змін).

- [x] **Rename scope зі старого `@simplycms` на `@simplysoftua`** (вимога
      GitHub Packages «scope = власник»; зафіксовано власником
      2026-06-12). Обсяг: `name` у package.json усіх workspace-пакетів +
      міжпакетні dependencies + усі імпорти в `packages/`, `src/`,
      `themes/`, `plugins/` + tsconfig paths + vite-аліаси + згадки в
      docs/instructions. Phantom-alias `@simplysoftua/db-types` —
      перейменовано разом для одноманітності. Механічний codemod (392
      файли); DoD виконано: `grep` старого scope по репо = 0,
      `typecheck`/`lint`/`test`/`build`/`build:packages` зелені.
      _(2026-06-12)_
- [x] **publishConfig.registry** на кожному публікованому пакеті:
      `https://npm.pkg.github.com` (`repository.url` уже вказував на
      simplySOFTua/simplyCMS-core — підтверджено для всіх 6 пакетів).
      _(2026-06-12)_
- [x] **CI publish:** `publish-packages.yml` оновлено — registry
      npm.pkg.github.com (`registry-url`+`scope`), `permissions:
      packages: write`, автентифікація `GITHUB_TOKEN`; тригер publish —
      semver-тег `v*` + `workflow_dispatch`; окрема `build`-job ганяє
      `build:packages` на кожен PR/push (publish gated, build як gate).
      _(2026-06-12)_
- [ ] **Перший реліз:** тег `v0.1.0` → публікація `objects` + `domain`
      (+ за бажанням data-supabase/react-query/runtime/storefront, які
      вже buildable). Далі — semver-дисципліна на breaking.
      _(окремий крок після ревью — НЕ робити в цій задачі)_
- [x] **Інваріант публічної поверхні:** subpath-`exports` у dev-умові
      (src) і publish-умові (dist) збігаються 1:1 (аудит — розбіжностей
      і битих шляхів немає); guard додано:
      `tests/published-exports-parity.test.ts` (12 кейсів, зелені).
      _(2026-06-12)_
- [ ] **Доступ на читання:** GitHub Packages вимагає токен навіть для
      public-пакетів — задокументувати для споживачів `.npmrc`
      (`@simplysoftua:registry=https://npm.pkg.github.com` +
      `_authToken`) і потребу PAT `read:packages` у CI/Vercel
      споживача.

### 2. Reference-схема: hub-variant blueprint (дизайн §5)

`packages/simplycms/schema/seed-migrations/` зараз — лише single-tenant
as-is. Для HUB потрібен **версіонований blueprint-шаблон**, а не готова
міграція (схему host застосовує сам через свій migration-канал):

- [ ] Виділити «товарну підмножину» blueprint: `products`, `sections`,
      `product_modifications`, `price_types`, `product_prices`,
      `section_properties`, `property_options`, `product_property_values`
      — без orders/cart/shipping/reviews/discounts і без
      stock-механіки (`pickup_points`/`stock_by_pickup_point` —
      продукти HUB цифрові, рішення власника 2026-06-11);
- [ ] Документувати multi-tenant адаптацію: колонка `hub_id NOT NULL`,
      унікальність `(hub_id, slug)` замість глобальної, FK всередині
      tenant, індекси з `hub_id` першим;
- [ ] Помітити місця, де RLS host-специфічний (simplyCMS — `is_admin()`;
      MetaHub — свої helper-функції) — blueprint не нав'язує політики;
- [ ] README у `schema/` з матрицею «таблиця → профіль споживання»
      (simplyCMS повна / HUB товарна / Marketplace +orders).

### 3. Контракти: звірка під HUB-використання

- [ ] Перевірити, що read-сигнатур `CatalogRepository` достатньо для
      зовнішньої імплементації (HUB пише власний адаптер на
      `@kit/supabase`): `getProduct`, `listProducts`,
      `getProductsBySection`, `getSections`, `getProperties`,
      `getPriceTypes` — без прихованих залежностей на DB-shape
      (`Database`-типи не протікають у `objects`); `getStock` для
      цифрових продуктів HUB може повертати статичну доступність —
      перевірити, що контракт це дозволяє;
- [ ] Write-операції admin (`upsertProduct`, …) у порті — **не блокер**
      для HUB (admin-запис іде через host Server Functions); зафіксувати
      це в дизайн-доку, щоб не розширювати порт передчасно;
- [ ] `ScopeResolver` — переконатися, що всі read-шляхи `data-supabase`
      шанують scope (тест-матриця `undefined`/`hub_id` — вимога §8
      дизайн-доку) як reference-приклад для host-адаптера.

### 4. Документація для споживача

- [ ] Короткий `docs/architecture/consuming-hub-products.md` (або розділ
      у extraction-доку): що саме бере HUB (objects+domain+blueprint),
      чого НЕ бере (data-supabase/ui/admin/storefront), як оновлюється
      (semver bump з GitHub Packages), як виглядає мінімальний адаптер
      порту (приклад ~30 LOC на основі `data-supabase/src/scope.ts`).

## Definition of Done

- [ ] MetaHub може зробити `pnpm add @simplysoftua/objects
      @simplysoftua/domain` з GitHub Packages без жодного редагування
      коду ядра.
- [ ] Blueprint товарної підмножини схеми опубліковано в
      `packages/simplycms/schema/` з інструкцією multi-tenant адаптації.
- [ ] Тест-матриця scope (`undefined`/`hub_id`) зелена у `data-supabase`.
- [ ] Документація споживача написана; відкриті питання дизайн-доку
      (№4 services, orders→CRM) винесені власнику й не блокують HUB v1.
- [ ] `pnpm typecheck && pnpm lint && pnpm test && pnpm build` зелені.

## Поза скоупом (лишається в extraction-задачі)

- Retarget `*-ui` від core (identity/reviews/stock/data-порти).
- Параметризація `storefront` доменним `CatalogRepository`.
- Admin-on-repositories (P8) та runtime-wiring live-маршрутів (P9).
- Публікація `core`/`ui`/`*-ui` — потрібна лише для Marketplace-фази.
