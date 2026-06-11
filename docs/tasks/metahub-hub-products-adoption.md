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

- `@simplycms/objects` (T0) — контракти + порти, 0 runtime deps (P1 ✅).
- `@simplycms/domain` (T1) — pure pricing/discounts/inventory/shipping,
  27 unit-тестів (P2 ✅).
- Singleton `supabase` знесено, DI через `SupabaseProvider` (P3 ✅).
- Build/publish: tsup + `publish-packages.yml` для T0/T1/T2 (P10 ✅).
- Subtree-флоу `cms:remote`/`cms:pull`/`cms:push` робочий.

## Чекліст готовності (скоуп цієї задачі)

### 1. Канал поставки через GitHub — зняти scope-блокер

Зафіксований гібрид (рішення №5): Packages для readonly-споживання,
subtree для активної доробки. Для HUB (readonly) зараз блокер:
GitHub Packages вимагає збігу scope з власником репо (`@simplysoftua/*`),
а пакети — `@simplycms/*` (примітка (c) у P10).

- [ ] Рішення власника: (а) rename scope на `@simplysoftua/*`,
      (б) публікація в npmjs під `@simplycms/*`, (в) тимчасово —
      subtree/git-deps без registry.
- [ ] Якщо (в): задокументувати для споживача обидва робочі варіанти —
      `git subtree add --prefix=packages/vendor/simplycms <repo> main --squash`
      (тільки objects+domain) та pnpm git-залежність
      `github:simplySOFTua/simplyCMS-core#path:/packages/objects`.
- [ ] Перший semver-тег `v0.x` для `objects`+`domain` (зафіксувати API
      для зовнішнього споживача; далі — semver-дисципліна на breaking).

### 2. Reference-схема: hub-variant blueprint (дизайн §5)

`packages/simplycms/schema/seed-migrations/` зараз — лише single-tenant
as-is. Для HUB потрібен **версіонований blueprint-шаблон**, а не готова
міграція (схему host застосовує сам через свій migration-канал):

- [ ] Виділити «товарну підмножину» blueprint: `products`, `sections`,
      `product_modifications`, `price_types`, `product_prices`,
      `section_properties`, `property_options`, `product_property_values`
      — без orders/cart/shipping/reviews/discounts;
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
      `getPriceTypes`, `getStock` — без прихованих залежностей на
      DB-shape (`Database`-типи не протікають у `objects`);
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
      (subtree pull / semver bump), як виглядає мінімальний адаптер
      порту (приклад ~30 LOC на основі `data-supabase/src/scope.ts`).

## Definition of Done

- [ ] MetaHub може підключити `objects`+`domain` з GitHub без жодного
      редагування коду ядра і без registry-блокерів.
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
