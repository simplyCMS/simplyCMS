# План Фази 3 — Plugin SDK + референс-плагіни (v1)

> Створено 2026-08-14. Джерело правди вимог —
> [`../specs/2026-07-30-platform-architecture-design.md`](../specs/2026-07-30-platform-architecture-design.md)
> §7–§9, §12; межі, передані з CLI v1 —
> [`../specs/2026-08-13-cli-v1-design.md`](../specs/2026-08-13-cli-v1-design.md) §8.
> Трекінг — [`../../tasks/platform-roadmap.md`](../../tasks/platform-roadmap.md), Фаза 3.
>
> **Середовище виконання:** без Docker і живої БД. Доказовість — детерміністичні
> гейти (`format:check → lint → build → typecheck → test → build:packages →
> test:packaging`) + `pnpm pilot:pack` (Gates A/C/D/CLI/TOOL). Gate B/E,
> `pnpm test:e2e` і накат міграцій на dev-БД — дії власника перед релізом
> (той самий режим, що вже висить боргом №10 роадмапу).

---

## 0. Рішення (зафіксовані ДО коду)

Розвідка (12 звітів + критик повноти, сесія 2026-08-14) виявила розриви між
спекою і кодом, які план мусить розвʼязати явно, а не «по ходу».

- **Р0 — скоуп hooks v1: слоти + декларативні хуки БЕЗ нових бізнес-емітерів.**
  `hookRegistry.execute` викликається рівно в одному продакшн-місці —
  `PluginSlot.tsx`; жодної точки емісії `order.created`/`product.before_save`
  у ядрі немає, а створення замовлення — клієнтський `supabase.from('orders')
  .insert` повз `OrderRepository`-порт (`Checkout.tsx:237`). Додавання
  бізнес-емітерів = прихований рефакторинг воронки — НЕ в цій фазі.
  `definePlugin` приймає `slots` (компоненти) і `hooks` (обробники) — обидва
  реєструються в наявному `HookRegistry`; серверного bootstrap-контуру немає
  (bootstrap — client-only `useEffect`, адмінка — `ssr:false`), і v1 це
  зберігає. Чесно фіксується в роадмапі як межа.
- **Р1 — `definePlugin` видає розширений `PluginModule`.** Результат структурно
  задовольняє чинний контракт `{ manifest, register, unregister }`
  (`plugin-system/src/types.ts:157-161`): `register`/`unregister` генеруються
  з декларативних `slots`/`hooks`. `bootstrapPlugins`/`PluginLoader`/тести
  слотів лишаються майже незмінними. Валідатор `validatePluginModule` — pure,
  за зразком `validateThemeModule`, але політика мʼякша: на bootstrap
  невалідний/несумісний модуль → `console.error` + skip (спека §8 «ніяких
  падінь»), а не throw.
- **Р2 — `zod` для SDK — peerDependency `^4.0.0`.** Критик спіймав: zod УЖЕ
  peer у `admin`/`core`/`storefront-routes` (`'^3.0.0 || ^4.0.0'`), тож
  `classifyExternal` (audit-deps) вимагає peer, не dependency. Форма
  налаштувань рендериться через `z.toJSONSchema()` (Zod 4 native) — тому SDK
  заявляє `^4.0.0`; діапазони наявних трьох пакетів не чіпаємо (вони zod
  введеного через SDK не інстансують). Конвенція UI-міток: `.describe()` →
  label-ключ i18n, `z.enum` → select, `.default()` → значення за замовчуванням.
- **Р3 — монтаж adminRoutes: `physical()`-рядки, тека роутів плагіна зветься
  `routes/`.** Спека §8 («монтажні рядки генерує CLI») реалізується якірною
  вставкою у store-owned `routes.ts` (критик підтвердив: `routes.ts` НЕ в
  `SYNCED_FILES` — якірна вставка легальна; байт-канонний конфлікт §8
  стосується `theme-registry.ts` і лишається за межами фази). Файли роутів
  плагіна несуть запечені id `/admin/<slug>/…` і стають дітьми layout
  `/admin` (guard + AdminLayout успадковуються). Тека саме `routes/`:
  tailwind-глоб шаблону вже сканує `./node_modules/@simplycms/*/routes/**` —
  `admin-routes/` мовчки лишив би плагін без стилів. У template/routes.ts і
  кореневому routes.ts додається якір-коментар для майбутніх вставок CLI;
  монтаж у магазині — через той самий realpathSync-хелпер (урок
  `template/routes.ts`: без realpath code-splitting мовчки зникає).
- **Р4 — міграції плагінів: файловий механізм, НЕ drizzle-композиція.**
  Плагін везе рецензовані `migrations/*.sql` у tarball (поле `files`, прецедент
  `@simplycms/schema`); конвенція імені — `<YYYYMMDDHHmmss>_plg_<name>_<slug>.sql`
  (знімає колізії канонів). `simplycms db:diff` узагальнюється з «1 канон
  (schema)» до «N канонів (schema + кожен плагін із конфігу, в якого є
  `node_modules/<pkg>/migrations/`)»; `own` перераховується по обʼєднанню
  канонів — інакше doctor №7 почне брехати. Гард меж: SQL-лінт — `CREATE
  TABLE`/`ALTER TABLE`/`CREATE POLICY`/`REFERENCES` плагінної міграції лише на
  `plg_<name>_*`. Drizzle-фрагмент як авторський інструмент і заповнення
  `plugins.migrations_applied` — свідомо пізніше (борг у роадмап).
- **Р5 — `engines.simplycms`: реальна semver-перевірка у warn-режимі на 0.x.**
  Утиліта `satisfies(version, range)` (caret/tilde/точна/`>=`) + константа
  `CORE_VERSION` — у `@simplycms/objects` (T0, 0 deps; прецедент версії —
  `readCliVersion` на синхронній моделі). Парність `CORE_VERSION` ↔
  `package.json.version` стереже тест; `scripts/release/bump.mjs` оновлює
  константу при бампі. Політика: невідповідність діапазону на 0.x — `warn`
  (тема) / `warn + реєстрація все одно` (плагін); строгий фейл — рішення
  реліз-потяга v1.0 (пункт Фази 2 роадмапу закривається ЧАСТКОВО: механізм є,
  строгість відкладена). Маніфести обох тем (`'^0.1.0'` проти ядра 0.3.0)
  оновлюються на `'>=0.1.0'`, щоб warn не спамив.
- **Р6 — i18n плагінів: inline `messages`, дзеркало тем.** НЕ `catalogs:
  './i18n'`-шлях зі спеки §7 — теми вже реалізовані як inline
  `ThemeModule.messages` + `useThemeT`, і два механізми каталогів гірші за
  один; шлях-до-теки лишається конвенцією розкладки скаффолда. Поле
  `messages?: Partial<Record<Locale, Record<string,string>>>` у результаті
  `definePlugin`, хук `usePluginT` (ланцюжок `locale → uk → key`, спільний
  `interpolate`), обовʼязковий префікс ключів `plugin.<name>.`. SSR-пастки
  useThemeT тут немає: слоти виконуються лише на клієнті (Р0), джерело
  модуля — синхронний реєстр `getRegisteredPluginModules`.
  `SCANNED_ROOTS` розширюється текою `plugins/` цілком (як `themes/`);
  новий `tests/plugin-messages-parity.test.ts` — двійник theme-parity.
  Конвенція: `manifest.description` та інші метадані реєстру — англійською
  (вони показуються з БД-рядка, не з каталогу) — інакше AST-скан червоніє.
- **Р7 — dependency-lint: `no-restricted-imports` (core-правило) у новій
  eslint-зоні.** Зона: `plugins/**/*.{ts,tsx}` + `packages/simplycms-plugin-*/
  **/*.{ts,tsx}` (тека референс-плагіна зветься `simplycms-plugin-<name>`,
  щоб glob НЕ зачепив `plugin-system`/`plugin-sdk`). Заборона: `@simplycms/
  supabase(/**)`, `@simplycms/data-supabase(/**)`, `@supabase/*`. Механізм —
  саме `no-restricted-imports` (покриває import/export-from/dynamic import),
  окреме правило від `no-restricted-syntax`, тож «заміна опцій на перетині
  зон» i18n не вражає. Доказ — committed-тест через ESLint API
  (`lintText` із filePath у зоні й поза нею): зелений лінт сам по собі
  повноту не доводить (урок env-контракту).
- **Р8 — адмінка: один шлях мутації стану плагінів.** `PluginSettings` toggle
  переводиться з прямого `supabase.update` на `usePluginToggle` (зараз два
  розбіжні механізми — прямий update НЕ мутує HookRegistry); uninstall у
  `Plugins.tsx` — на `uninstallPlugin` з PluginLoader; `InstallPluginDialog`
  (runtime-встановлення руками, суперечить build-time lifecycle §7)
  видаляється (D5 — без шимів). Форма налаштувань рендериться з Zod-схеми
  зареєстрованого модуля (`getRegisteredPluginModules().get(name)`), що
  заразом закриває борг зламаного `import('…manifest.json')`
  (`PluginSettings.tsx:75-85`).
- **Р9 — авторський цикл v1: `create plugin` скаффолдить у `plugins/<name>`
  магазину; `plugin:dev` відкладено.** Шаблон магазину НЕ є pnpm-workspace, а
  `minimumReleaseAge=24h` блокує install щойно опублікованого пакета — субстрату
  для workspace-лінка немає. Натомість аліас `@plugins/*` уже в tsconfig/vite
  шаблону: скаффолд у теку `plugins/` дає робочий dev-loop без лінків.
  `create` — новий ключ диспетчера CLI із суб-командою `plugin`; шаблон
  плагіна — `packages/cli/template-plugin/` (у `files` пакета; асерти
  Gate TOOL розширюються). `plugin:dev` — чесно за межами v1 (у роадмап).
- **Р10 — порти SDK v1: `usePluginTable` (дані `plg_*`) + реекспорти.**
  Плагін не імпортує `@simplycms/supabase` (Р7); SDK — довірене ядро — сам
  бере клієнт із `SupabaseProvider` і віддає вузький CRUD-фасад
  `usePluginTable<Row>(table)` з рантайм-гардом префікса `plg_`. Типи таблиць
  плагіна не входять у core-baseline — generic-параметр. `events`/`storage`-
  фасади зі спеки §7 — НЕ в v1 (немає жодного споживача; таблиця
  `plugin_events` мертва) — межа фіксується. Декларативні поля
  `edgeFunctions?`/`buckets?` у маніфесті — додаються як декларація без
  автоматизації (§9 v1); `plugin:purge` — не в цій фазі (борг у роадмап).
- **Р11 — референс-плагін: `@simplycms/plugin-faq`
  (тека `packages/simplycms-plugin-faq`).** Не «оплата/доставка» (див. Р0 —
  це рефакторинг воронки, окрема задача). FAQ вправляє ВСЮ поверхню SDK:
  таблиця `plg_faq_items` (міграція в пакеті, RLS: select всім, писати
  адмінам), adminRoutes `/admin/faq` (CRUD через `usePluginTable`), слот
  `product.detail.after` (FAQ до товару; `product_id uuid` БЕЗ FK у чужу
  таблицю — модель link-полів §7), Zod-settings (`maxVisible`), власний
  каталог `messages`. Монтується симетрично в монорепо `routes.ts` і
  `template/routes.ts` (+ deps і запис у конфіг шаблону) — інакше Gate A
  set-diff несиметричний. Наслідок: свіжий магазин народжується з
  faq-плагіном як другим демо (перше — hello-world) — прийнято свідомо.
  `hello-world` мігрує на `definePlugin` мінімальним прикладом
  (слот + messages, без таблиць).

## 1. Етапи

### Етап 1 — Фундамент: semver-утиліта + пакет `@simplycms/plugin-sdk`

1. `@simplycms/objects`: subpath `semver` — `satisfies(version, range)`
   (caret/tilde/точна/`>=`; без пре-релізів) + `CORE_VERSION`; тест парності
   `CORE_VERSION === package.json.version`; інтеграція в
   `scripts/release/bump.mjs` (бамп константи разом із маніфестами) + юніти.
2. Пакет `packages/plugin-sdk` (`@simplycms/plugin-sdk`, T2): `package.json`
   за чеклістом packaging-звіту (явний `"private": false`, `publishConfig`
   з дзеркальними exports на dist, `files: ["dist","src"]`, README,
   `tsup.config.ts` зі `splitting: false`, версія = синхронній 0.3.0),
   аліас у `tsconfig.json` paths + `vite.config.ts` resolve.alias,
   рядок у `packages/README.md`.
3. API SDK: `definePlugin` (Р1), `validatePluginModule` (мʼяка політика),
   типи (`PluginDefinition`: name/displayName/version/engines/description?/
   settings? ZodObject/slots?/hooks?/messages?/adminRoutes? (декларація)/
   migrations? /edgeFunctions?/buckets?), `usePluginT` (Р6),
   `usePluginTable` (Р10). Юніти на все перелічене.
4. `pnpm install` (оновити lockfile) + гейти.

### Етап 2 — Інтеграція контуру ядра

1. `bootstrapPlugins`: прогін модуля через `validatePluginModule` (invalid →
   error-лог + skip); перевірка `engines.simplycms` через `satisfies` у
   warn-режимі (Р5); `toInsert` доповнити `hooks` з manifest (зараз рядок від
   bootstrap бідніший за сідовий) + асерт у `bootstrap.test.ts`.
2. `theme-system`: warn-перевірка діапазону через ту саму утиліту в
   `validateThemeModule` (присутність-рядка лишається жорсткою); оновити
   `engines` манифестів обох тем на `'>=0.1.0'` + тести.
3. Адмінка (Р8): `PluginSettings` — форма з `z.toJSONSchema` схеми модуля,
   toggle → `usePluginToggle`; `Plugins.tsx` uninstall → `uninstallPlugin`;
   видалити `InstallPluginDialog`; нові рядки — через `t()` (error-зона i18n).
   Тест рендера форми зі схеми поруч із `plugin-toggle.test.tsx`.

### Етап 3 — Референс-плагіни + i18n-контур плагінів

1. `plugins/hello-world` → `definePlugin` (слот + `messages` з префіксом
   `plugin.hello-world.`; description — англійською за Р6).
2. `packages/simplycms-plugin-faq` (Р11): модуль, `routes/` із запеченими id
   `/admin/faq`, міграція `…_plg_faq_items.sql` у `migrations/`, settings,
   messages; манифест пакета — за тим самим packaging-чеклістом.
3. Монтаж: `routes.ts` (монорепо) + якір-коментар; `template/routes.ts` +
   `template/package.json` + `template/simplycms.config.ts`; `pnpm
   template:sync`; сід-фікстури (`seed-fixtures.mjs` + `pnpm pilot:seed`),
   якщо рядок плагіна має бути в сіді.
4. i18n: `SCANNED_ROOTS` += `plugins/` (цілком); новий
   `tests/plugin-messages-parity.test.ts`; розширення
   `tests/virtual-routes-escape.test.ts` кейсом «два physical() під /admin».

### Етап 4 — CLI: `create plugin` + `db:diff` N канонів

1. `create.mjs` (ключ `create`, суб-команда `plugin`): скаффолд
   `plugins/<name>` магазину з `packages/cli/template-plugin/` (definePlugin +
   messages + приклад міграції з правильним іменем) + `insertEntry` у конфіг;
   `--dry-run`; тести `tests/cli-create.test.ts` (парсер, скаффолд,
   TS-валідність вставки).
2. `db-diff.mjs`: N канонів (Р4) — джерела з конфігу магазину; `own` по
   обʼєднанню; SQL-лінт `plg_<name>_*`; узгодити doctor №7; тести
   `tests/cli-db-diff.test.ts` розширити (плагін із міграціями, колізія
   імен, чужа таблиця в SQL → error).
3. `add --plugin`: замість нагадування-заглушки — dry-run компаратора
   міграцій із підказкою `db:diff --write`; довідка `--help` + Gate TOOL
   (маркери нових команд, асерт `template-plugin/`, `EXPECTED_DEPS` — якщо
   зміняться).

### Етап 5 — Межа довіри

1. eslint-зона (Р7) після server-env-блоку + 🔴-коментар у стилі файлу.
2. `tests/plugin-trust-boundary.test.ts` — негативний контроль через ESLint
   API (у зоні — ловить; поза зоною — ні; `@simplycms/plugin-sdk` у зоні —
   чистий; перевірити, що filePath не зʼїдений ignores).

### Етап 6 — Доки, гейти, рев'ю

1. `CHANGELOG.md` (розділ Unreleased: нові пакети, breaking 0.x —
   `PluginSettingDefinition` геть, `InstallPluginDialog` геть),
   `docs/tasks/platform-roadmap.md` (відмітки Фази 3 + нові борги: серверний
   bootstrap-контур і бізнес-емітери, plugin:dev, plugin:purge,
   migrations_applied, строгий semver у v1.0, events/storage-порти),
   `docs/architecture/cli.md` (create plugin, db:diff N канонів),
   `packages/README.md` (тіри), лінк на цей план із роадмапу.
2. Повний канон гейтів + `pnpm pilot:pack`.
3. Адверсаріальне рев'ю (лінзи correctness/test-honesty/drift/architecture ×
   верифікатор кожної знахідки) → фікси підтверджених → повторні гейти.

## 2. DoD фази (частина «цієї сесії»)

- [ ] `@simplycms/plugin-sdk` і `@simplycms/plugin-faq` проходять
      packaging-контур (`test:packaging` + Gates A/C/D/CLI/TOOL).
- [ ] `simplycms create plugin` скаффолдить робочий плагін; юніти CLI зелені.
- [ ] `simplycms db:diff` бачить міграції плагінів; SQL-лінт меж працює.
- [ ] dependency-lint доведений committed-тестом (негативний контроль).
- [ ] `locale: en-US` не ламається плагінами: `plugins/` під AST-сканом,
      parity-тест каталогів плагінів зелений.
- [ ] Роадмап/CHANGELOG/доки оновлені; межі v1 зафіксовані як борги.

**Залишається власнику (без Docker/БД не доводиться):** накат
`…_plg_faq_items.sql` на dev-БД; `pnpm pilot:e2e` + `pnpm test:e2e`
(разом із уже наявним боргом №10); рішення про мерж = публікація ДВОХ нових
пакетів у реєстр (правило «введення пакета — релізне рішення в момент мержу»).
