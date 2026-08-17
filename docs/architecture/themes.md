# Механізм тем SimplyCMS

> Фактичний стан після Фази 4 (2026-08-14). Вимоги — спека платформи
> [`2026-07-30-platform-architecture-design.md`](../superpowers/specs/2026-07-30-platform-architecture-design.md)
> §6 (контракт теми), §13 (маркетплейс), §17 сценарій 4; рішення імплементації —
> [план Фази 4](../superpowers/plans/2026-08-14-phase4-themes-as-packages.md)
> (Р0–Р14). Команди CLI — [`cli.md`](cli.md) §3.2, §3.5; межі тестування —
> [`test-contours.md`](test-contours.md). Практичний посібник (how-to для
> розробника магазину й автора теми) — [`../guides/themes.md`](../guides/themes.md).

## 1. Роль і межі

Тема — встановлювана одиниця **оформлення** магазину: design-токени,
брендові компоненти (Header/Footer обовʼязкові, HeroBanner/HomeSections —
опційні), власний каталог перекладів. Сторінок і лейаутів тема не несе —
канонічні сторінки живуть у `@simplycms/storefront-routes/src/pages/`
(рішення D3/D4 спеки, свідомо поза скоупом Фази 4 — Р0).

Тема живе або **локально** в теці `themes/` магазину (аліас `@themes/*`, без
build-кроку), або **npm-пакетом** (конвенції імен: unscoped
`simplycms-theme-<name>`, scoped `@vendor/simplycms-theme-<name>`; Р1).

> 🔴 **Затверджений напрям — контракт v3 «theme views» (2026-08-17, у коді ще
> НЕМАЄ).** Ревізія D3′/D4′: дані/роути/SEO лишаються ядром назавжди, але
> тема зможе перевизначати view-шар пʼяти сторінок вітрини (Home, Catalog,
> CatalogSection, ProductDetail, Cart) через типізовані view-model-и зі
> slot-компонентами реквізитів і жорсткий conformance-гейт. Спека —
> [`2026-08-17-theme-contract-v3-views-design.md`](../superpowers/specs/2026-08-17-theme-contract-v3-views-design.md);
> порядок виконання — роадмап (трек A). Цей документ описує чинний контракт
> v2.2 і буде оновлений разом з імплементацією.

Два зразки задають межі форми:

| | Де | Що демонструє |
|---|---|---|
| `themes/default` | `themes/default` (їде в шаблон магазину) | еталон fallback-токенів (спека §6) і живий зразок copy-in-форми; **private**, поза реліз-потягом ядра, поза `theme-manifest-parity` |
| `@simplycms/theme-solarstore` | `packages/simplycms-theme-solarstore` (npm) | повний контур пакетного постачання: manifest+tokens+components+messages, tsup-збірка, публікація в реліз-потязі ядра |

🔴 **Межі v1 — знати, перш ніж обіцяти можливості:**

- `bootstrapThemes` — **insert-only**: рядок теми, доданий раніше (наприклад
  сід-міграцією), метадані НЕ оновлює. Деталі — §5.
- Registry-awareness адмінки (§5) — читає лише `ThemeRegistry.has(name)`;
  uninstall-рядка з адмінки немає (деактивація достатня для v1, Р0).
- Межі довіри на теми **немає свідомо** (Р10, §7): тема, на відміну від
  плагіна, законно імпортує `@simplycms/supabase`/`@simplycms/core` — це
  контракт v2, а не діра.
- Шрифти теми (`fonts`, контракт v2.2) — **лише зовнішні `https:`-stylesheet**;
  `@font-face`-обʼєктів і роздачі файлів шрифтів темою немає свідомо
  (npm-тема не має каналу статики) — §2, §8.
- `simplycms create theme` дає лише локальний dev-loop; `theme:check` як
  окрема CLI-команда не вводиться — глибока перевірка модуля лишається за
  `validateThemeModule` на build/рантаймі (CLI — чистий ESM без TS-лоадера,
  імпортувати `index.ts` теми він не може).

## 2. Контракт: `ThemeModule`

```ts
ThemeModule = {
  manifest: ThemeManifest;     // { name, displayName, version, engines: { simplycms } }
  tokens: DesignTokens;        // значення НАЯВНИХ semantic-змінних shadcn
  components: ThemeComponents; // Header, Footer (обовʼязкові) + HeroBanner?, HomeSections?
  settings?: Record<string, ThemeSettingDefinition>;
  messages?: { uk: {...}, en: {...} };   // опційний каталог, контракт v2.1
  fonts?: ReadonlyArray<{ stylesheet: string }>;  // https:-URL, контракт v2.2
}
```

- **Типографіка (v2.2)** — два не-кольорові токени в `tokens`: `'font-sans'`
  і `'font-heading'`. Значення — повний CSS `font-family` stack рядком
  (`"'Manrope', system-ui, sans-serif"`), не назва шрифту; `font-heading`
  застосовується до `h1..h6` через `@layer base` магазину. `font-mono`
  свідомо не вводиться (YAGNI). Fallback-значення обох змінних живуть у
  `src/styles/globals.css`: невизначена `var()` робить УСЮ декларацію
  `font-family` invalid-at-computed-value-time, тож чистий магазин без теми
  лишається на Inter саме завдяки їм.
- **`fonts` (v2.2)** — опційний масив зовнішніх stylesheet-ів теми (Google
  Fonts і аналоги). Фільтр — `safeFontStylesheets` (субшлях-експорт
  `@simplycms/themes/safeFontStylesheets`, НЕ barrel: barrel тягне
  `getActiveThemeSSR` → `@simplycms/supabase/anon-client`, і з клієнтського
  компонента це затягнуло б серверний код у бандл): приймаються лише
  абсолютні `https:`-URL без лапок/кутових дужок/пробілів, невалідний запис
  пропускається з `console.warn`. Рендер — `ThemeFonts` у ОБОХ каркасах
  (`StorefrontShell`, `ProtectedShell`) поруч із `ThemeTokens`; `<link
  rel="stylesheet">` у body валідний за HTML-спекою і працює в SSR-стрімі.
  Базовий Inter-`<link>` у `__root.tsx` лишається — адмінка і fallback
  вітрини. Зразок — `@simplycms/theme-solarstore` (декларує `fonts`);
  `themes/default` `fonts` не має — опційність поля жива, не декларативна.
- `manifest.displayName` — те, що бачить адмін у списку тем; поле фактично
  існує в контракті (`packages/theme-system/src/types.ts`), хоча спека §6
  його не називала — амендмент §6 (Р14, див. спеку).
- `validateThemeModule` (`@simplycms/themes`) — публічний контракт для
  авторів: порушення структури кидає, `ThemeRegistry.load` падає на тему
  `default`, якщо запитаної немає.
- `name` у manifest — метаданий опис; **ідентичність** теми для БД і
  резолву — ключ реєстрації в `simplycms.config.ts` (§5).

## 3. Пакування: npm vs copy-in

Обидва шляхи зі спеки §17.4 підтримуються (Р0):

### 3.1 npm-пакет

`pnpm simplycms add <pkg> --theme [--name <key>]` → `pnpm add <pkg>` →
якірний запис `'<key>': () => import('<pkg>')` у `simplycms.config.ts` →
`pnpm build`. Semver-фікси йдуть апстрімом; магазин лишається на голій
залежності.

**Форма пакета** (Р3, зразок — `@simplycms/plugin-faq`): tsup,
`format: esm`, `splitting: false` (тема — пасивний модуль без спільного
singleton-стану між entry), `external: [/^@simplycms\//]`,
`sideEffects: false`. Єдиний entry `src/index.ts` (default-export
`ThemeModule`), `exports` лише `"."` (dev → `src/index.ts`, `publishConfig`
→ `dist/index.js`). `files: ["dist", "src", "!src/**/__tests__/**"]` —
**`src` обовʼязково в tarball-і**: без нього copy-in-варіант (§3.2) не має
що копіювати.

**Конвенція залежностей — РІЗНА для референс-тем ядра і сторонніх:**

| | Референс-тема ядра | Стороння тема |
|---|---|---|
| `@simplycms/*` | `dependencies` (один реліз-потяг, одна версія) | `peerDependencies` (тема не в реліз-потязі ядра; `dependencies` дублювали б React-контексти на кшталт `SupabaseProvider` — vite-dedupe шаблону покриває лише `react`/`react-dom`/`react-query`) |
| Сумісність з ядром | версія пакета = `manifest.version` | `engines.simplycms` (semver-range) |
| React/router/query | `peerDependencies` (`audit-deps/classify.mjs`) | `peerDependencies` |

Референс-теми ядра (`@simplycms/theme-<name>`) — той самий виняток природи,
що `@simplycms/plugin-faq`: тека `packages/simplycms-theme-<name>`, npm-імʼя
під scope `@simplycms/`. Причина: реліз/аудит-механіка (`pack-inspect.mjs`
`CORE_SCOPE`, `release/bump.mjs`, audit-deps/audit-exports,
`published-exports-parity`) авто-підхоплює лише `packages/*` під scope
`@simplycms/` — інший неймінг лишив би референс-тему поза всіма гейтами.

### 3.2 Copy-in (`--copy`)

`pnpm simplycms add <pkg> --theme --copy [--name <key>]` — shadcn-модель:
повне володіння кодом, без апстрім-фіксів. Лише для `--theme` (з `--plugin`
або `--no-install` — гучна помилка: copy без install неможливий за
природою). Порядок (Р5; незворотні дії лише після усіх можливих валідацій):

1. `deriveKey` — ключ із `--name` або похідний від імені пакета.
2. **Колізія КЛЮЧА конфігу**: запис із тим самим ключем, але ІНШИМ
   специфікатором (наприклад, та сама тема вже стоїть npm-пакетом) →
   помилка ДО будь-яких дій з підказкою `--name <key>` — другий запис із
   тим самим ключем зробив би конфіг битим (`assertThemeKeyFree`,
   `packages/cli/src/config-edit.mjs`; той самий гард стоїть і в npm-гілці
   `add --theme`).
3. **Ідемпотентність**: тека `themes/<key>` існує І конфіг уже має
   `import('@themes/<key>/index')` → успіх-нічого-робити.
4. **Колізія теки**: тека існує, а конфіг на неї не вказує → помилка ДО
   будь-яких дій (підмінити чужу теку мовчки не можна).
5. `pnpm add <pkg>` — пакет ставиться ТИМЧАСОВО.
6. Валідація `node_modules/<pkg>/src/index.ts` (конвенція форми §3.1) —
   провал → rollback `pnpm remove <pkg>` + помилка.
7. **Злиття залежностей**: `dependencies` пакета теми, яких немає в
   манифесті магазину, дописуються в `dependencies` магазину — інакше
   наступний `pnpm remove` забере замикання залежностей, і стороння тема з
   власною бібліотекою просто не збереться (на solarstore це невидимо: усі
   її імпорти випадково покриті шаблоном).
8. Копія `src/*` → `themes/<key>/` (+ README.md/LICENSE з кореня пакета,
   якщо є).
9. Запис у конфіг `'<key>': () => import('@themes/<key>/index')`.
10. `pnpm remove <pkg>` — пакет знімається, тема лишається локальною текою.

`--dry-run` підтримується (показує майбутню зміну без запису). Скопійована
тема підпадає під наявні глоби (`./themes/**/*.{ts,tsx}`) і аліас
`@themes/*` — жодних змін резолву не потрібно.

### 3.3 Tailwind: класи сторонніх тем

Шаблон (`packages/create-simplycms-store/template/tailwind.config.ts`)
доповнено глобами для npm-тем поза `@simplycms/` (Р7):

```
./node_modules/simplycms-theme-*/dist/**/*.js
./node_modules/@*/simplycms-theme-*/dist/**/*.js
```

Референс-теми ядра (`@simplycms/theme-*`) уже покриті чинним
`./node_modules/@simplycms/*/dist/**/*.js`. **Вимога «класи мають бути в
зібраному dist-JS» — частина конвенції форми пакета** (tsup лишає
className-літерали в JS; перевірено на dist `plugin-faq`). Copy-in-теми
(§3.2) під ці глоби НЕ потрапляють — вони йдуть під `./themes/**/*.{ts,tsx}`
(сирці, вже покрито). Доведено `tests/theme-tailwind-globs.test.ts`:
синтезує в temp-dir node_modules-фікстури під усі три конвенції неймінгу
(плюс негативний кейс — src-only пакет без dist НЕ матчиться) і проганяє
патерни через `fs.globSync` (Node 22) — наближення сканера Tailwind v4
стандартною glob-семантикою.

## 4. Встановлення і авторський цикл

**Локальний dev-loop:** `pnpm simplycms create theme <name>` — скаффолд у
`themes/<name>/` магазину (шаблон — `template-theme/` у tarball CLI:
`manifest.ts`/`tokens.ts`/`messages.ts`/`index.ts`/`components/Header.tsx`/
`components/Footer.tsx`/README, плейсхолдери `__THEME_NAME__`/
`__THEME_DISPLAY_NAME__`/`__CORE_RANGE__`) + якірний запис у конфіг. Аліас
`@themes/*` уже налаштований — правки видно після рестарту `pnpm dev`, без
build-кроку й workspace-лінків.

**npm-тема:** `pnpm simplycms add <pkg> --theme` (§3.1) або `--copy` (§3.2).
Після установки — `pnpm build`, активація й налаштування — з адмінки
(`/admin/themes`), без перезбірки.

## 5. `bootstrapThemes` і БД

Адмінка (`Themes.tsx`) читає **лише БД** (таблиця `themes`) — записаний у
`simplycms.config.ts` модуль без рядка в БД просто не зʼявиться у списку.
`bootstrapThemes` (`@simplycms/themes`, дзеркало `syncPluginRows` плагінів)
синхронізує зареєстровані теми в таблицю при завантаженні застосунку —
клієнтський `useEffect` поруч із `PluginBootstrap` у `__root.tsx` (три
синхронні копії: host, `packages/cli/host/`, template — `pnpm template:sync`).

Порядок кроків мінімізує ціну типового випадку («усі теми вже в БД» → рівно
один SELECT):

1. `SELECT name FROM themes` (публічна RLS) → `missing` = зареєстровані в
   реєстрі, відсутні в БД; порожньо → вихід до будь-якої іншої роботи.
2. Session-гард: писати може лише адмін (політика `Admins can manage
   themes`), тож без сесії `ThemeRegistry.load` навіть не викликається.
3. `ThemeRegistry.load(name)` лише для `missing` — чанки тем тягнуться тільки
   у рідкісному вікні «тема додана, адмін ще не заходив».
4. Один batch `INSERT` (завжди `is_active: false` — інваріант частково
   унікального індексу `themes_active_idx` не порушується).

`name` рядка = ключ реєстрації (ключ конфігу), а не `manifest.name` — саме
за ключем резолвить `getActiveThemeSSR`; розбіжність — `console.warn`
(дзеркало плагінного bootstrap), реєстрація не блокується.

### 🔴 Межі v1 (не баг)

1. **Чесна межа довіри-в-БД** (симетрична плагінному `syncPluginRows`):
   залогінений НЕ-адмін у вікні «є `missing`» пройде session-гард, потягне
   чанки і отримає RLS-відмову `INSERT` → `console.error` у консолі
   браузера. Приймається свідомо — той самий компроміс, що в плагінів.
2. **Insert-only: версія рядка НЕ оновлюється.** Сід-міграція
   (`…20260215122821_theme_system_refactor.sql`) вставляє рядок
   `solarstore` з `version '1.0.0'`, тоді як пакет тепер `0.3.0` —
   `bootstrapThemes` бачить рядок як «вже є» і не чіпає його метадані. Та
   сама межа, що `plugins.migrations_applied` у Фазі 3 — UPDATE
   існуючих рядків відкладено. Історію міграцій свідомо не переписуємо: шар
   «що зареєстровано в БД» незалежний від способу доставки коду.
3. **Свіжий магазин має «осиротілий» рядок `solarstore`.** Шаблон
   скаффолдера накатує ту саму сід-міграцію, але реєструє в
   `simplycms.config.ts` лише `default` (друга тема — рішення користувача,
   Р8). Після `bootstrapThemes` адмінка чесно покаже бейдж «модуль
   відсутній» + disabled «Активувати» для рядка `solarstore` (§6) — замість
   тихої підміни чи падіння. Прибрати рядок у свіжому магазині, де він не
   потрібен:

   ```sql
   DELETE FROM public.themes WHERE name = 'solarstore' AND is_active = false;
   ```

   (гард `is_active = false` — на випадок, якщо адмін встиг активувати
   тему, перш ніж помітив відсутність модуля; активну тему деактивуйте з
   адмінки до видалення рядка).

## 6. Registry-awareness адмінки

`packages/admin/src/pages/Themes.tsx` звіряє кожен рядок БД з
`ThemeRegistry.has(theme.name)` (дзеркало `hasModule` у `Plugins.tsx`):
модуля немає в білді → бейдж «модуль відсутній» (`admin.themes.moduleMissing`)
+ disabled кнопка «Активувати» + пояснювальний текст
(`admin.themes.moduleMissingHint`). SSR на падіння тут не б'ється:
`getActiveThemeSSR` резолвить активну тему ДО `ThemeRegistry.load` і має
трирівневий fallback на `default`, тож вітрина без модуля тихо відрендерить
дефолтну тему, а не впаде. Бейдж і disabled захищають від іншого —
розсинхрону «адмінка показує тему активною, а вітрина тихо показує зовсім
іншу (default)»: без цього гарду адмін бачив би в списку активною тему, якої
насправді на вітрині немає.

Покрито компонентним тестом (Testing Library/jsdom,
`packages/admin/src/__tests__/`): рядок без модуля → бейдж + disabled
activate.

⚠ **Нотатка власнику.** E2e-смок `tests/e2e/admin-smoke/theme.e2e.ts` тисне
ПЕРШУ кнопку «Активувати» в списку. З появою disabled-рядків (тема в БД без
модуля) селектор може почати чіпляти не той рядок — уточнити при живому
прогоні `pnpm test:e2e`/`pnpm pilot:e2e` (роадмап, Борги Фази 4).

## 7. Conformance-kit і чекліст автора теми

Чесний склад, без окремого пакета-валідатора:

1. **`validateThemeModule`** — публічний рантайм-контракт, вже описаний у
   §2; падає при `ThemeRegistry.load`.
2. **Doctor, перевірка №11 (warn-рівень)** — `packages/cli/src/doctor-theme-checks.mjs`,
   реєструється в `runOfflineChecks`. НЕ у fs-checks і НЕ розширенням №9
   (той — error-рівень і лагодиться `update --write`; ця перевірка лагодиться
   руками, бо тека теми може бути свідомо ще не створена, а
   `tailwind.config.ts` узагалі поза каноном `host/`). Що перевіряє:
   - кожен запис `themes`-конфігу резолвиться — тека `themes/<key>/` або
     пакет у `node_modules` (перевірка йде по **специфікатору** `import()`,
     а не по ключу — `configThemeEntries` у `config-edit.mjs`, дзеркало
     `configPluginEntries`; ключ ≠ імʼя пакета через `--name`);
   - warn-підказка додати Tailwind-глоби сторонньої теми (§3.3), якщо пакет
     під конвенцією Р1 встановлено, а глоба в `tailwind.config.ts` немає.
3. **Монорепо-гарди на референс-теми ядра:**
   - `tests/theme-manifest-parity.test.ts` (взірець
     `tests/plugin-manifest-parity.test.ts`) — `manifest.version` = version
     пакета, `manifest.name` = хвіст теки, `displayName` непорожній.
     Дискаверить ЛИШЕ `packages/simplycms-theme-*` — `themes/default` під
     parity НЕ підпадає свідомо (private, власна версія, еталон fallback).
   - `tests/theme-messages-parity.test.ts` — парність каталогів uk/en,
     дискаверить ОБИДВА корені (`themes/<name>/messages.ts` і
     `packages/simplycms-theme-*/src/messages.ts`).
   - `tests/i18n-coverage` `SCANNED_ROOTS` — теми дискаверяться з диска
     (`themes/*` + `packages/simplycms-theme-*`), не статичним списком.
4. **Чекліст автора теми** (публікація як npm-пакет):
   - неймінг за Р1 (§3.1);
   - `license` — валідний непорожній рядок (SPDX);
   - `manifest.engines.simplycms` — semver-range сумісності;
   - `description` у `package.json` — англійською (метадані реєстру
     показуються з БД-рядка, не з каталогу i18n);
   - `@simplycms/*` — `peerDependencies`, не `dependencies` (§3.1);
   - модуль проходить `validateThemeModule` без падіння;
   - `src/` — у `files` tarball-а (потрібно для copy-in, §3.2);
   - `repository` — публічне посилання (аудит перед подачею в індекс).

   Повний контракт подачі в маркетплейс-індекс —
   [`docs/marketplace/README.md`](../marketplace/README.md).

CLI-команда `theme:check` НЕ вводиться (§1): CLI — чистий ESM без TS-лоадера,
глибока перевірка лишається за `validateThemeModule` на build/рантаймі.

## 8. Чого свідомо немає (v1)

- **Межа довіри, як у плагінів (Р10).** Обидві наявні теми легітимно
  імпортують `@simplycms/supabase/SupabaseProvider` і хуки `@simplycms/core`
  — тема, на відміну від плагіна, споживає DI-клієнт напряму за контрактом
  v2 (`HomeSections` сам тягне дані хуками). Плагінна eslint-зона
  (`PLUGIN_TRUST_BOUNDARY_FILES`) на теми не поширюється. Якщо колись
  зʼявиться theme-sdk із портами (аналог `@simplycms/plugin-sdk`) — це
  окрема фаза, не недогляд.
- **`@font-face` / self-hosted шрифти теми та preconnect-оптимізації**
  (контракт v2.2) — тема віддає лише `https:`-URL зовнішніх stylesheet-ів;
  канал статики в npm-теми зʼявиться окремим рішенням, не недоглядом.
- **Видимість fonts-контуру в пілоті.** `pnpm pilot:pack` його НЕ доводить, і
  це властивість гейтів, а не пропуск: Gate D читає лише зібраний
  `dist/client/assets/*.css` і HTML не бачить, а сід активує `default`, яка
  `fonts` не має. DB-free доказ — компонентні тести
  `packages/storefront-routes/src/__tests__/theme-fonts*.test.tsx` (другий —
  на РЕАЛЬНОМУ модулі `@simplycms/theme-solarstore`). Живий SSR-доказ
  (Gate B + `SEED_THEME='solarstore'` + перегенерація сіду + розрізнюваний
  маркер) — борг у роадмапі.
- **Runtime-встановлення тем** — build-time lifecycle (`simplycms add` +
  rebuild), як і плагіни (D1, спека §14).
- **Uninstall-рядка теми з адмінки** — деактивація (`is_active: false`)
  достатня для v1; видалення рядка — SQL руками (§5).
- **Строгий semver `engines.simplycms`** — warn-режим на 0.x; строгість —
  рішення реліз-потяга v1.0 (той самий компроміс, що в плагінів).
- **Позиція щодо ліцензії екосистеми** (спека §13) — рішення власника,
  блокує прийом подач у маркетплейс-індекс (`docs/marketplace/README.md`).
- **Сам репозиторій `simplycms/marketplace` і вітрина** — окремий репо, дія
  власника (спека §4.1), поза скоупом монорепо.

## 9. Як це верифікується

| Що | Чим |
|---|---|
| Контракт `ThemeModule`/`validateThemeModule` | юніти `packages/theme-system` |
| `bootstrapThemes` | `packages/theme-system/src/__tests__/bootstrapThemes.test.ts` (mock supabase: без missing — нуль load/insert/getSession; без сесії — нуль load; missing → insert; помилка однієї теми не валить решту; mismatch імен — warn) |
| Registry-awareness адмінки | компонентний тест `packages/admin/src/__tests__/` (Testing Library/jsdom) |
| Manifest ↔ пакет (референс-теми) | `tests/theme-manifest-parity.test.ts` |
| i18n каталоги тем | `tests/theme-messages-parity.test.ts` + AST-скан `SCANNED_ROOTS` |
| Типографічні токени і фільтр `fonts` (v2.2) | юніти `packages/theme-system/src/__tests__/` (`applyTokens.test.ts`, `safeFontStylesheets.test.ts`, `validateThemeModule.test.ts`) |
| Рендер `<link>`-ів шрифтів теми (v2.2) | `packages/storefront-routes/src/__tests__/theme-fonts.test.tsx` + `theme-fonts-solarstore.test.tsx` (реальний модуль теми) |
| `create theme` скаффолд | `tests/cli-create-theme.test.ts` (методика `cli-create.test.ts`: temp-dir, плейсхолдери, `transpileModule`) |
| `add --theme --copy` | `tests/cli-add-copy.test.ts` (чиста функція `runThemeCopy`/`mergeDependencies`/`copyPreflight` над фікстурним node_modules у temp-store: валідації, злиття deps, ідемпотентність, колізія, dry-run) |
| Doctor: записи конфігу + Tailwind-підказка | `tests/cli-doctor.test.ts` |
| Tailwind-глоби сторонніх тем | `tests/theme-tailwind-globs.test.ts` (fs.globSync-фікстури, три конвенції + негативний src-only кейс) |
| `bump.mjs`: version-літерал `manifest.ts` | `tests/release-bump-coverage.test.ts` (Р13) |
| Маркетплейс-індекс (формат запису) | `tests/marketplace-index.test.ts` (Zod-схема, `docs/marketplace/index.sample.json`) |
| Пакування (обидві гілки §17.4, provenance, Gate D-маркер) | `pnpm pilot:pack` — Gate THEME-контур: `scripts/pilot-pack/install-themes.mjs` (copy-in + npm тим самим `pnpm exec simplycms`, що й користувач), `gate-d.mjs` (маркер `@simplycms/theme-solarstore · HeroBanner`) |
| Поведінка наживо (перемикання теми, RLS bootstrap) | `pnpm test:e2e` (Docker; `theme.e2e.ts` — див. нотатку §6) |

🔴 Зелений `pnpm test` пакування теми **не доводить** — загальний закон репо
(`test-contours.md`): після змін exports/manifest/tailwind-глобів пакета теми
ганяти `pnpm pilot:pack`.
