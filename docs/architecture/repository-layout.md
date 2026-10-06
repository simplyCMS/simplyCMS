# Структура репозиторію

Каталог тек і файлів монорепо. Тіри T0→T5 пакета `simplycms` і правила напряму імпортів —
`packages/README.md` (джерело правди про тіри); тут — решта дерева.

```
simplyCMS/
├── routes.ts                         # virtualRouteConfig: rootRoute + physical() на роут-теки
│                                     # packages/simplycms/routes/{storefront,admin} (+ плагіни)
├── apps/www/                         # Лендінг simplycms.dev: TanStack Start у режимі ПРЕРЕНДЕРУ
│                                     # (статичний HTML, деплой dist/client на будь-який хостинг).
│                                     # private, ПОЗА реліз-потягом (bump/publish сканують лише
│                                     # packages/*). Живі метрики (зірки GitHub, downloads/версія npm)
│                                     # тягне БРАУЗЕР відвідувача з публічних API; агрегатори під
│                                     # tests/www-live-stats.test.ts. Виключений з root tsconfig
│                                     # (власний), у root eslint/prettier входить (ігнор лише на
│                                     # routeTree.gen.ts). CI — job `www`.
├── src/                              # Host — тонка збірка магазину
│   ├── routes/
│   │   ├── __root.tsx                # Root route (html, providers, 404/error)
│   │   └── my/                       # ЄДИНА тека роутів магазину (кастомні сторінки)
│   ├── engine-provider.tsx           # EngineProvider (ізоморфна збірка EngineContext: links+config)
│   ├── engine.shared.ts              # Shared-частина EngineContext (isomorphic)
│   ├── styles/globals.css            # Tailwind v4 entry (@import + @config)
│   ├── theme-registry.ts             # Реєстрація тем з config.themes (side-effect)
│   ├── router.tsx                    # createRouter
│   ├── start.ts                      # createStart + global request middleware (admin guard)
│   ├── client.tsx                    # Client hydration entry
│   ├── server.ts                     # Server entry: createServerEntry({ fetch }) + точка перехоплення
│   └── routeTree.gen.ts              # AUTO-GENERATED — do not edit
│
├── packages/               # ВСІ публіковані пакети — рівно ПʼЯТЬ.
│   │                       # 🔴 Тека `packages/simplycms/` — САМ фреймворк-пакет (unscoped
│   │                       # npm-імʼя `simplycms`), а не проміжний рівень. Тулінг відрізняє ядро
│   │                       # за ІМЕНЕМ: scope `@simplycms/` АБО точне `simplycms`
│   │                       # (🔴 ніколи префіксом — зачепив би сторонні simplycms-theme-*).
│   ├── simplycms/          simplycms                 # ФЛАГМАН: усе ядро одним пакетом
│   │   ├── src/contracts/        # T0 Контракти + порти (0 runtime deps); субшляхи
│   │   │                         #    ./views і ./views/fixtures — view-model-и вітрини
│   │   │                         #    (контракт тем v3; react — type-only peer);
│   │   │                         #    ./entities — реєстр ENTITY/AGGREGATE/SESSION_KEY +
│   │   │                         #    фабрика entityKey() для queryKey React Query;
│   │   │                         #    ./server-only — декларація межі клієнт/сервер (єдина;
│   │   │                         #    читачів СІМ: збірка ядра, гейт dist-server-boundary,
│   │   │                         #    правило server-only-relative, групи no-restricted-imports
│   │   │                         #    плагінів, Gate C, Import Protection у vite.config магазину,
│   │   │                         #    правило no-server-only-in-client. 🔴 Три лінт-детектори
│   │   │                         #    рахуються ОКРЕМО: різні механізми й різні негативні
│   │   │                         #    контролі — test-contours.md §12)
│   │   ├── src/domain/           # T1 Pure-логіка: pricing/discounts/inventory/shipping
│   │   ├── src/schema/           # T1 Drizzle-схема ядра + RLS у TS
│   │   ├── src/schema/types.ts   # T1 Типи рядків із Drizzle — джерело типів для НОВОГО серверного коду
│   │   ├── src/db/               # T2 pg-пул + `withActor` — ЄДИНИЙ спосіб дістати зʼєднання
│   │   │                         #    (GUC актора + SET LOCAL ROLE у транзакції); гола фабрика
│   │   │                         #    `db/client` закрита лінт-зоною й не має субшляху в exports
│   │   ├── src/auth/             # T2 Серверний Better Auth (інстанс, databaseHooks, invite
│   │   │                         #    власника, authz-матриця); вхід, сесія й guard адмінки
│   │   ├── src/admin-server/     # T2 Серверний шар адмінки — defineAdminResource (операції+схеми)
│   │   │                         #    + іменовані операції; index.ts — ЛИШЕ топ-рівневі
│   │   │                         #    createServerFn, нутрощі — bare-субшлях ./impl
│   │   ├── src/storage/          # T2 Порт сховища файлів — драйвер local-fs, іммутабельні
│   │   │                         #    ключі, MIME за байтами, запис файлу й рядка `media` однією
│   │   │                         #    транзакцією актора. server-only за contracts/server-only
│   │   ├── src/inventory/        # T2 Спільний облік залишків — гвардований перехід stock_status
│   │   │                         #    (одна копія для вітрини й адмінки), lockTargetStock/
│   │   │                         #    servingQuantity. server-only
│   │   ├── src/supabase/         # T2 browser/server/anon-клієнти, SupabaseProvider, keys,
│   │   │                         #    database.ts (ЗАМОРОЖЕНИЙ baseline core-типів). Шар
│   │   │                         #    адмінки на supabase-js, що переписується на admin-server;
│   │   │                         #    вітрина його не імпортує, провайдер ніде не монтується
│   │   ├── src/react-query/      # T2 Query-хуки через EngineContext
│   │   ├── src/runtime/          # T2 defineRuntime + host-defineConfig; ./domain-error-adapter —
│   │   │                         #    T0-реєстр доменних помилок (AdminConflictError/AuthzError) +
│   │   │                         #    клієнтський seroval-адаптер межі serverFn (реєструється в
│   │   │                         #    src/start.ts serializationAdapters)
│   │   ├── src/i18n/             # T2 createTranslator, I18nProvider, каталоги uk/en
│   │   ├── src/storefront/       # T2 SSR-лоадери + SEO-генератори (DI-клієнт)
│   │   ├── src/ui/               # T3 shadcn/ui-примітиви
│   │   ├── src/themes/           # T4 ThemeRegistry, bootstrapThemes, applyTokens,
│   │   │                         #    validateThemeModule, conformance/ (гейт views v3,
│   │   │                         #    субшлях simplycms/themes/conformance)
│   │   ├── src/plugins/          # T4 HookRegistry, PluginSlot, bootstrapPlugins,
│   │   │                         #    validatePluginModule
│   │   ├── src/plugin-sdk/       # T4 definePlugin + порти плагінів (usePluginTable,
│   │   │                         #    usePluginConfig, usePluginT) — ЄДИНА поверхня,
│   │   │                         #    дозволена плагіну (межа довіри §7)
│   │   ├── src/admin-data/       # T4 Колекції TanStack DB адмінки — реєстр по QueryClient,
│   │   │                         #    колекції без schema, ключі з contracts/entities
│   │   ├── src/{cart,catalog,checkout,profile,reviews}-ui/   # T4 Feature-UI воронки
│   │   ├── src/core/             # T5 Власні провайдери/хуки/компоненти (CMSProvider,
│   │   │                         #    useAuth, useCart, useBanners…)
│   │   ├── src/admin/            # T5 Сторінки/компоненти адмінки; частина на admin-server/
│   │   │                         #    admin-data, решта — легасі на supabase-js (поточний
│   │   │                         #    перелік — v2-state-map.md та реєстр
│   │   │                         #    tests/admin-server-first/registry.ts)
│   │   ├── src/storefront-routes/# T5 pages/ (container-и) + views/ (канонічні view +
│   │   │                         #    slots/ реквізитів) + shells/ + server/ + seo/
│   │   ├── routes/storefront/    # T5 Роут-файли вітрини — монтуються physical()
│   │   ├── routes/admin/         # T5 Роут-файли адмінки (тонкі обгортки src/admin)
│   │   ├── migrations/           # КАНОН core-міграцій: baseline 0000_prelude → 0003_seed;
│   │   │                         #    джерело `simplycms db:diff`
│   │   ├── skills/               # Агентні скіли, які їдуть у магазини СИМЛІНКАМИ
│   │   ├── drizzle/ + drizzle.config.ts + seed-migrations/     # schema-тулінг
│   │   └── tsdown.config.ts      # ДВІ збірки (клієнт/сервер); entry з dev-exports; група — за contracts/server-only
│   ├── cli/                @simplycms/cli            # CLI магазину (bin `simplycms`): doctor/add/
│   │                                                 # create (plugin|theme)/update/db:diff (N канонів)/
│   │                                                 # theme:conformance (гейт views, контракт тем v3);
│   │                                                 # чистий ESM без build; host/ — канон host-файлів,
│   │                                                 # template-plugin/ і template-theme/ — шаблони
│   │                                                 # (`pnpm template:sync`); виконується В МАГАЗИНІ
│   ├── simplycms-theme-solarstore/ @simplycms/theme-solarstore  # Референс-тема повного контуру: manifest
│   │                                                 # + tokens + components + messages (npm)
│   ├── simplycms-plugin-faq/  @simplycms/plugin-faq  # Референс-плагін повного контуру: plg_faq_items,
│   │                                                 # routes/ (/admin/faq), слот, Zod-settings, i18n.
│   │                                                 # 🔴 З шаблону знято — ставиться `simplycms add`
│   ├── create-simplycms-store/  # UNSCOPED npm-пакет: CLI-скаффолдер (`src/`) + вбудований
│   │                            # шаблон магазину (`template/`, закомічена копія,
│   │                            # синхронізується `pnpm template:sync`). Під фільтри імені ядра
│   │                            # не підпадає й у tarball-parity не рахується.
│   └── README.md           # Джерело правди про тіри залежностей T0→T5
│
├── scripts/                          # Тулчейн міграцій, пакування, релізу
│   ├── db-diff.mjs · db-migrate.mjs  # db-migrate — файл-надгробок (канон переїхав у packages/simplycms/migrations/)
│   ├── release.mjs      + release/      # bump/gates/git — `pnpm release X.Y.Z`
│   │                                    # (bump.mjs сканує packages/* — і ядро, і скаффолдер)
│   ├── version-packages.mjs             # «сирий» бамп версій без гейтів
│   ├── audit-deps.mjs   + audit-deps/   # collect (bare-імпорти) + classify (deps/peers)
│   ├── audit-exports.mjs + audit-exports/ # collect (споживані subpath-и) + resolve
│   ├── pack-inspect.mjs + pack-inspect/ # читання вмісту tarball-ів
│   ├── sync-create-store-template.mjs   # монорепо → template/ пакета create-simplycms-store
│   ├── pilot-pack.mjs   + pilot-pack/   # env/pack/scaffold/build/run + gate-a…gate-d + create-pkg-smoke
│   │                                    # + seed-fixtures.mjs — джерело правди сіду
│   ├── pilot-seed.mjs                   # фікстури → supabase/seed.sql (`pnpm pilot:seed`)
│   ├── demo-db.mjs                      # `pnpm db:demo`: чиста БД із канону + демо-каталог
│   └── live-smoke.mjs + live-smoke/     # `pnpm live:smoke`: sql.mjs (прямий SQL) + register.mjs +
│                                        # funnel.mjs (Playwright-воронка) + avatar.mjs (ЄДИНИЙ
│                                        # живий доказ порту сховища: завантаження, роздача /media,
│                                        # референс у БД, видалення)
├── packages/simplycms/test-harness/pg/  # контур `pnpm test:schema` — підйом Postgres без Docker
│                                     # (PG_HARNESS_URL або ефемерний initdb), накат канону,
│                                     # інтроспекція ACL/політик, актори
├── supabase/                         # ЗАЛИШКОВА тека: config.toml + ЗГЕНЕРОВАНИЙ seed.sql
│                                     # локального стеку supabase. Ні migrations/, ні types.ts
│                                     # тут немає; канон схеми — packages/simplycms/migrations/
├── themes/default/                   # Локальна тема-еталон (контракт v3, із власними views);
│                                     # solarstore — npm-пакет packages/simplycms-theme-solarstore/
├── plugins/hello-world/              # Референс-плагін (мінімальний; повний — @simplycms/plugin-faq)
├── tests/                            # virtual-routes-escape, published-exports-parity,
│   │                                 # audit-deps, audit-exports, host-database-types, seo-endpoints,
│   │                                 # pilot-seed, create-store-template-parity (парність seed.sql і фікстур/шаблону),
│   │                                 # cli-* (юніти @simplycms/cli), tier-boundary (негативний
│   │                                 # контроль тір-зон), dist-import-meta (гард лоуереного import.meta у dist)
│   └── pilot/store-template/         # Тонкий ОВЕРЛЕЙ пілота (vite.config.ts + package.json) поверх шаблону
│                                     # create-simplycms-store — не власна копія host-каркаса (виключений
│                                     # із tsconfig.json і eslint.config.mjs)
│
├── server.mjs                        # Node-runner прод-збірки: sirv(dist/client) + fetch-handler;
│                                     # server-runtime.mjs — його Node-шар (IncomingMessage → Request,
│                                     # стрімінг відповіді), самодостатній і покритий тестами
├── tools/content-loader-mcp/         # Допоміжний MCP-інструмент завантаження контенту (не публікується)
├── public/                           # Статика host-а (favicon, placeholder)
├── playwright.config.ts              # Конфіг браузерних тестів `tests/e2e/` (admin-smoke, layout-overflow)
├── tsconfig.template.json            # tsconfig гейта `pnpm typecheck:template`
├── vitest.schema.config.ts           # Схемний контур (`pnpm test:schema`)
├── simplycms.config.ts               # defineConfig: locale, currency, themes, plugins
├── eslint.db-client-zone.mjs         # Зона: гола фабрика пулу `db/client` закрита, лише `withActor`
├── eslint.tier-zones.mjs             # Тір-зони T0→T5 усередині пакета ядра;
│                                     # eslint.tier-relative.mjs — відносні форми специфікатора
├── eslint-rules/                     # Кастомні flat-config ESLint-плагіни (не публікуються), кожне
│                                     # з ВЛАСНИМ імʼям плагіна: query-key-from-entity.mjs,
│                                     # server-fn-top-level.mjs (createServerFn лише топ-рівнем),
│                                     # mutation-cache-sync.mjs (мутація синхронізує кеш),
│                                     # server-only-relative.mjs (відносний імпорт у server-only
│                                     # дерево ззовні нього), no-side-effect-import.mjs
│                                     # (side-effect-імпорт у пакетах із sideEffects:false),
│                                     # no-direct-storage.mjs, no-server-only-in-client.mjs,
│                                     # no-collection-key-outside-admin-data.mjs
├── vite.config.ts                    # tanstackStart({ router.virtualRouteConfig, server.entry })
├── vitest.config.ts                  # Дефолтний прогін (packaging-suite — у test.exclude)
├── vitest.packaging.config.ts        # Tarball-parity suite (`pnpm test:packaging`)
├── tailwind.config.ts                # Tailwind v4 config
└── pnpm-workspace.yaml               # Workspace config
```

🔴 `src/routes/` сканується **не** цілком: `routes.ts` монтує лише `my/`. Файл, покладений поруч із
`__root.tsx`, роутом не стане — це семантика `virtualRouteConfig` (файлове сканування вимкнене).
`tests/virtual-routes-escape.test.ts` стереже зворотну здатність: що `physical()` бачить теки
пакетів ПОЗА `src/routes/` — саме на ній тримається монтування.
