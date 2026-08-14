# Механізм плагінів SimplyCMS

> Фактичний стан після Фази 3 (2026-08-14). Вимоги — спека платформи
> [`2026-07-30-platform-architecture-design.md`](../superpowers/specs/2026-07-30-platform-architecture-design.md)
> §7–§9, §12; рішення імплементації —
> [план Фази 3](../superpowers/plans/2026-08-14-phase3-plugin-sdk.md) (Р0–Р11).
> Команди CLI — [`cli.md`](cli.md) §3.2, §3.4–3.5; межі тестування —
> [`test-contours.md`](test-contours.md).

## 1. Роль і межі

Плагін — встановлювана одиниця розширення магазину: компоненти в слотах
сторінок, власні таблиці БД (`plg_*`), сторінки адмінки, налаштування,
власний каталог перекладів. Живе або **локально** в теці `plugins/` магазину
(аліас `@plugins/*`, без build-кроку), або **npm-пакетом** (конвенції імен:
unscoped `simplycms-plugin-<name>`, scoped `@simplycms/plugin-<name>`).

Два референс-плагіни задають зразок:

| | Де | Що демонструє |
|---|---|---|
| `hello-world` | `plugins/hello-world` (їде в шаблон магазину) | мінімум: один слот + каталог i18n |
| `@simplycms/plugin-faq` | `packages/simplycms-plugin-faq` (npm) | повний контур: таблиця `plg_faq_items`, `/admin/faq`, слот, Zod-settings, i18n, міграція в пакеті |

🔴 **Межі v1 — знати, перш ніж обіцяти можливості:**

- Ядро **не емить бізнес-подій**. `hookRegistry.execute` викликається рівно з
  одного місця — `PluginSlot`. Хук `order.created` можна задекларувати, але
  його ніхто не покличе; робочі точки розширення сьогодні — слоти.
- **Bootstrap — client-only** (`useEffect` у `__root`): хуки/слоти не
  виконуються на SSR. Для сторінок адмінки це невідчутно (`/admin` —
  `ssr:false`), для слотів вітрини означає «підвантажиться після гідрації».
- `events`/`storage`-порти SDK, `plugin:dev`, `plugin:purge`, автоматичний
  монтаж adminRoutes через `add`, облік `plugins.migrations_applied` —
  відкладені борги (роадмап, розділ «Борги Фази 3»).

## 2. Контракт: `definePlugin` (@simplycms/plugin-sdk)

```ts
import { definePlugin } from '@simplycms/plugin-sdk';
import { z } from 'zod';

export default definePlugin({
  name: 'faq',                      // [a-z][a-z0-9-]*; ключ ВСЬОГО (див. §9)
  displayName: 'FAQ',
  version: '0.3.0',                 // для npm-пакета = version пакета (тест парності)
  engines: { simplycms: '>=0.3.0' },// діапазон сумісності; `>=`, НЕ `^` (0.x!)
  description: '…англійською…',     // метадані реєстру: показуються з БД-рядка
  settings: z.object({ maxVisible: z.number().int().default(5).describe('…') }),
  slots: { 'product.detail.after': FaqSlot },   // компонент ← props.context
  hooks: { /* обробники; v1 — див. межі вище */ },
  messages: { uk: {...}, en: {...} },           // ключі plugin.<name>.*
  adminRoutes: './routes',          // декларація для людини/CLI, не рантайм
  migrations: ['20260814120000_plg_faq_items.sql'],
  edgeFunctions: [], buckets: [],   // декларації без автоматизації (§9 v1)
});
```

- Результат **структурно задовольняє** старий `PluginModule`
  (`register`/`unregister` згенеровані з декларацій) — тому
  `bootstrapPlugins`/`PluginLoader` не знають про SDK.
- Помилки контракту `definePlugin` кидає при імпорті модуля — автор бачить їх
  першим рендером, а магазин не падає (catch у bootstrap).
- `validatePluginModule` (живе в `@simplycms/plugins`, SDK реекспортує; ідіом
  `validateThemeModule`): порушення структури — throw → bootstrap логує і
  **пропускає модуль**; підозри (немає `engines`, несумісний діапазон, ключ
  без префікса) — `console.warn`, реєстрація триває. Несумісний
  `engines.simplycms` на 0.x — навмисно warn, не фейл: строгість — рішення
  реліз-потяга v1.0 (`satisfies`/`CORE_VERSION` — `@simplycms/objects/semver`).

## 3. Рантайм-контур

```
simplycms.config.ts (plugins: [{ name, module: () => import(…) }])
  └─ __root → <PluginBootstrap> (клієнтський useEffect)
       └─ bootstrapPlugins: import → validate → registerPluginModule
            → syncPluginRows (INSERT відсутніх рядків у `plugins`,
              ЛИШЕ під сесією — RLS пише тільки адмін)
            → loadPlugins (активні в БД → module.register(hookRegistry))
```

- Конфіг — **build-time** джерело «що встановлено»; БД (`plugins.is_active`,
  `plugins.config`) — **runtime**-стан. Розсинхрон (активний у БД, модуля
  немає в білді) — error-лог + пропуск, без падінь (спека §8).
- `PluginSlot` реактивний (`useSyncExternalStore` по версії реєстру):
  вмикання/вимикання плагіна з адмінки міняє сторінку **без reload**.
  Активація атомарна: спершу БД, потім реєстр (`PluginLoader`).
- Єдиний шлях мутації стану — lifecycle-функції (`activatePlugin`/
  `deactivatePlugin`/`uninstallPlugin`); адмінка ними й користується
  (runtime-встановлення руками знято у Фазі 3 — lifecycle build-time, §7).

## 4. Межа довіри (спека §7)

Плагін **не отримує `SupabaseClient`** — лише порти SDK. Примус двошаровий:

1. **dependency-lint** (eslint-зона `plugins/**` +
   `packages/simplycms-plugin-*/**`): заборонені `@simplycms/supabase(/**)`,
   `@simplycms/data-supabase(/**)`, `@supabase/*` — і статичний import, і
   `export … from`, і динамічний `import()` (окремий селектор). 🔴 Глоб
   навмисно `simplycms-plugin-*`: `plugin-system`/`plugin-sdk` — ядро, зона
   їх не покриває. Доводить не зелений лінт, а негативний контроль
   `tests/plugin-trust-boundary.test.ts` (синтетичне порушення в зоні й поза
   нею) — урок env-контракту: правило, що мовчки відвалилось, теж дає
   зелений лінт.
2. **Рантайм-гарди портів**: `usePluginTable` приймає лише таблиці з
   префіксом `plg_`; SQL-лінт `db:diff` (див. §5) не пускає чужі таблиці в
   міграції.

Порти v1 (усі — з `@simplycms/plugin-sdk`, клієнтські):

| Порт | Що дає |
|---|---|
| `usePluginTable<Row>('plg_…')` | CRUD по ВЛАСНІЙ таблиці: `list({eq, orderBy})` / `insert` / `update` / `remove`; типи рядків — generic автора (плагінні таблиці свідомо поза core-baseline типів БД) |
| `usePluginConfig(name, schema)` | читання `plugins.config` + `safeParse` зі схемою → **дефолти завжди матеріалізовані**; битий config → дефолти + warn |
| `usePluginT(messages)` | транслятор каталогу плагіна (див. §7) |

Дозволена поверхня імпортів плагіна: `@simplycms/plugin-sdk`,
`@simplycms/ui`, `react`, `zod`, `@tanstack/react-router`/`react-query`
(для adminRoutes-сторінок), `@simplycms/plugins/PluginSlot`-типи.

## 5. Дані: таблиці `plg_*` і конвеєр міграцій

- Таблиці плагіна — `plg_<name>_*` (дефіси імені → підкреслення:
  `hello-world` → `plg_hello_world_*`). Звʼязки з ядром — link-поля
  **без FK у чужі таблиці** (модель Medusa Module Links: `product_id uuid`
  без `references`). RLS-політики — лише на власні таблиці; `is_admin()` і
  `update_updated_at_column()` — публічні хелпери ядра, дозволені до виклику.
- Плагін везе **готові рецензовані `*.sql`** у теці `migrations/` пакета
  (поле `files`); drizzle-композиції немає свідомо (Р4). Конвенція імені —
  `<YYYYMMDDHHmmss>_plg_<name>_<slug>.sql` (виключає колізії між канонами).
- Доставка в магазин — `simplycms db:diff [--write]`: N канонів (ядро +
  кожен плагін конфігу з migrations/), `own` рахується по **обʼєднанню**
  канонів, спільне імʼя з різним вмістом — error без запису (immutable).
- 🔴 **SQL-лінт межі** перед копіюванням: `CREATE/ALTER/DROP TABLE`,
  `CREATE/DROP POLICY`, `CREATE INDEX`, `REFERENCES`, `CREATE TRIGGER … ON`,
  `CREATE/DROP FUNCTION` — усе лише на `plg_<name>_*`; лапки й
  schema-кваліфікація (`"public"."plg_x"`) розуміються, коментарі
  вирізаються до скану. Це regexp-гард від помилки автора, не парсер SQL —
  останнє слово за людським ревʼю скопійованої міграції.
- Імʼя для лінта — **канонічне зі специфікатора пакета** (`stripPrefixes`),
  а не конфіг-ключ: `--name`-аліас у конфізі не збиває перевірку.
- Накат: `git diff` (ревʼю) → `supabase db push`; якщо таймстамп плагінної
  міграції старіший за накачені — `push --include-all`. Регенерація
  `supabase/types.ts` підхопить плагінні таблиці штатно.

## 6. Налаштування (Zod-цикл)

Автор декларує `settings: z.object(…)` → адмінка
(`/admin/plugins/$id/settings`) рендерить форму через `z.toJSONSchema` зі
схеми **зареєстрованого модуля** (схема — код, вона несеріалізовна; модуль
викинули з білда → форми немає, «немає налаштувань») → збереження
`safeParse`-ить config (валідація + матеріалізація дефолтів у БД) → плагін
читає `usePluginConfig`. Конвенції мапінгу: `.describe()` → підпис поля,
`z.enum` → select, `.default()` → значення за замовчуванням, `boolean` →
switch, `number/integer` → числовий input. Непредставна для JSON Schema
схема (`z.date`, `.transform`) — warn + порожня форма, не падіння сторінки.

🔴 Схема живе в `definition.settings` модуля і НЕ їде в БД чи manifest-JSON.

## 7. i18n плагіна

Дзеркало механізму тем: плагін несе **власний** каталог
`messages: { uk, en }` (поле `definePlugin`), читає його `usePluginT<K>()`
(fallback `locale → uk → сам ключ`, спільна `interpolate`). Ключі
**зобовʼязані** мати префікс `plugin.<name>.` — неймспейс замість реєстру
виключає колізії з замкненим `MessageKey` ядра і між плагінами. Каталог
передається хуку АРГУМЕНТОМ (статичний імпорт власного `messages.ts`), не
читається з реєстру — реєстр наповнюється клієнтським ефектом, і читання з
нього на SSR дало б гідраційний мисматч (граблі, задокументовані в
`useThemeT`). Typo-safety — локальний union:
`export type FaqKey = keyof typeof messages.uk`.

Метадані реєстру (`description`, `displayName` як бренд) — **англійською**:
показуються з БД-рядка, не з каталогу; кирилиця в них валила б AST-скан.

Гарди: тека `plugins/` і пакети `simplycms-plugin-*` — у `SCANNED_ROOTS`
AST-скану (`tests/i18n-coverage`); парність uk↔en, префікси й плейсхолдери —
`tests/plugin-messages-parity.test.ts` (плагіни дискавляться з диска).

## 8. Сторінки адмінки (adminRoutes)

Тека роутів плагіна зветься **`routes/`** (🔴 не `admin-routes/`:
tailwind-глоб магазину сканує `node_modules/@simplycms/*/routes/**`) і несе
файли з запеченими id `/admin/<slug>/…` — вони стають дітьми layout
`/admin` за префіксом id, успадковуючи guard і `AdminLayout` автоматично.
Гард здатності — кейс «два physical() під спільним layout» у
`tests/virtual-routes-escape.test.ts`.

Монтаж — рядок `physical()` у store-owned `routes.ts` за якір-коментарем
(`plugin admin routes`); автоматичну вставку через `add` відкладено. 🔴 У
магазині — **завжди через `coreRoutes()`-хелпер із `realpathSync`**: без
розгортання pnpm-симлінка code-splitter TSR мовчки не сплітить роути
плагіна (збірка зелена, вся адмінка в initial-чанку — зафіксований дефект
пілота pnpm-міграції).

npm-пакет плагіна зі сторінками: exports `./pages/*` → `src/pages/*.tsx`
(+дзеркало на dist у `publishConfig`), `./routes/*` — сирцями (прецедент
route-пакетів ядра); route-файл імпортує сторінку через
`@simplycms/plugin-faq/pages/FaqAdmin`.

## 9. Встановлення і авторський цикл

**Локальний плагін (dev-loop):** `pnpm simplycms create plugin <name>` —
скаффолд у `plugins/<name>` магазину (шаблон — `template-plugin/` у tarball
CLI: definePlugin + messages + README з конвенціями) + якірний запис у
конфіг. Аліас `@plugins/*` уже налаштований — правки видно після рестарту
`pnpm dev`, без build-кроку й workspace-лінків (тому `plugin:dev` і не
знадобився у v1).

**npm-плагін:** `pnpm simplycms add <pkg> --plugin` (pnpm add + запис у
конфіг + підказка `db:diff --write`, якщо пакет привіз міграції) → рядок
`physical()` у `routes.ts`, якщо є adminRoutes → `pnpm build`.

🔴 **Інваріант імені.** `name` у `definePlugin` = ключ конфігу = імʼя рядка в
таблиці `plugins` = аргумент `usePluginConfig` = основа префікса `plg_*`.
`deriveKey` CLI знімає scope і префікси `simplycms-plugin-`/`plugin-`
(`@simplycms/plugin-faq` → `faq`), тож дефолтний `add` дає збіг; розбіжність
(через `--name`) не валить нічого, але bootstrap попереджає, а
`usePluginConfig` віддасть дефолти з warn — налаштування читатимуться «не з
того» рядка. Тест парності `tests/plugin-manifest-parity.test.ts` стереже
`manifest.name` ↔ тека ↔ імʼя пакета ↔ version для референс-пакетів.

## 10. Як це верифікується

| Що | Чим |
|---|---|
| Контракт SDK (definePlugin/validate/порти) | юніти `packages/plugin-sdk`, `packages/plugin-system` |
| Межа довіри | `tests/plugin-trust-boundary.test.ts` (негативний контроль зони) |
| i18n каталоги | `tests/plugin-messages-parity.test.ts` + AST-скан `SCANNED_ROOTS` |
| Манифест ↔ пакет | `tests/plugin-manifest-parity.test.ts` |
| Мульти-канони/SQL-лінт db:diff | `tests/cli-db-diff.test.ts` |
| Скаффолд create plugin | `tests/cli-create.test.ts` (+ реальні діагностики `transpileModule`) |
| Два physical() під /admin | `tests/virtual-routes-escape.test.ts` |
| Пакування (route-id, бандл, tarball, CLI) | `pnpm pilot:pack` — Gates A/C/D/CLI/TOOL |
| Поведінка наживо (toggle, віджет) | `pnpm test:e2e` (Docker; спека `plugin.e2e.ts` адресує картку за назвою) |

🔴 Зелений `pnpm test` пакування плагіна **не доводить** — це загальний
закон репо (`test-contours.md`): після змін exports/routes/міграцій пакета
плагіна ганяти пілот.
