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

### 1. Канал поставки через GitHub — subtree зараз, готовність до Packages потім

**Рішення власника (2026-06-11): registry зараз не запускаємо.** Споживач
(MetaHub) бере `objects`+`domain` subtree-ом, але все готується так, щоб
перемикання на пакети пізніше було механічним:

- [ ] **Semver-теги вже зараз:** перший тег `v0.x` для `objects`+`domain`;
      далі тег на кожну зовнішньо-видиму зміну (breaking → major за
      semver). Споживач робить `subtree pull` лише на теги — це
      semver-споживання без registry.
- [ ] **Scope лишається `@simplycms/*`** — щоб майбутній перехід на
      registry (npmjs) не міняв жодного імпорту в споживачів. Rename
      на `@simplysoftua/*` (вимога GitHub Packages) відхилено як
      breaking для імпортів; якщо колись захочеться саме GitHub
      Packages — окреме рішення (потребує org/scope `simplycms`).
- [ ] **Інваріант публічної поверхні:** subpath-`exports` у dev-умові
      (src, для workspace/subtree) і publish-умові (dist) мають
      збігатися 1:1 — додати перевірку/тест, щоб src-споживання не
      відкривало шляхів, яких не буде в dist.
- [ ] **CI publish-workflow лишити «сплячим але зеленим»:** build
      (`build:packages`) ганяти на CI кожен PR, сам `publish` — за
      manual dispatch; так момент перемикання = увімкнути крок, а не
      налагоджувати білд.
- [ ] Задокументувати для споживача канонічний subtree-рецепт.
      `git subtree` тягне лише ціле репо, тому: (а) споживач vendor'ить
      усе core одним префіксом і workspace-глобами включає лише
      objects+domain, або (б) core CI веде split-гілки
      (`git subtree split --prefix=objects` → `split/objects`, те саме
      для domain) на кожен тег — споживач subtree-add'ить лише їх.
      Обрати (а) чи (б), описати в consumer-доці + правило «vendor
      readonly, зміни — upstream-first PR-ом сюди».

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
