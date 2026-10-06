# V2-К3 · Етап Е6б: профіль магазину, налаштування, теми й плагіни на серверному шарі

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Сім легасі-файлів адмінки «система» переходять на `simplycms/admin-server`, а власник отримує сторінку «Налаштування» з профілем магазину. Профіль включає назву, SEO, контакти, логотип і соцмережі; вітрина показує їх без перезбірки: у `<title>`, у бренді теми, у футері та в JSON-LD `Organization` головної. Доказ — живий прогін.

**Architecture:** Профіль лежить у `system_settings['store_profile']`. Тип описано в T0, поблажливий розбір — у T1, сувора Zod-схема запису — в `admin-server/impl`. Кеш процесу (TTL + покоління) і читання профілю з `ActorDb` живуть у новому server-only модулі `simplycms/site` (T2). Вітрина читає через свої обгортки `withStorefrontDb`, адмінка пише й скидає той самий кеш; у `site` переїжджає і стан кешу активної теми. Кореневий лоадер host-а віддає ядру `{ activeThemeName, storeProfile, siteUrl, locale }`. З цих даних `head` кожного роуту будує заголовок через i18n, а `StoreProfileProvider` дає темам `useStoreProfile()`. Активація теми, налаштування теми й перемикач плагіна — іменовані операції під новою authz-операцією `settings.manage`.

**Tech Stack:** TanStack Start 1.167 (Router 1.168), TanStack Query, Drizzle + PostgreSQL 17 (`pnpm test:schema`), Zod 4, react-hook-form, Vitest, Playwright (`pnpm live:smoke`).

**Spec:** [`docs/superpowers/specs/2026-10-06-store-profile-system-design.md`](../specs/2026-10-06-store-profile-system-design.md) (рішення власника С-1…С-4). Серверний шар — [`2026-08-29-v2-k3-admin-server-layer-design.md`](../specs/2026-08-29-v2-k3-admin-server-layer-design.md) (К3-4′, К3-7, К3-9′, К3-13). Зразки: план [Е6а](2026-10-06-v2-k3-e6a-shipping-providers.md) (правка baseline, нова authz-операція, крок `live:smoke`), [Е5б](2026-10-04-v2-k3-e5b-order-items-edit.md) (спільний server-only модуль `commerce` у тір-зонах).

**Передумова:** гілка `claude/k3-e6b-system-settings` від `main` (0.9.0, a8fb6c76); перший коміт — спека (`bc57af94`).

**Обсяг:** 7 легасі-файлів (`pages/{Settings,Themes,ThemeSettings,Plugins,PluginSettings}.tsx`, `hooks/{usePluginToggle,useThemeActivate}.ts`). Лічильник `useSupabaseClient` у `src/admin/**`: 24 → **17**. Облік i18n-боргу `head()` у `tests/i18n-coverage/pending.ts`: 15 route-файлів → **0**.

**Редакції:**
- ред.1 (2026-10-06): рішення архітектора Е6б-5…Е6б-21 на основі розвідки трьох агентів (якорі — у задачах).
- ред.2 (2026-10-06): аудит Codex (`gpt-6-sol`, read-only), REJECT: 6 blocker / 7 major / 2 minor. Кожну знахідку перевірено кодом, усі прийнято. Е6б-7 переглянуто: `site` тримає лише кеш і читання з `ActorDb`, вітрина ходить через `withStorefrontDb`, `theme-record.ts` лишається на місці. Хелпери `head` переїхали з server-only `storefront-routes/seo` в `storefront-routes/head` (Е6б-10). Логотип стирається лише під час збереження (Е6б-14). Додано Е6б-22 (`router.invalidate`), Е6б-23 (межа доказу спільного стану), контракт відмови `pluginConfigWrite` (Е6б-13), `UPDATE` у демо-сіді (Е6б-5), шаблон теми CLI і контакти solarstore (Е6б-20). Крок `live:smoke` перевіряє тему через `window.__SIMPLYCMS_ACTIVE_THEME__`; налаштування теми з нього прибрано, бо жодна тема демо не має `settings`. Негативний контроль виконується на прогрітому кеші.

## Ухвалені рішення етапу

Рішення власника — С-1…С-4 спеки. Нижче — рішення архітектора.

| № | Рішення | Причина |
|---|---|---|
| Е6б-5 | **Схема — правкою baseline**, як Е6а-5: `schema.ts` + `migrations/0001_init.sql` + `drizzle/0000_init.sql` + snapshot + `0002_grants.sql` + `0003_seed.sql` + `demo/demo-seed.sql` + `pnpm template:sync`; `drizzle-kit generate` → «No schema changes». Склад змін: таблиця `plugin_events` видаляється разом із грантом; колонка `plugins.migrations_applied` видаляється; рядок сіду `active_theme` видаляється; додається рядок `store_profile` (id `00000005-0000-4000-8000-000000000003`, значення — `EMPTY_STORE_PROFILE` з `name = 'Мій магазин'`). Новий рядок додається у наявний багаторядковий `insert` сіду. Демо-сід переписує профіль на демо-значення (назва, телефон, email, адреса, години, дві соцмережі, логотипа немає) **`UPDATE`-ом** наявного рядка, а не `INSERT` | D5: магазинів немає. Кількість рядків `system_settings` у сіді лишається 2 (`baseline.test.ts:183-200` не змінюється), а кількість `INSERT` — 6 і 20 (`seed-determinism.test.ts:19-21`): зайвий `INSERT` зламав би цей гейт |
| Е6б-6 | **Типи й розбір.** T0 `contracts/store-profile.ts` (новий субшлях `simplycms/contracts/store-profile` у `exports` і `publishConfig.exports`): `SOCIAL_NETWORKS = ['instagram','facebook','telegram','tiktok','youtube','x','viber'] as const`, `SocialNetwork`, `StoreProfile` (дослівно зі спеки), `StorefrontProfile = Omit<StoreProfile,'logo'> & { logoUrl: string \| null }`, `STORE_PROFILE_KEY = 'store_profile'`, `STOCK_MANAGEMENT_KEY = 'stock_management'`, `STORE_PROFILE_LIMITS = { name: 120, homeTitle: 120, description: 300, phone: 40, email: 254, address: 300, hours: 120, socials: 10, socialUrl: 500 }`. T1 `domain/store-profile.ts` (субшлях `simplycms/domain/store-profile`): `EMPTY_STORE_PROFILE` і `parseStoreProfile(json: unknown): StoreProfile` — **поблажливий**, ніколи не кидає й не повертає `null`. Невалідне поле стає дефолтом (`null` / `[]`), невалідна чи порожня `name` — `''`, елементи `socials` з невідомою мережею або не-`https:` url відкидаються, понад 10 — обрізаються. Без Zod (прецедент Е6а-19) | Зіпсований рядок (ручний SQL, старий дамп) не має класти вітрину 500-ю, а форма адмінки має відкриватись і лагодити його. Суворість — лише на записі |
| Е6б-7 | *(ред.2 — аудит blocker 1)* **Новий server-only модуль `simplycms/site`** (T2, тека `src/site/`, upward-виняток лише `db`; запис у `eslint.tier-zones.mjs`, `contracts/server-only.ts`, `exports`/`publishConfig.exports`, `packages/README.md`). Власного каналу до БД модуль НЕ відкриває: кожна функція приймає `ActorDb` (прецедент `commerce`). Склад: `read-cache.ts` — `createReadCache<T>(ttlMs: number): ReadCache<T>`, де `ReadCache<T> = { get(load: () => Promise<T>): Promise<T>; invalidate(): void }`; екземпляри `storeProfileCache: ReadCache<StorefrontProfile>` і `activeThemeCache: ReadCache<ThemeRecord \| null>`; `store-profile.ts` — `readStoreProfile(db: ActorDb): Promise<StoreProfile>` і `toStorefrontProfile(p: StoreProfile): StorefrontProfile`; `built-themes.ts`; `index.ts`. Вітрина: новий `storefront/loaders/store-profile.ts` — `loadStoreProfile() = storeProfileCache.get(() => withStorefrontDb((db) => readStoreProfile(db)).then(toStorefrontProfile))`. `storefront/loaders/theme-record.ts` лишається на місці, але його модульний кеш замінюється на `activeThemeCache`; тип `ThemeRecord` переїжджає в `site` і реекспортується з `storefront/loaders`. Експорт `invalidateThemeCache` зникає — замість нього `activeThemeCache.invalidate()`. `storefront` і `admin-server` отримують `site` в upward-винятки | Кеш і його скидання мусять бути ОДНИМ модульним станом для вітрини (читає) і адмінки (пише). `admin-server` не може імпортувати `storefront` (той самий тір). Канон `data-layer.md:27-30` вимагає, щоб вітрина ходила лише через обгортки `storefront/loaders` |
| Е6б-8 | **Вшиті теми знає сервер із host-а.** `site/built-themes.ts`: `declareBuiltThemes(names: readonly string[]): void`, `isBuiltTheme(name: string): boolean`. Host `src/server.ts` (server entry, однаковий для dev, preview і prod) кличе `declareBuiltThemes(Object.keys(config.themes ?? {}))` на рівні модуля. Без декларації `isBuiltTheme` повертає `false`: активація відмовляє (fail-closed) | Зараз сервер про вшиті теми не знає: рядки `themes` пише `bootstrapThemes` із браузера, а `ThemeRegistry` (T4) серверний шар імпортувати не може. Перевірка «тема вшита» за рядком БД хибна, бо рядок лишається після видалення пакета |
| Е6б-9 | **Кеш профілю й теми — TTL 5 хв + лічильник поколінь** (`createReadCache`, Е6б-7). `invalidate()` збільшує `generation`. Лоадер запамʼятовує покоління на старті читання і кладе результат у кеш, лише якщо покоління не змінилось. Операції адмінки кличуть скидання ПІСЛЯ того, як `runAdmin` повернувся (після COMMIT), а не всередині транзакції | Без поколінь читання, що стартувало до COMMIT і завершилось після скидання, кешує старе значення ще на 5 хв. Тоді «власник зберіг — вітрина не бачить» відтворюється без жодної помилки |
| Е6б-10 | **Канал host → ядро — кореневий лоадер.** Новий serverFn `getStorefrontRoot` (`storefront-routes/server/root.ts`, рівно один експорт) → `{ activeThemeName, storeProfile: StorefrontProfile, siteUrl }`; `siteUrl` читається з `process.env.VITE_SITE_URL ?? ''` у рантаймі. Host `__root.tsx`: `loader: async () => ({ ...(await getStorefrontRoot()), locale }) satisfies StorefrontRootData`. Тип `StorefrontRootData` і хелпери — `storefront-routes/head/head.ts`: `readStorefrontRoot(matches): StorefrontRootData` (шукає match `__root__`; без даних кидає з людським повідомленням про host), `storefrontHead(matches, page: (t: Translator) => { title?: string; description?: string \| null }): { meta }`. *(ред.2 — аудит blocker 2)* Хелпери лежать у НОВІЙ теці `storefront-routes/head/` (субшлях `./storefront-routes/head/*` у `exports` і `publishConfig.exports`), а не в `storefront-routes/seo`. `seo` — server-only (`contracts/server-only.ts:50`), а `head()` виконується і в клієнтському бандлі роуту. Правило заголовка: `title && name ? \`${title} — ${name}\` : title \|\| name`; `description` = сторінкове ?? `profile.description`. Root `head` ставить `title = homeTitle ?? name` за замовчуванням | Один вхід покриває `_storefront`, `_protected` і `auth/*` (у них немає спільного лейаута). Він же закриває i18n-борг `head()`: ядро не мало локалі магазину (`pending.ts:84-99`) |
| Е6б-11 | **`seo` зникає з `defineConfig` повністю**, зокрема `siteUrl`. З `ConfigProvider` прибираються `seo` і `siteUrl` (контракт `contracts/ports`, `contracts/objects/config.ts` `SeoConfig`, три тест-стаби). Джерело URL сайту — env `VITE_SITE_URL` на сервері (sitemap, robots, `getStorefrontRoot`). Canonical і JSON-LD товару (`$productSlug.tsx:6`) переходять з `import.meta.env` на `siteUrl` з кореневих даних | `ConfigProvider.siteUrl` і `.seo` не читає жоден продакшн-код; дві копії URL розходяться. Спека лишила долю `siteUrl` плану, і в одному джерелі правди йому немає місця |
| Е6б-12 | **`useStoreProfile(): StorefrontProfile`** і `StoreProfileProvider({ profile, children })` — `themes/store-profile.tsx` (T4, субшлях `simplycms/themes/store-profile`; теми й `storefront-routes` імпортують донизу). Провайдер монтує host `__root.tsx` над `Outlet`. Без провайдера хук кидає. Тема отримує логотип уже URL-ом (`logoUrl`), а не референсом. Це уточнення сигнатури `useStoreProfile(): StoreProfile` зі спеки | Тема не знає порту сховища. Окремий тип не дає сплутати референс з URL на рівні компіляції |
| Е6б-13 | **Одна authz-операція `settings.manage: { admin: 'any' }`** на профіль, склад, теми й плагіни. Нею ж закривається `pluginConfigWrite` (`plugin-sdk/server/index.ts:93`): `isAdminRequest` → `requireGrant('settings.manage')`, плюс стеля 64 КБ серіалізованого `config` → 400. *(ред.2 — аудит major 10)* Контракт відмови: не-адмін → serverFn кидає `AuthzError` (замість нинішнього `false`); `usePluginConfig.save` (`plugin-sdk/usePluginConfig.ts:78-95`) ловить саме `AuthzError` і повертає `false`, решта помилок летить далі. Публічна сигнатура `save(): Promise<boolean>` для плагінів незмінна. Завантаження логотипа лишається під `media.write` | Прецедент `shipping.manage`. Шлях запису конфігу плагіна лишається одним (`savePluginConfig`, спека), але право на запис дає матриця, а не ad-hoc перевірка |
| Е6б-14 | **Логотип.** `MEDIA_ENTITY_TYPES` += `'store_logo'` (`domain/media.ts:48`), `entityId = null`. `saveStoreProfileOp` перевіряє: `logo` або `null`, або `media.storage_key` з `entity_type = 'store_logo'`. Інакше — `AdminConflictError('state', 'store_logo_invalid')`, 409. Старий логотип при заміні чи прибиранні — `eraseMedia(db, previous)` ОСТАННІМ кроком у тій самій транзакції (прецедент `avatar.ts:118-131`). Посилання на логотип у jsonb гейт `media-columns-coverage` не бачить — це фіксується абзацом у `docs/architecture/storage.md`. *(ред.2 — аудит blocker 3)* `ImageUpload` (`admin/components/ImageUpload.tsx:111-122`) зараз кличе `deleteMedia` одразу під час прибирання з форми. Він отримує проп `eraseOnRemove?: boolean` (за замовчуванням `true` — поведінка інших сутностей незмінна); блок логотипа передає `false`. Тоді стирає лише `saveStoreProfileOp`, після успішного запису; скасування форми чи відмова сервера лишають файл | Без перевірки власник (або підроблений запит) кладе в `logo` довільний URL чи чужий референс, а `resolveMediaUrl` пропускає `https:` як є |
| Е6б-15 | **Активація теми — `activateThemeOp({ data: { name } })`.** Порядок у транзакції: `lockCatalogTarget(db, SITE_THEME_LOCK)` (`'site-theme'`) ПЕРШИМ → `isBuiltTheme(name)`, інакше `'theme_not_built'` → рядок за `name` існує, інакше `'theme_unknown'` → `update themes set is_active=false where is_active` → `update … set is_active=true where name`. Повтор для вже активної — no-op. Після COMMIT — `activeThemeCache.invalidate()`. Повертає `ThemeRow[]` | Частковий унікальний індекс `themes_active_idx` не deferrable: порядок «зняти → поставити» і лок прибирають і 23505, і гонку двох вкладок |
| Е6б-16 | **Налаштування теми — `saveThemeSettingsOp({ data: { name, settings } })`.** `settings: Record<string, string \| number \| boolean>` (вкладеність і масиви — 400), ≤ 64 ключі, ключ ≤ 64, рядок ≤ 1000, серіалізоване ≤ 16 КБ. Перевірки за `ThemeSettingDefinition` на сервері немає: модуль теми живе в браузері, і це фіксується в `themes.md`. Після COMMIT — `activeThemeCache.invalidate()`. `ThemeProvider` (`ThemeContext.tsx:44,88-95`) реагує на зміну `initialThemeName`/`initialThemeSettings`: `didInit` прибрати, ефект за `[initialThemeName, settingsKey]`, де `settingsKey = JSON.stringify(initialThemeSettings)` | Спека: «обмеження розміру jsonb» і «без перезавантаження сторінки» |
| Е6б-17 | **Плагіни.** `listPluginsOp`, `setPluginActiveOp({ data: { name, isActive } })` → `PluginRow` (невідомий → `'plugin_unknown'`). Клієнтську частину бере `syncPluginHooks(name, isActive): Promise<void>` (`plugins/sync-hooks.ts`, T4; логіка реєстрації й зняття хуків — з `adminLifecycle.ts:25-83`, без БД). Новий `usePluginToggle` (`admin/features/plugins/`) працює так: serverFn → `syncPluginHooks`; якщо реєстрація впала — serverFn `isActive: false` + тост. Видаляються `plugins/adminLifecycle.ts`, `plugins/pluginRepository.ts`, їхні реекспорти (`plugins/index.ts:13-21`) і кнопка «Видалити» (С-3) | Серверна операція не може змінити `HookRegistry` браузера. supabase-js лишався лише в цих двох модулях |
| Е6б-18 | **`/api/revalidate-theme` знесено** (`routes/storefront/api/revalidate-theme.tsx`, `storefront/loaders/revalidate-theme.ts`, `admin/lib/revalidateTheme.ts` і їхні тести). Перевірку CSRF для «server route поза serverFn» (`scripts/live-smoke/csrf.mjs:75-95`, `runtime/__tests__/csrf.test.ts:16`, `tests/csrf-middleware.test.ts:81`) переводимо на `POST /api/health`. Очікування: чужий Origin → 403 `Forbidden` від міддлвари; свій Origin → будь-яка відповідь, крім `Forbidden` міддлвари | Скидання кешу тепер робить сама операція (Е6б-15/16). Інших не-serverFn POST-роутів поза `/api/auth/` (виняток CSRF) немає |
| Е6б-19 | **Кеш адмінки.** Ключі `entityKey(ENTITY.systemSettings).all()`, `entityKey(ENTITY.themes).all()`, `entityKey(ENTITY.plugins).all()`; `ENTITY.plugins = 'plugins'` додається (`entity-parity` дозволяє). Колекцій немає (`admin-server-first.ts:11`). Мутації пишуть відповідь сервера через `queryClient.setQueryData` (write-back, К3-7) | Одиничний рядок і короткі списки; прецедент «одинична річ через `useQuery` + serverFn» у адмінці зʼявляється тут |
| Е6б-20 | **Бренд у темах.** `themes/default`: Header показує `<img src={logoUrl} alt={name}>`, а без логотипа — `name`. Footer показує контакти (телефон — `tel:` з `+` і цифрами; email — `mailto:`; адреса; години; порожні поля не рендеряться) і соцмережі (іконка + `aria-label` мережі; мертві `href="#"` зникають). Ключ `theme.brand` видаляється; `theme.footer.copyright` дістає плейсхолдер `{name}`. `simplycms-theme-solarstore`: літерал `SolarStore` (`Header.tsx:111`, `Footer.tsx:21`, `messages.ts:19,59`) замінюється профілем так само; *(ред.2 — аудит major 12)* статичні контакти футера (`Footer.tsx:68-86`: телефон-заглушка, `info@solarstore.ua`, `theme.footer.country`) — контактами профілю за тими ж правилами. *(ред.2 — аудит major 11)* Шаблон теми CLI `packages/cli/template-theme/{components/Header.tsx:18,components/Footer.tsx,messages.ts:13,20}` — так само: без `theme.brand`, бренд з `useStoreProfile()`. Інакше кожна згенерована CLI тема повертає дефект. Ключ ядра `auth.brand` (`Auth.tsx:233`) видаляється — `useStoreProfile().name`. Conformance-kit: `renderThemeView` обгортає `StoreProfileProvider` з фікстурою `STORE_PROFILE_FIXTURE` (`contracts/views/fixtures`) | Спека, «Тема». Solarstore — референс-тема: якщо лишити в ній бренд літералом, кожна тема, скопійована з неї, повторить дефект |
| Е6б-22 | *(ред.2 — аудит major 7)* **Кеш роутера після мутацій.** Після успішних `saveStoreProfile`, `activateTheme` і `saveThemeSettings` адмінка кличе `router.invalidate()` (як легасі `admin/lib/revalidateTheme.ts:15-47`, що зноситься) | Лоадер `_storefront` має `staleTime` 5 хв (`_storefront.tsx:7`). Без скидання перехід із адмінки на вітрину в тій самій вкладці показує старі тему й профіль, хоча кеш сервера вже скинуто |
| Е6б-23 | *(ред.2 — аудит major 8)* **Межа доказу спільного стану.** Те, що `invalidate()` з адмін-serverFn і `get()` з вітринного serverFn ділять один екземпляр модуля `site`, а `declareBuiltThemes` виконується до першої активації, доводить лише `pnpm live:smoke`. Він працює на зібраному `server.mjs`, тобто в production-збірці. Режими `pnpm dev` і `vite preview` гейтом не покриті — це записується в `docs/architecture/test-contours.md` як непокрита зона | Юніт і харнес імпортують модуль один раз за побудовою, тож двох екземплярів не побачать |
| Е6б-21 | **Склад.** `getSystemSettingsOp` → `{ profile: StoreProfile; stockManagement: { decreaseOnOrder: boolean } }`; `saveStockManagementOp({ data: { decreaseOnOrder } })` пише `value.decrease_on_order` (`loadStockManagement` без змін). Профіль і склад — окремі операції: перемикач складу зберігається одразу, профіль — кнопкою форми. Рядок профілю пишеться upsert-ом `on conflict (key) do update` з `id: crypto.randomUUID()` | Читач складу — шлях оформлення замовлення. Склеювати його із записом профілю немає причини |

**Поза Е6б (план каже це вголос):** багатоінстансна інвалідація; серверна валідація налаштувань теми й конфігу плагіна за їхніми схемами (модулі живуть у браузері); прибирання сиріт-логотипів, завантажених без збереження (sweep — К4); `plugins.hooks` (спека не чіпає); legacy-типи `supabase/database.ts` (знос supabase — Е7–Е8).

## Ступінь обовʼязковості — читати ПЕРШИМ

- **КАНОН** (розбіжність → зупинка і звернення до архітектора): рішення Е6б-5…Е6б-23, Global Constraints, імена операцій, serverFn і типів у блоках Interfaces, `STORE_PROFILE_LIMITS`, склад гейтів, асерти Review Focus.
- **ОРІЄНТИР** (виконавець адаптує сам і пише про це у звіті): якорі `файл:рядок`, імена внутрішніх компонентів, розкладка JSX, тексти i18n.
- 🔴 Звіт «гейт зелений» — не доказ. Доказ — вивід команди у звіті задачі. На Е2 двоє виконавців відрапортували ланцюг зеленим, а вісім файлів були без `prettier --write`.
- 🔴 Крок «має бути ЗЕЛЕНИМ одразу» перевіряє припущення плану. Червоний — знахідка: зупинка, а не «полагодити тест».
- 🔴 Лок доводиться детерміновано хелперами `fixtures/advisory-lock.ts` (`holdAdvisoryLock`, `stillPending`). Імовірнісний `Promise.all` як єдиний доказ заборонено: на Е4 він червонів без локу лише в ~4 % прогонів.
- Задачі адресуються заголовками `## Task N:`. Заголовок незмінний, статус — окремим рядком під ним.

## Протокол виконання

- **Ролі.** Виконує сесія-оркестратор (subagent-driven). **Архітектор — сесія, що написала цей план**; звернення — `SendMessage` на імʼя з `ListAgents`. Ескалація ДО коду: розбіжність із КАНОНОМ; «зелений одразу» вийшов червоним; потрібне рішення, якого план не містить. Відповідь — рішення `Е6б-N`, вписане в таблицю окремим docs-комітом.
- **Рев'ю.** Після кожної задачі — рев'ю задачі (SDD). Після Task 8 — фінальне рев'ю гілки архітектором. Мерж і пуш — рішення власника.
- **Стенд.** `PG_HARNESS_URL=postgresql://pgtest@127.0.0.1:55434/postgres`. RED одного файлу харнеса — `pnpm exec vitest run --config vitest.schema.config.ts <фільтр>`.

## Global Constraints

- TypeScript 6.0 strict (`UPSTREAM:TSESL-1`). Node `>=22.12`.
- Коментарі й доки — українською; рядки інтерфейсу — лише i18n (`i18n/catalogs/{uk,en}/**` ядра, `messages.ts` тем — обидві мови, парність — `catalog-integrity.test.ts`, `theme-messages`/`plugin-messages-parity`).
- `pnpm lint` = 0 errors / ≤ 8 warnings.
- 🔴 Ліміт 150 рядків на новий або переписаний файл; `wc -l` нових файлів — у звіті кожної задачі з UI. Виняток — `admin-server/index.ts` (К3-9′). На Е4 без явного ліміту в плані зʼявилось 9 файлів до 350 рядків.
- Повний ланцюг: `pnpm install --frozen-lockfile → format:check → lint → build → typecheck → test → test:schema → build:packages → typecheck:template → test:packaging → pilot:pack --skip-build`.
- Мінімальний гейт задачі: `pnpm lint && pnpm typecheck && pnpm test`; плюс `pnpm test:schema`, якщо зачеплено `schema/`, `migrations/`, `site/`, `storefront/loaders/`, `admin-server/impl/**`, `plugin-sdk/server/`, `test-harness/`; плюс `pnpm build:packages && pnpm pilot:pack --skip-build`, якщо зачеплено серверний код пакета, `exports` або host-файли.
- К3-4′/К3-9′: `createServerFn` — лише топ-рівневий `const` в `admin-server/index.ts`; нутрощі — `admin-server/impl/**` через bare-специфікатор. Вітринні serverFn — модуль `storefront-routes/server/*.ts` з РІВНО одним експортом.
- К3-13: кожна адмін-операція — через `runAdmin('settings.manage', fn)`; 409 ставиться до `throw`.
- К3-7: write-back замість self-invalidation; `mutation-cache-sync` і `query-key-from-entity` без послаблень.
- Нові serverFn — у фабрику моку `admin-server/__tests__/support/admin-server-mock.ts`.
- Host-файли (`src/routes/__root.tsx`, `src/server.ts`) правляться в корені монорепо, далі `pnpm template:sync`; копії в `packages/cli/host/` і `packages/create-simplycms-store/template/` руками не правляться. `template/simplycms.config.ts` синком НЕ покривається — правиться руками.
- Ключ `id` генерує викликач (`crypto.randomUUID()`).
- Тіри: `contracts` = T0, `domain` = T1, `site`/`admin-server`/`storefront` = T2, `themes`/`plugins`/`plugin-sdk` = T4, `admin`/`storefront-routes`/`routes/*` = T5.
- Коміти: `feat(k3-e6b): …`, `test(k3-e6b): …`, `docs(k3-e6b): …`; без трейлерів `Co-Authored-By`/`Generated with`.

## Review Focus

1. **Рядок `store_profile` зіпсований або відсутній** (ручний SQL, старий дамп): вітрина рендериться з 200, `<title>` — лише назва сторінки без « — »; форма адмінки відкривається з дефолтами, і збереження лагодить рядок. Тест — Task 1 (`parseStoreProfile` на `null`, `{}`, `{ name: 42, socials: 'x' }`, `socials` з `http:`/`javascript:` url) і Task 2 (лоадер без рядка → `EMPTY_STORE_PROFILE` з `logoUrl: null`).
2. **Власник замінює або прибирає логотип; підроблений запит кладе чужий референс чи зовнішній URL.** Старий файл і рядок `media` зникають у тій самій транзакції. Невдале збереження лишає старий логотип і файл на місці. `logo: 'https://evil.example/x.png'` або референс `entity_type = 'product'` → `store_logo_invalid`, профіль незмінний. Тест — Task 3 (SQL-стан після кожного кейсу).
3. **Власник зберіг — наступний запит вітрини вже бачить зміну**, навіть якщо читання вітрини стартувало до COMMIT. Тест — Task 2, детермінований, на `createReadCache`: `get(load)` стоїть на керованому промісі, `invalidate()`, проміс резолвиться старим значенням → наступний `get(load2)` кличе `load2`, а не віддає кешоване старе. Live-доказ на прогрітому кеші — Task 8 (Е6б-23).
4. **Активація теми, якої немає в збірці** (рядок лишився після видалення пакета), **і дві вкладки активують різні теми одночасно** → `theme_not_built` без змін у БД; рівно одна `is_active`, без 500/23505. Тест — Task 3 (`holdAdvisoryLock('site-theme')` → `stillPending` → release).
5. **Налаштування теми типів `text`/`number` і запис неприпустимого значення.** Форма рендерить усі пʼять типів і зберігає `number` числом. Прямий запит із вкладеним обʼєктом або > 16 КБ → 400, рядок незмінний. Тест — Task 3 (сервер) і Task 7 (форма).

Додатково: соцмережа з `http://` або `javascript:` → 400 на записі (Task 3); назва з `</script>` не ламає JSON-LD головної (Task 4); порожній `VITE_SITE_URL` → `Organization` без `url` і `logo` (Task 4); не-адмін на будь-якій новій операції й на `pluginConfigWrite` → `AuthzError`, БД незмінна (Task 3).

## Граф залежностей задач

```
Task 1 (контракти, розбір, схема, сід) ─► Task 2 (модуль site: кеші, вшиті теми) ─► Task 3 (authz + операції адмінки)
Task 3 ─┬─► Task 4 (корінь вітрини, head, i18n, JSON-LD, без seo в конфігу) ─► Task 5 (теми читають профіль)
        ├─► Task 6 (сторінка «Налаштування»)
        └─► Task 7 (теми й плагіни в адмінці, знос легасі)
Task 5, 6, 7 ─► Task 8 (live:smoke, доки, гейти)
```

Task 4, 6, 7 між собою незалежні, але комітять у спільну гілку — ідуть ПОСЛІДОВНО в порядку номерів. Task 7 після Task 6, бо обидві правлять `tests/admin-server-first/registry.ts`.

## File Structure

**Створюються:**
- `packages/simplycms/src/contracts/store-profile.ts`; `packages/simplycms/src/domain/store-profile.ts` (+ `domain/__tests__/store-profile.test.ts`);
- `packages/simplycms/src/site/{index,read-cache,store-profile,built-themes}.ts` (+ `site/__tests__/`); `storefront/loaders/store-profile.ts`;
- `packages/simplycms/src/admin-server/impl/{settings,themes,plugins}/**`; `test-harness/pg/__tests__/admin-system.test.ts`;
- `packages/simplycms/src/storefront-routes/server/root.ts`; `storefront-routes/head/{head,organization}.ts` (+ тести);
- `packages/simplycms/src/themes/store-profile.tsx`; `contracts/views/fixtures/store-profile.ts`;
- `packages/simplycms/src/plugins/sync-hooks.ts`;
- `packages/simplycms/src/admin/features/{settings,themes,plugins}/**`;
- `scripts/live-smoke/admin-system{,-sql}.mjs`.

**Змінюються:** схема й канон міграцій (Е6б-5); `domain/media.ts`; `auth/authz.ts`; `contracts/{entities,ports/index,objects/config}.ts`; `admin-server/{index,impl/index}.ts` і мок; `plugin-sdk/server/{index,config-db}.ts`; `plugins/{index,types,server/registry-db}.ts`; `storefront/loaders/{theme-record,index}.ts`; `admin/components/ImageUpload.tsx`; `plugin-sdk/usePluginConfig.ts`; `themes/{ThemeContext.tsx,conformance/render.tsx}`; `runtime/config.ts`; host `src/{routes/__root.tsx,server.ts,engine.shared.ts}` + `pnpm template:sync`; `simplycms.config.ts`, `packages/create-simplycms-store/template/simplycms.config.ts`; 15 route-файлів `packages/simplycms/routes/storefront/**`; `themes/default/**`, `packages/simplycms-theme-solarstore/src/**`, `packages/cli/template-theme/**`; i18n-каталоги; `admin/pages/{Settings,Themes,ThemeSettings,Plugins,PluginSettings}.tsx` (реекспорти); `tests/{admin-server-first/registry.ts,i18n-coverage/pending.ts,csrf-middleware.test.ts}`; `scripts/live-smoke/{csrf,owner-steps}.mjs`; доки.

**Видаляються:** `admin/hooks/{usePluginToggle,useThemeActivate}.ts`, `admin/lib/revalidateTheme.ts`, `plugins/{adminLifecycle,pluginRepository}.ts`, `storefront/loaders/revalidate-theme.ts`, `routes/storefront/api/revalidate-theme.tsx` і тести цих модулів.

---

## Task 1: Контракти профілю, розбір і схема (Е6б-5, Е6б-6, Е6б-14)

**Files:**
- Create: `contracts/store-profile.ts`, `domain/store-profile.ts`, `domain/__tests__/store-profile.test.ts`
- Modify: `packages/simplycms/package.json` (`exports` + `publishConfig.exports`: `./contracts/store-profile`, `./domain/store-profile`); `domain/media.ts:48` (`'store_logo'`); `schema/schema.ts` (`pluginEvents` :498 видалити, `plugins.migrationsApplied` :519 видалити), `schema/types.ts:33,162`; `migrations/{0001_init,0002_grants,0003_seed}.sql`, `migrations/demo/demo-seed.sql`, `drizzle/{0000_init.sql,meta/0000_snapshot.json}`; `plugins/{types.ts:41-106,server/registry-db.ts:29,71}` (без `migrations_applied`); `test-harness/pg/__tests__/fixtures/grants.ts:52` (`ADMIN_ONLY` без `plugin_events`); `scripts/pilot-pack/seed-sql.mjs:121` (перевірити колонки `SEED_PLUGIN`); доки, що згадують видалене (`docs/architecture/{cli.md:176,plugins.md:42,themes.md:394}`); фікстури тестів, що згадують `migrations_applied` (`plugins/__tests__/bootstrap.test.ts:41`, `admin/__tests__/usePluginToggle.test.tsx:44` — цей файл видаляється в Task 7, тут лише мінімальна правка під типи); копії `pnpm template:sync`

**Interfaces:**
- Produces: усе з Е6б-6 дослівно. `parseStoreProfile(json: unknown): StoreProfile` і `EMPTY_STORE_PROFILE: StoreProfile` (`name: ''`, решта `null`/`[]`; сід підставляє `'Мій магазин'`).

- [ ] **Step 1: Юніти розбору (червоні)** — `domain/__tests__/store-profile.test.ts`:

```ts
it('null, {} і рядок → EMPTY_STORE_PROFILE, без throw', () => {
  for (const raw of [null, {}, 'x']) expect(parseStoreProfile(raw)).toEqual(EMPTY_STORE_PROFILE);
});
it('невалідні типи полів → дефолти поля, валідні збережено', () => {
  expect(parseStoreProfile({ name: 42, description: 'Опис', socials: 'x' }))
    .toEqual({ ...EMPTY_STORE_PROFILE, description: 'Опис' });
});
it('socials: невідома мережа, http: і javascript: відкинуто; понад 10 — обрізано', () => {
  const ok = { network: 'telegram', url: 'https://t.me/shop' };
  const raw = { name: 'A', socials: [ok, { network: 'myspace', url: 'https://x' },
    { network: 'x', url: 'http://x.com' }, { network: 'x', url: 'javascript:alert(1)' },
    ...Array(12).fill(ok)] };
  expect(parseStoreProfile(raw).socials).toHaveLength(10);
  expect(parseStoreProfile(raw).socials.every((s) => s.url.startsWith('https://'))).toBe(true);
});
it('повний валідний профіль — тотожність', () => {});
```

- [ ] **Step 2: Харнес (червоний)** — `baseline.test.ts` / новий кейс у `theme-plugin-registry.test.ts`: після накату канону `select value from system_settings where key='store_profile'` → `{ name: 'Мій магазин', … }`, `active_theme` відсутній, `to_regclass('public.plugin_events') is null`, колонки `plugins.migrations_applied` немає; демо-сід → `value->>'name'` = демо-назва; `seed-determinism.test.ts` зелений без зміни чисел 6/20 (демо — `UPDATE`, Е6б-5).
- [ ] **Step 3: Реалізація** за Interfaces і Е6б-5; `pnpm template:sync`; `drizzle-kit generate` → «No schema changes» (вивід у звіт).
- [ ] **Step 4: Зелене** — Run: `pnpm test:schema && pnpm lint && pnpm typecheck && pnpm test` → PASS.
- [ ] **Step 5: Коміт** — `feat(k3-e6b): контракт профілю магазину, поблажливий розбір і baseline без plugin_events`.

---

## Task 2: Модуль `simplycms/site` — кеші профілю й теми, вшиті теми (Е6б-7…Е6б-9)

**Files:**
- Create: `site/{index,read-cache,store-profile,built-themes}.ts`, `site/__tests__/{read-cache,store-profile,built-themes}.test.ts`, `storefront/loaders/store-profile.ts` (+ реекспорт у `storefront/loaders/index.ts`), `storefront/loaders/__tests__/theme-record-cache.test.ts` (кейси кешу з `storefront-routes/__tests__/revalidate-theme.test.ts:120-200`, який зноситься в Task 7)
- Modify: `storefront/loaders/theme-record.ts:28-92` (модульний кеш → `activeThemeCache`; `ThemeRecord` — з `site`; `invalidateThemeCache` геть), `test-harness/pg/__tests__/theme-plugin-registry.test.ts:24` (імпорт `loadActiveTheme` лишається; звірити, що файл зелений), `themes/ThemeContext.tsx:22` (докблок), `eslint.tier-zones.mjs:71-102` (новий рядок `['src/site', 2, 'site', ['db']]`; `site` в upward-винятках `storefront` і `admin-server`, коментар-обґрунтування), `contracts/server-only.ts:~65` (`'site'`), `package.json` (`./site` в `exports` і `publishConfig.exports`), `packages/README.md` (рядок таблиці тірів), `tests/tier-boundary.test.ts` (якщо перелічує теки)

**Interfaces:**
- `site`: `createReadCache<T>(ttlMs): ReadCache<T>` (помилку `load` не кешує й пропускає далі); `storeProfileCache`, `activeThemeCache`; `readStoreProfile(db: ActorDb): Promise<StoreProfile>` — `system_settings[STORE_PROFILE_KEY]` через `parseStoreProfile`, рядка немає → `EMPTY_STORE_PROFILE`; `toStorefrontProfile(p)` — `logoUrl = resolveMediaUrl(p.logo)`.
- `storefront/loaders`: `loadStoreProfile(): Promise<StorefrontProfile>` (Е6б-7); `loadActiveTheme(): Promise<ThemeRecord | null>` — сигнатура без змін, кеш — `activeThemeCache`.
- `declareBuiltThemes(names: readonly string[]): void`, `isBuiltTheme(name: string): boolean` (Е6б-8; повторний виклик замінює набір).

- [ ] **Step 1: Тести (червоні)** — `createReadCache`: другий `get` у межах TTL не кличе `load`; після `invalidate()` кличе; після TTL (фейкові таймери) кличе; помилка `load` не кешується; **Review Focus 3** — детермінований кейс поколінь (Е6б-9). Харнес `readStoreProfile`: рядка немає → `EMPTY_STORE_PROFILE`, `toStorefrontProfile` дає `logoUrl: null` (Review Focus 1); `isBuiltTheme` до декларації → `false`, після `declareBuiltThemes(['default'])` → `true` лише для `default`.
- [ ] **Step 2: Негативний контроль** (вивід у звіт): прибрати перевірку покоління → кейс Review Focus 3 червоніє.
- [ ] **Step 3: Реалізація.**
- [ ] **Step 4: Зелене** — Run: `pnpm lint && pnpm typecheck && pnpm test && pnpm test:schema && pnpm build:packages && pnpm pilot:pack --skip-build` → PASS; Gate C зелений (новий server-only субшлях не протік у клієнт).
- [ ] **Step 5: Коміт** — `feat(k3-e6b): модуль site — спільний кеш профілю й теми з поколіннями, вшиті теми`.

---

## Task 3: Право `settings.manage` і операції адмінки (Е6б-13…Е6б-17, Е6б-21)

**Files:**
- Create: `admin-server/impl/settings/{get,save-profile,save-stock,profile-schema}.ts`, `admin-server/impl/themes/{list,activate,save-settings}.ts`, `admin-server/impl/plugins/{list,set-active}.ts`, `test-harness/pg/__tests__/admin-system.test.ts`
- Modify: `auth/authz.ts:33-86` + `auth/__tests__/authz.test.ts` (блок за зразком `:73-80`); `contracts/domain-errors.ts` (нові `constraint`); `admin-server/impl/index.ts`, `admin-server/index.ts`, мок; `plugin-sdk/server/index.ts:93-108` і `plugin-sdk/usePluginConfig.ts:78-95` (Е6б-13, контракт відмови) + `plugin-sdk/__tests__/usePluginConfig.test.tsx:110` (мок відмови — `AuthzError`, а не `false`); `admin/lib/admin-error.ts` і i18n `admin/errors.ts` (тости для `store_logo_invalid`, `theme_not_built`, `theme_unknown`, `plugin_unknown`)

**Interfaces:**
- serverFn (усі `runAdmin('settings.manage', …)`): `getSystemSettings` → `{ profile: StoreProfile; stockManagement: { decreaseOnOrder: boolean } }`; `saveStoreProfile({ data: StoreProfile })` → `StoreProfile`; `saveStockManagement({ data: { decreaseOnOrder: boolean } })` → `{ decreaseOnOrder: boolean }`; `listThemes` → `ThemeRow[]`; `activateTheme({ data: { name: string } })` → `ThemeRow[]`; `saveThemeSettings({ data: { name: string; settings: Record<string, string | number | boolean> } })` → `ThemeRow`; `listPlugins` → `PluginRow[]`; `setPluginActive({ data: { name: string; isActive: boolean } })` → `PluginRow`.
- `ThemeRow = { id; name; displayName; version; description; author; previewImage; isActive; settings }`, `PluginRow = { id; name; displayName; version; description; author; isActive; config; updatedAt }` — експортуються типами з `simplycms/admin-server` (без `hooks`).
- `storeProfileInput` (Zod, `profile-schema.ts`): ліміти — `STORE_PROFILE_LIMITS`; `name` trim, min 1; `email` — `z.email()`; `socials[].url` — `z.url()` + `startsWith('https://')`; `network` — `z.enum(SOCIAL_NETWORKS)`; невідомі ключі відкидаються.
- `SITE_THEME_LOCK = 'site-theme'`. Скидання кешу — ПІСЛЯ повернення `runAdmin` (Е6б-9): `saveStoreProfile` → `storeProfileCache.invalidate()`; `activateTheme`/`saveThemeSettings` → `activeThemeCache.invalidate()`. `getSystemSettings` читає `readStoreProfile(db)` з `site` (одне правило розбору для вітрини й адмінки).

- [ ] **Step 1: Харнес-тест (червоний)** — шапка як `admin-catalog-dictionaries.test.ts:1-60`; перед кейсами `declareBuiltThemes(['default', 'solarstore'])`:

```ts
describe('admin: система (Е6б, Task 3)', () => {
  it('saveStoreProfile пише профіль; getSystemSettings читає його ж', async () => {});
  it('заміна логотипа: старий рядок media і файл стерто, новий на місці (одна транзакція)', async () => {});
  it('logo = "https://evil.example/x.png" → store_logo_invalid; профіль і media незмінні', async () => {});
  it('logo = референс media з entity_type product → store_logo_invalid', async () => {});
  it('saveStoreProfile впав (store_logo_invalid) → старий логотип: рядок media і файл на місці', async () => {});
  it('socials з http:// і javascript: → 400 (AdminValidationError), профіль незмінний', async () => {});
  it('saveStockManagement(false) → value.decrease_on_order = false; loadStockManagement бачить false', async () => {});
  it('activateTheme("solarstore") → рівно одна is_active, це solarstore; повтор — no-op', async () => {});
  it('activateTheme рядка, якого немає у declareBuiltThemes → theme_not_built; активна тема незмінна', async () => {});
  it('activateTheme стоїть, поки зовнішній тримає site-theme (holdAdvisoryLock/stillPending); після release — одна активна', async () => {});
  it('saveThemeSettings: вкладений обʼєкт → 400; > 16 КБ → 400; рядок незмінний', async () => {});
  it('saveThemeSettings { radius: 8, title: "x" } → number лишився number у jsonb', async () => {});
  it('setPluginActive faq false → is_active false; невідомий → plugin_unknown', async () => {});
  it('не-адмін на кожній операції → AuthzError, БД незмінна', async () => {});
});
```

🔴 Порожні тіла вище — лише перелік. До запуску RED кожен `it` написаний повністю (виклик операції, точний `kind`/`constraint`, SQL-стан після), і звіт показує, що кожен падає з ОЧІКУВАНОЇ причини. Скидання кешу — юніт поруч з операцією (мок `simplycms/site`): `invalidate()` кличеться рівно раз і ПІСЛЯ успішного `runAdmin`, на відмові — не кличеться. `pluginConfigWrite`: не-адмін → `AuthzError`; `config` > 64 КБ → 400. `usePluginConfig.save`: `pluginConfigWrite` відхиляє `AuthzError` → `save` резолвить `false`; інша помилка → `save` відхиляє (Е6б-13).

Негативний контроль (вивід у звіт): прибрати `lockCatalogTarget` з `activateThemeOp` → кейс локу червоніє; прибрати перевірку `entity_type` логотипа → червоніє кейс `product`.

- [ ] **Step 2: Реалізація** за Interfaces і Е6б-13…Е6б-17, Е6б-21.
- [ ] **Step 3: Зелене** — Run: `pnpm test:schema && pnpm lint && pnpm typecheck && pnpm test && pnpm build:packages && pnpm pilot:pack --skip-build` → PASS.
- [ ] **Step 4: Коміт** — `feat(k3-e6b): settings.manage і серверні операції профілю, складу, тем і плагінів`.

---

## Task 4: Корінь вітрини, заголовки через i18n, JSON-LD, конфіг без `seo` (Е6б-8, Е6б-10, Е6б-11)

**Files:**
- Create: `storefront-routes/server/root.ts` (`getStorefrontRoot`, кличе `loadStoreProfile` і `loadActiveTheme` з `storefront/loaders`), `storefront-routes/head/{head,organization}.ts` + субшлях `./storefront-routes/head/*` (`exports` і `publishConfig.exports`; НЕ в `SERVER_ONLY`) + `storefront-routes/__tests__/{storefront-head,organization-jsonld}.test.ts`, `themes/store-profile.tsx` (+ тест: без провайдера хук кидає) і субшлях `./themes/store-profile`
- Modify: host `src/routes/__root.tsx` (лоадер Е6б-10; `head` з профілю замість літералів `:71-74`; `<StoreProfileProvider profile={storeProfile}>` над `Outlet`), `src/server.ts` (`declareBuiltThemes`, Е6б-8), `src/engine.shared.ts` (без `seo`/`siteUrl`) → `pnpm template:sync`; `runtime/config.ts:17-33` (без `SimplyCmsSeoConfig`), `runtime/README.md`, `contracts/ports/index.ts:95-100`, `contracts/objects/config.ts:3-9`, тест-стаби (`react-query/__tests__/engine-provider.test.tsx:23`, `storefront-routes/__tests__/engine-stub.tsx:32`, `admin/features/products/edit/__tests__/test-engine-stub.ts:22`); `simplycms.config.ts`, `packages/create-simplycms-store/template/simplycms.config.ts`; 15 route-файлів зі списку `tests/i18n-coverage/pending.ts:96-110` + `$productSlug.tsx:6,41,66` (`siteUrl` з кореня, опис через i18n із плейсхолдером назви); `_storefront/index.tsx` (`homeTitle ?? name`, `scripts: [organization]`); `tests/i18n-coverage/pending.ts` (15 рядків геть, коментар `:86-99` — борг закрито рішенням Е6б-10); i18n-каталоги ядра (назви сторінок для `head`; повторно використати наявні `cart.title`, `checkout.title`, `catalog.title`, `profile.orders.title` тощо, нові — лише за відсутності)

**Interfaces:**
- `StorefrontRootData = { activeThemeName: string; storeProfile: StorefrontProfile; siteUrl: string; locale: string }`; `readStorefrontRoot(matches)`, `storefrontHead(matches, page)` — Е6б-10 дослівно.
- `buildOrganizationJsonLd(profile: StorefrontProfile, siteUrl: string): { type: 'application/ld+json'; children: string }`: `@type: 'Organization'`, `name`, `url = siteUrl` (порожній → поле відсутнє), `logo = siteUrl + logoUrl` (лише коли є обидва), `telephone`, `email`, `address`, `sameAs = socials.map(s => s.url)`; `null`/порожні поля не серіалізуються; кожен `<` у серіалізованому JSON → послідовність `\u003c` (як `.replace(/</g, '\\u003c')` у `$productSlug.tsx:49-79`).

- [ ] **Step 1: Тести (червоні)** — `storefrontHead`: `{ name: 'Крамниця' }` + сторінка «Кошик» → `title` = «Кошик — Крамниця»; `name: ''` → «Кошик» (Review Focus 1); опис сторінки відсутній → `profile.description`; `matches` без кореневих даних → кидає з повідомленням про host. `buildOrganizationJsonLd`: `name: 'A</script><b>'` → у `children` немає `</script>` (Додатково); `siteUrl: ''` → немає `url` і `logo`; `sameAs` — url соцмереж у порядку профілю.
- [ ] **Step 2: Реалізація.** Літерали `SimplyCMS Store` зникають із `packages/simplycms/routes/**` і host-а.
- [ ] **Step 3: Перевірка** — Run: `rg -n "SimplyCMS Store" packages/simplycms src simplycms.config.ts packages/create-simplycms-store/template/src` → порожньо, крім i18n `auth.brand` (зникає в Task 5); `rg -c "routes/storefront" tests/i18n-coverage/pending.ts` → `0`.
- [ ] **Step 4: Зелене** — Run: `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm build:packages && pnpm typecheck:template && pnpm pilot:pack --skip-build` → PASS (`build` — бо змінено route-файли і host). Gate C зелений — доказ, що `storefront-routes/head` не тягне server-only у клієнт (аудит blocker 2).
- [ ] **Step 5: Коміт** — `feat(k3-e6b): профіль у корені вітрини — заголовки через i18n, Organization JSON-LD, конфіг без seo`.

---

## Task 5: Теми читають профіль (Е6б-12, Е6б-16 — `ThemeProvider`, Е6б-20)

**Files:**
- Create: `contracts/views/fixtures/store-profile.ts` (`STORE_PROFILE_FIXTURE: StorefrontProfile` — з логотипом, двома соцмережами й усіма контактами) + експорт у барель фікстур
- Modify: `themes/ThemeContext.tsx:39-95` (Е6б-16); `themes/conformance/render.tsx:25-38`; `themes/default/{components/Header.tsx:75,components/Footer.tsx:60-114,messages.ts}`; `packages/simplycms-theme-solarstore/src/{components/Header.tsx:111,components/Footer.tsx:21,68-86,94,messages.ts:19,59}`; `packages/cli/template-theme/{components/Header.tsx:18,components/Footer.tsx,messages.ts:13,20,conformance.test.ts.tpl}` (Е6б-20); `storefront-routes/pages/Auth.tsx:233` + i18n `auth.brand` (геть з `uk`/`en`); `docs/architecture/themes.md` (§1-2 контракт: тема отримує профіль як дані ядра; §7 conformance; §8 «серверної валідації налаштувань немає»); `pnpm template:sync` (тема `default` синкається)

**Interfaces:**
- Consumes: `useStoreProfile()` (Task 4), `STORE_PROFILE_FIXTURE`.

- [ ] **Step 1: Тести (червоні):**
  - `ThemeProvider`: rerender із новими `initialThemeSettings` → `useThemeSettings()` повертає нові значення без remount;
  - default Header: `logoUrl` є → `<img alt={name}>`, бренду-тексту немає; `logoUrl: null` → текст `name`;
  - default Footer: телефон `+380 (44) 123-45-67` → `href="tel:+380441234567"`; порожня адреса не рендериться; соцмережа має `href` з профілю й `aria-label`; посилань `href="#"` немає;
  - solarstore Header/Footer — ті самі кейси бренду й контактів (заглушок `+380 (XX)`, `info@solarstore.ua` немає); `rg -n "SolarStore" packages/simplycms-theme-solarstore/src` → лише назва пакета/маніфест (`displayName`), не JSX і не `messages`;
  - шаблон теми CLI: `rg -n "theme.brand" packages/cli/template-theme` → порожньо; наявний тест генерації теми CLI (`simplycms theme` / `theme:conformance`) зелений на згенерованій темі;
  - conformance-kit зелений для обох тем (`pnpm theme:conformance` або наявний тест kit-а).
- [ ] **Step 2: Реалізація.**
- [ ] **Step 3: Зелене** — Run: `pnpm lint && pnpm typecheck && pnpm test && pnpm build:packages && pnpm typecheck:template` → PASS; `wc -l` змінених компонентів тем — у звіт.
- [ ] **Step 4: Коміт** — `feat(k3-e6b): теми беруть бренд, логотип, контакти й соцмережі з профілю`.

---

## Task 6: Сторінка «Налаштування» (С-1, Е6б-14, Е6б-19, Е6б-21)

**Files:**
- Create: `admin/features/settings/**` (`SettingsPage`, `useSystemSettings` (query + write-back), `StoreProfileForm` з блоками «Профіль і SEO», «Контакти», «Логотип», «Соцмережі», `StockManagementCard`, клієнтська Zod-схема форми з `STORE_PROFILE_LIMITS`, `__tests__/`)
- Modify: `admin/pages/Settings.tsx` → однорядковий реекспорт (як `PriceTypeEdit.tsx`); `admin/components/ImageUpload.tsx:111-122` (проп `eraseOnRemove`, Е6б-14) + тест; i18n `admin/settings.ts` (uk/en); `tests/admin-server-first/registry.ts` (−1 запис `Settings.tsx`)

**Interfaces:**
- Consumes: `getSystemSettings`, `saveStoreProfile`, `saveStockManagement`, `uploadMedia` (`ImageUpload` з `entityType="store_logo"`, `maxImages={1}`, `eraseOnRemove={false}`, прецедент `SectionSideCards.tsx:66-74`). Після успішного `saveStoreProfile` — `router.invalidate()` (Е6б-22).
- Соцмережі — рядки «мережа (select із `SOCIAL_NETWORKS`) + посилання», додати/прибрати, ≤ 10 (кнопка «Додати» вимикається на 10-му).

- [ ] **Step 1: Тести (червоні)** — форма відкривається з даними `getSystemSettings`; збереження шле `saveStoreProfile` з `logo` = референс, а не URL; 409 `store_logo_invalid` → тост; посилання `http://…` → помилка поля, запиту немає; перемикач складу шле `saveStockManagement` одразу й оновлює кеш write-back без refetch (`isInvalidated === false`, дані в кеші — відповідь сервера); **Review Focus 2, клієнт:** прибрати логотип із форми й не зберегти → `deleteMedia` НЕ викликано; `ImageUpload` без пропа → `deleteMedia` викликано (поведінка інших сутностей незмінна); успішне збереження → `router.invalidate` викликано.
- [ ] **Step 2: Реалізація.**
- [ ] **Step 3: Зелене** — Run: `pnpm lint && pnpm typecheck && pnpm test` → PASS; `wc -l` нових файлів ≤ 150.
- [ ] **Step 4: Коміт** — `feat(k3-e6b): сторінка налаштувань — профіль магазину, логотип, соцмережі, склад`.

---

## Task 7: Теми й плагіни в адмінці, знос легасі (С-3, Е6б-15…Е6б-18)

**Files:**
- Create: `admin/features/themes/**` (`ThemesPage`, `ThemeSettingsPage`, `ThemeSettingField` для пʼяти типів, `useThemes`, `__tests__/`), `admin/features/plugins/**` (`PluginsPage`, `PluginSettingsPage`, `usePluginToggle`, `usePlugins`, `__tests__/`), `plugins/sync-hooks.ts` (+ тест)
- Modify: `admin/pages/{Themes,ThemeSettings,Plugins,PluginSettings}.tsx` → реекспорти; `contracts/entities.ts` (`plugins: 'plugins'`, Е6б-19); `plugins/index.ts:13-21`; `admin/index.ts:30-36` (якщо реекспортує хуки); `scripts/live-smoke/csrf.mjs:75-95`, `runtime/__tests__/csrf.test.ts:16`, `tests/csrf-middleware.test.ts:81`, `auth/__tests__/authz-request.test.ts:3`, `scripts/live-smoke.mjs:20` (Е6б-18); `tests/e2e/admin-smoke/theme.e2e.ts` (привести до нових сторінок або видалити, якщо тестує знесений ендпоінт; рішення — у звіт); i18n `admin/{themes,plugins}.ts`; `tests/admin-server-first/registry.ts` (−6 записів); `docs/architecture/plugins.md` (§3 рантайм-контур без `adminLifecycle`; §4 «`plugins.config` публічний — контракт v1, секрети — після К5»; §6 запис через `pluginConfigWrite` під `settings.manage`)
- Delete: `admin/hooks/{usePluginToggle,useThemeActivate}.ts`, `admin/lib/revalidateTheme.ts`, `plugins/{adminLifecycle,pluginRepository}.ts`, `storefront/loaders/revalidate-theme.ts`, `routes/storefront/api/revalidate-theme.tsx`, тести `admin/__tests__/{Themes,ThemeSettings,usePluginToggle,revalidate-storefront}.test.*`, `storefront-routes/__tests__/revalidate-theme{,-route}.test.ts` (те, що вони доводили про кеш, уже живе в `storefront/loaders/__tests__/theme-record-cache.test.ts`, Task 2)
- Rewrite: `plugins/__tests__/plugin-toggle.test.tsx:4` (імпортує `../adminLifecycle`) → на `syncPluginHooks`, зі збереженням перевірки, що `PluginSlot` оновлюється після вмикання і вимикання

**Interfaces:**
- Consumes: `listThemes`, `activateTheme`, `saveThemeSettings`, `listPlugins`, `setPluginActive`, `pluginConfigWrite`, `ThemeRegistry` (статус «не вшита» — як `Themes.tsx:85`), `getRegisteredPluginModules()`, `settingsFields()` (`admin/lib/pluginSettingsFields.ts:24`).
- `syncPluginHooks(name: string, isActive: boolean): Promise<void>` — кидає, якщо `register` модуля впав (хуки при цьому зняті).
- Сторінка плагінів: перемикач і «Налаштування»; кнопки «Видалити» немає (С-3). Налаштування плагіна пишуться `pluginConfigWrite` з `config`, провалідованим Zod-схемою плагіна в браузері (як `PluginSettings.tsx:134`).

- [ ] **Step 1: Тести (червоні)** — форма налаштувань теми рендерить `text` (Input) і `number` (Input `type=number` з `min`/`max`) і шле `number` числом (Review Focus 5); тема без модуля в `ThemeRegistry` — кнопка «Активувати» вимкнена з підказкою; 409 `theme_not_built` → тост; активація оновлює бейдж в обох рядках write-back без refetch; `usePluginToggle`: `syncPluginHooks` кидає → другий виклик `setPluginActive({ isActive: false })` і тост; на сторінці плагінів немає кнопки видалення; успішні `activateTheme` і `saveThemeSettings` → `router.invalidate` викликано (Е6б-22).
- [ ] **Step 2: Перевірка CSRF «зелена одразу»** — після правки `csrf.mjs` на `POST /api/health`: чужий Origin → `403 Forbidden`, свій → не `Forbidden`. Перевірити ДО live-прогону: `pnpm build && node server.mjs` + `curl -si -X POST -H 'Origin: https://evil.example' localhost:<port>/api/health` і зі своїм Origin (вивід у звіт). Якщо свій Origin теж дає `Forbidden` — ескалація (Е6б-18 хибне).
- [ ] **Step 3: Реалізація** і знос за Files.
- [ ] **Step 4: Перевірка** — Run: `rg -l useSupabaseClient packages/simplycms/src/admin | wc -l` → **17**; `rg -n "revalidate-theme|adminLifecycle|pluginRepository|uninstallPlugin" packages scripts tests src --glob '!**/routeTree.gen.ts'` → порожньо.
- [ ] **Step 5: Зелене** — Run: `pnpm lint && pnpm typecheck && pnpm test && pnpm build` → PASS (`build` — бо видалено route-файл).
- [ ] **Step 6: Коміт** — `feat(k3-e6b): теми й плагіни на серверному шарі, знос revalidate-theme і supabase-життєвого циклу плагінів`.

---

## Task 8: Живий прогін, доки, повний ланцюг

**Files:**
- Create: `scripts/live-smoke/admin-system.mjs` (`runAdminSystemStep({ context, buyerPage, base, dbUrl, check })`), `scripts/live-smoke/admin-system-sql.mjs`
- Modify: `scripts/live-smoke/owner-steps.mjs` (крок — ОСТАННІМ, після доставки); доки: `docs/tasks/v2-state-map.md` (`:131-136`, `:584`, `:673`, `:681` лічильник → 17; нове §2.9 за зразком §2.8 `:485-522`; пункт «система» `:~970`), `docs/tasks/platform-roadmap.md` (`:26-45` поточний стан, `:209`, `:647` `[x] Е6б`), `docs/architecture/{storage,data-layer,repository-layout,rendering-and-routing,test-contours}.md` (jsonb-референс логотипа, Е6б-14; модуль `site`; `rendering-and-routing.md:69` — `defineConfig` без `siteUrl`/SEO, Е6б-11; `test-contours.md` — непокриті dev/preview, Е6б-23), `CHANGELOG.md`

**Interfaces:**
- 🔴 Крок ОСТАННІЙ у прогоні: він відновлює стан SQL-ом у `finally`, а SQL оминає кеш процесу (Е6б-9). Наступний прогін піднімає новий `server.mjs` (`live-smoke.mjs:82`), тож застарілого кешу не побачить. Крок після цього в тому ж процесі побачив би старий профіль до 5 хв.
- Знімок ДО кроку (SQL): `value` рядків `store_profile` і `stock_management`, активна тема.
- 🔴 Кеш ПРОГРІТО перед кожною мутацією: покупець відкриває головну й фіксує старе значення (`page.title()`, `window.__SIMPLYCMS_ACTIVE_THEME__`). Лише тоді «новий запит бачить нове» доводить скидання кешу, а не холодний або протухлий кеш (аудит major 9).

- [ ] **Step 1: Крок `live:smoke`** — власник у браузері:
  1. «Налаштування»: змінює назву на «Е6б Крамниця», телефон, завантажує логотип (`PNG` з `avatar.mjs`), додає соцмережу `telegram` → зберігає. Покупець робить НОВИЙ запит головної: `page.title()` містить «Е6б Крамниця»; `<img alt="Е6б Крамниця">` у шапці; телефон у футері; `script[type="application/ld+json"]` головної має `sameAs` з url telegram. Запит `/cart` → `title` = «<назва кошика з i18n> — Е6б Крамниця».
  2. Заміна логотипа другим файлом → SQL: рівно один рядок `media` з `entity_type='store_logo'`, і це новий референс (Review Focus 2).
  3. Вимикає «списувати залишок» → покупець оформлює замовлення (хелпер воронки з `admin-orders-buyer.mjs`) → SQL: кількість товару незмінна. Вмикає назад.
  4. «Теми»: активує `solarstore` → новий запит вітрини: `page.evaluate(() => window.__SIMPLYCMS_ACTIVE_THEME__)` = `'solarstore'` (`storefront-routes/active-theme.ts:10`). Повертає `default` → `'default'`. Налаштування теми в живому кроці не перевіряються: жодна тема демо не має `settings` (`themes/default/index.ts`, solarstore). Їх покривають тести Task 3 і Task 7.
  5. «Плагіни»: вимикає `faq` → SQL `is_active = false`; вмикає назад.
  6. `finally`: відновити знімок SQL-ом і видалити SQL-ом рядки `media` з `entity_type='store_logo'`, створені кроком. Файли в `MEDIA_ROOT` стенда лишаються (сирота без рядка; sweep — К4), у звіт.
  Run: `pnpm live:smoke` → 0 FAIL; вивід цілком — у «Факти виконання».
- [ ] **Step 2: Негативний контроль** — тимчасово прибрати `storeProfileCache.invalidate()` з `saveStoreProfile` → підпункт 1 червоніє: кеш прогріто, тож вітрина віддає стару назву. Вивід у звіт; відкотити.
- [ ] **Step 3: Регрес** — пари «підпис | результат» рядків попередніх кроків ідентичні прогону Е6а (`diff` порожній, крім нових рядків і перейменованих рядків CSRF, Е6б-18).
- [ ] **Step 4: Доки** за Files; лічильник легасі — 17.
- [ ] **Step 5: Повний ланцюг** (Global Constraints) → PASS; вивід у звіт; коміт — `docs(k3-e6b): живий прогін системи, карта стану, changelog`.

## DoD етапу Е6б

1. `pnpm live:smoke` зелений з кроком «система»; негативний контроль Task 8 червоний.
2. Повний ланцюг гейтів зелений; `pnpm lint` = 0 errors / ≤ 8 warnings.
3. `useSupabaseClient` у `src/admin/**` — 17 файлів; «системи» серед них немає; `tests/i18n-coverage/pending.ts` без `routes/storefront`.
4. Review Focus 1–5 закриті тестами, названими в задачах.
5. Літерала назви магазину в ядрі, host-і й темах немає; `seo` у `defineConfig` немає; `plugin_events` і `plugins.migrations_applied` у схемі немає.
6. Фінальне рев'ю гілки архітектором; коміти без трейлерів (`git log --format=%B main..HEAD | grep -ciE "co-authored|generated with"` = 0).

## Точка передачі

Після Е6б — хвилі Е6 за доменами: знижки з категоріями покупців → покупці й `Dashboard` → контент. Листи треку «Готовність пілоту» читатимуть той самий `loadStoreProfile` із `simplycms/site`.
