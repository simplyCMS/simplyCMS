# План Фази 4 — Теми як пакети + маркетплейс-індекс (v1)

> Створено 2026-08-14. Джерело правди вимог —
> [`../specs/2026-07-30-platform-architecture-design.md`](../specs/2026-07-30-platform-architecture-design.md)
> §6 (контракт теми), §13 (неймінг/вимоги індексу — там лише НАГАДУВАННЯ їх
> зафіксувати, тому фіксує їх цей план), §17 сценарій 4 (наскрізний флоу
> `simplycms add … --theme` npm/copy-in → rebuild → перемикання в адмінці).
> Трекінг — [`../../tasks/platform-roadmap.md`](../../tasks/platform-roadmap.md), Фаза 4.
> Окремої спеки Фази 4 немає — рішення Р0–Р12 нижче виконують її роль.
>
> **Середовище виконання:** без Docker-демона і живої БД (образи Supabase не
> тягнуться через проксі). Доказовість — детерміністичні гейти
> (`install --frozen-lockfile → format:check → lint → build → typecheck →
> test → build:packages → test:packaging`) + `pnpm pilot:pack`
> (Gates A/C/D/CLI/TOOL, прожито зеленим у цій сесії до старту). Живе
> перемикання теми в адмінці (Gate B/E, `pnpm test:e2e`) — дія власника,
> той самий режим, що борг №10 роадмапу.

---

## 0. Рішення (зафіксовані ДО коду)

Розвідка (9 звітів, сесія 2026-08-14) виявила розриви, які план розвʼязує явно.

- **Р0 — скоуп фази.** У фазі: (1) референс-тема як публікований npm-пакет;
  (2) обидва шляхи установки зі спеки §17.4 — npm (`simplycms add … --theme`,
  вже працює) і copy-in (`--copy`, робота з нуля); (3) `bootstrapThemes` —
  синхронізація зареєстрованих тем у таблицю `themes` (без цього DoD
  недосяжний: адмінка бачить ЛИШЕ БД — `packages/admin/src/pages/Themes.tsx:57-63`,
  а аналога `bootstrapPlugins` для тем не існує — `git grep bootstrapThemes` = 0);
  (4) registry-awareness адмінки тем; (5) `simplycms create theme` +
  conformance-kit v1; (6) контракт маркетплейс-індексу в монорепо;
  (7) Tailwind-глоби під сторонні теми + Gate THEME-контур пілота; (8) доки.
  ПОЗА фазою: повна заміна канонічних сторінок темою (спека §6, свідомо),
  строгий semver `engines.simplycms` (реліз-потяг v1.0), позиція щодо
  ліцензії екосистеми (рішення власника, спека §13), сам репозиторій
  `simplycms/marketplace` і вітрина (окремий репо — спека §4.1:153, дія
  власника), runtime-встановлення тем (D1, §14), uninstall-рядка теми з
  адмінки (деактивація достатня для v1).
- **Р1 — неймінг зафіксовано.** Базове імʼя пакета теми починається з
  `simplycms-theme-` — і в unscoped-формі (`simplycms-theme-aurora`), і під
  будь-яким scope (`@vendor/simplycms-theme-aurora`, приклад зі спеки §17.4).
  Референс-теми ядра — виняток тієї ж природи, що `@simplycms/plugin-faq`
  (тека `packages/simplycms-plugin-faq`): npm-імʼя `@simplycms/theme-<name>`,
  тека `packages/simplycms-theme-<name>`. Причина: вся реліз/аудит-механіка
  (`pack-inspect.mjs:36` `CORE_SCOPE`, `release/bump.mjs:25-36`,
  audit-deps/audit-exports, `published-exports-parity`) авто-підхоплює лише
  `packages/*` під scope `@simplycms/` — інший неймінг референса лишив би його
  поза всіма гейтами. Ключ у конфізі виводиться `stripPrefixes`
  (`packages/cli/src/config-edit.mjs:36-47`) — обидві конвенції вже стрипаються.
- **Р2 — референс-пакет = solarstore; default лишається локальною.**
  `themes/solarstore` переїжджає в `packages/simplycms-theme-solarstore`
  (npm `@simplycms/theme-solarstore`, layout `src/`), host-конфіг міняє запис
  на `solarstore: () => import('@simplycms/theme-solarstore')`. Це водночас
  лагодить неймінг-розбіжність (`themes/solarstore/package.json` має
  псевдо-scope `@themes/solarstore`, тоді як default — конвенційний
  `simplycms-theme-default`). `themes/default` НЕ переїжджає: вона — еталон
  fallback-токенів (спека §6), їде в шаблон скаффолдера байт-копією
  (`sync-create-store-template.mjs:54-58` `SYNCED_DIRS`) і є живим зразком
  copy-in-форми. Сід-міграції з рядком `solarstore` у БД (3 синхронні копії,
  `…20260215122821_theme_system_refactor.sql`) НЕ чіпаються: історію міграцій
  не переписуємо, шар «що зареєстровано в БД» незалежний від способу доставки
  коду.
- **Р3 — форма пакета теми.** За взірцем `@simplycms/plugin-faq`
  (найближчий: React-компоненти + messages): tsup, `format: esm`,
  `splitting: false` (тема — пасивний модуль без спільного singleton-стану
  між entry; обґрунтування в `simplycms-plugin-faq/tsup.config.ts:1-13`),
  `external: [/^@simplycms\//]`, `sideEffects: false`. Єдиний entry —
  `src/index.ts` (default-експорт `ThemeModule`); `exports` лише `"."`
  (dev → `src/index.ts`, `publishConfig` → `dist/index.js`).
  `files: ["dist", "src", "!src/**/__tests__/**"]` — **src обовʼязково в
  tarball-і**: він потрібен copy-in-варіанту (Р5). Peer-и — за правилами
  `audit-deps/classify.mjs:25-36`: `react`, `@tanstack/react-query`,
  `@tanstack/react-router` (+ `lucide-react` за прецедентом plugin-faq);
  `@simplycms/*` (core, i18n, supabase, themes, ui) — dependencies, як в
  інших пакетів ядра. `manifest.version` = версії пакета (0.3.0) — стереже
  новий theme-manifest-parity (Р6).
- **Р4 — `bootstrapThemes` + registry-awareness адмінки.** Новий
  `bootstrapThemes` у `@simplycms/themes` — дзеркало
  `plugin-system/src/bootstrap.ts:49-80` (`syncPluginRows`) з двома свідомими
  відмінностями: (а) session-гард ПЕРШИМ, до будь-якого `ThemeRegistry.load` —
  щоб анонімний відвідувач не тягнув чанки всіх тем (у плагінів модулі
  однаково потрібні для `register`, у тем — ні); (б) manifest береться з
  `ThemeRegistry.load(name)` лише для відсутніх у БД імен. INSERT завжди з
  `is_active: false` — інваріант `themes_active_idx` (частковий унікальний
  індекс, `schema.ts:859`) не порушується. RLS уже готова
  (`Admins can manage themes`, `schema.ts:862`) — міграцій не треба. Виклик —
  клієнтський `useEffect` поруч із `PluginBootstrap` у `__root.tsx`
  (три синхронні копії: host, `packages/cli/host/`, template — через
  `pnpm template:sync`). Адмінка: `Themes.tsx` отримує
  `ThemeRegistry.has(name)` → бейдж «модуль відсутній» + disabled
  «Активувати» (дзеркало `hasModule` у `Plugins.tsx:137`); це закриває ризик
  «рядок активний у БД, вітрина тихо рендерить default» хоча б на рівні UI.
  Uninstall-рядка НЕ додаємо (Р0).
- **Р5 — copy-in: прапорець `--copy` команди `add`.** Лише для `--theme`
  (з `--plugin` — гучна помилка). Механіка: `pnpm add <pkg>` → валідація, що
  `node_modules/<pkg>/src/index.ts` існує (конвенція форми, Р3) → копія
  `src/*` → `themes/<key>/` (+ README.md/LICENSE з кореня пакета, якщо є) →
  запис у конфіг `'<key>': () => import('@themes/<key>/index')` →
  `pnpm remove <pkg>`. Наявна тека `themes/<key>` → помилка ДО будь-яких дій
  (принцип add.mjs: незворотні дії після валідації). `--dry-run`
  підтримується. Скопійована тема підпадає під наявні глоби
  (`./themes/**/*.{ts,tsx}`) і аліас `@themes/*` — жодних змін резолву.
- **Р6 — `create theme` + conformance-kit v1.** `create.mjs` знімає блок
  `'теми — Фаза 4'` (`packages/cli/src/create.mjs:46-49`); новий шаблон
  `packages/cli/template-theme/` (package.json.tpl за конвенцією Р1/Р3,
  manifest.ts, tokens.ts, messages.ts, index.ts, components/Header.tsx,
  components/Footer.tsx, README.md; плейсхолдери `__THEME_NAME__`,
  `__THEME_DISPLAY_NAME__`, `__CORE_RANGE__`), скаффолд у `themes/<name>/` +
  запис у конфіг — локальний dev-loop без build, як у плагінів.
  Conformance-kit v1 (чесний склад, без окремого пакета):
  (1) `validateThemeModule` — уже публічний рантайм-контракт, падає при
  `ThemeRegistry.load`; (2) нова offline-перевірка doctor: кожен ключ
  `configThemeKeys` резолвиться — тека `themes/<key>/` або пакет теми в
  node_modules (`doctor-fs-checks.mjs`, за зразком №6/№7); (3) монорепо-гарди
  на референс-теми — `theme-manifest-parity` (взірець
  `tests/plugin-manifest-parity.test.ts:17-46`, плюс `displayName`),
  розширені `theme-messages-parity` та i18n-coverage (Р9); (4) розділ
  «Чекліст автора теми» в `docs/architecture/themes.md`. CLI-команда
  `theme:check` НЕ вводиться: CLI — чистий ESM без TS-лоадера, імпортувати
  `index.ts` теми він не може; глибока перевірка модуля лишається за
  `validateThemeModule` на build/рантаймі — задокументувати як межу v1.
- **Р7 — Tailwind-глоби сторонніх тем.** Шаблонний
  `template/tailwind.config.ts:10-16` доповнюється:
  `./node_modules/simplycms-theme-*/dist/**/*.js` і
  `./node_modules/@*/simplycms-theme-*/dist/**/*.js`. Референс під
  `@simplycms/theme-*` УЖЕ покритий чинним
  `./node_modules/@simplycms/*/dist/**/*.js`. Вимога «класи мають бути в
  зібраному dist-JS» стає частиною конвенції пакета теми (Р3 — tsup лишає
  рядки класів у JS). Монорепо-`tailwind.config.ts:6-12` НЕ потребує змін:
  `./packages/**/src/**/*.{ts,tsx}` покриває нову теку. Doctor-перевірка №9
  (`checkFileContains tailwind.config.ts`) розширюється маркером нового глоба.
- **Р8 — пілот: Gate THEME-контур, а не новий гейт-скрипт.** Скретч
  доводить установку теми ТИМ САМИМ флоу, що й користувач: (а)
  `@simplycms/theme-solarstore` додається в оверлейний
  `tests/pilot/store-template/package.json` (плейсхолдер-версія —
  `writeManifest` (`scaffold.mjs:97-110`) сам підмінить на `file:`-tarball;
  у `packAll` пакет потрапляє автоматично за scope); (б) після scaffold
  виконується реальний `node <repo>/packages/cli/src/index.mjs add
  @simplycms/theme-solarstore --theme --no-install` у скретчі — вставка в
  конфіг живою командою, а не сідом; (в) Gate D отримує маркер унікального
  utility-класу з компонента solarstore (`gate-d.mjs:14-19` `MARKERS`,
  `from: '@simplycms/theme-solarstore · <Component>'`) — доводить
  Tailwind-скан пакетної теми; (г) Gate A незмінний (теми роутів не несуть);
  (д) provenance покриває новий tarball автоматично (scope виводиться з
  `tarballNames`, `provenance.mjs:45-78`). Шаблон скаффолдера НЕ отримує
  solarstore (свіжий магазин — лише default; друга тема — рішення
  користувача).
- **Р9 — гарди дискаверяться з диска, не списком.** Асиметрію, зафіксовану
  розвідкою, вирівнюємо за плагінним патерном: `tests/i18n-coverage/scan.ts`
  замінює статичні `'themes/default'`, `'themes/solarstore'` (`:60-61`) на
  дискавер `themes/*` + `packages/simplycms-theme-*`
  (зразок — `pluginPackageRoots()` `:31-43`); `theme-messages-parity`
  дискаверить обидва корені (зразок — `pluginDirs()`
  `tests/plugin-messages-parity.test.ts:26-49`); eslint-зона i18n
  доповнюється `packages/simplycms-theme-*/**/*.tsx`
  (`eslint.config.mjs:35-45`).
- **Р10 — межа довіри на теми НЕ вводиться (свідомо).** Обидві наявні теми
  легітимно імпортують `@simplycms/supabase/SupabaseProvider` і хуки
  `@simplycms/core` (перевірено grep-ом сесії) — тема, на відміну від
  плагіна, споживає DI-клієнт напряму за контрактом v2 (HomeSections «сам
  тягне дані хуками» — `pages/Home.tsx:53-57`). Плагінна eslint-зона
  (`PLUGIN_TRUST_BOUNDARY_FILES`) на теми не поширюється; якщо колись
  зʼявиться theme-sdk із портами — це окрема фаза. Фіксується в
  `docs/architecture/themes.md`, щоб рішення не виглядало недоглядом.
- **Р11 — контракт маркетплейс-індексу в монорепо; репо — власник.**
  Створюємо `docs/marketplace/`: `README.md` — мінімальні вимоги подачі
  (опубліковано на npmjs; неймінг Р1; `license`; `engines.simplycms`;
  `description` англійською — показується з реєстру; для тем — валідний
  `ThemeModule` за `validateThemeModule`; подача через PR) і
  `index.sample.json` — зразок індексу з двома живими записами
  (`@simplycms/theme-solarstore`, `@simplycms/plugin-faq`). Форму стереже
  `tests/marketplace-index.test.ts` із Zod-схемою (zod уже в репо) — схема в
  тесті і є машинним контрактом v1. Репозиторій `simplycms/marketplace` і
  вітрина — дія власника (сесія скоупнута на `simplycms/simplycms`).
- **Р12 — реліз-механіка нового пакета.** `private: false` одразу, версія
  `0.3.0` (синхронна), `publishConfig.access: "public"`, README за структурою
  plugin-faq. Пакет автоматично входить у bump/verify/parity/audit
  (`bump.mjs` фільтрує лише за `private`). Наслідок чинного правила: **мерж
  гілки фази в `main` опублікує `@simplycms/theme-solarstore`** — те саме
  релізне рішення в момент мержу, що для plugin-sdk/plugin-faq;
  попередження — у CHANGELOG (Unreleased). Лічильник пакетів 25→26 (26-й =
  25 `@simplycms/*` + unscoped): `CLAUDE.md:447`,
  `docs/architecture/release-process.md:22-23`,
  `docs/tasks/platform-roadmap.md:440`, `packages/README.md:40`; принагідно
  виправити застаріле «22» у `CHANGELOG.md:5` і коментарі
  `scripts/verify-published.mjs:3`.

---

## 1. Етапи

Кожен етап лишає репо зеленим за канонічним порядком гейтів
(`pnpm install --frozen-lockfile → format:check → lint → build → typecheck →
test`; packaging-пара — де етап торкається пакування).

### Етап 1 — Референс-тема як пакет

- [ ] **Step 1:** Перенести `themes/solarstore/*` → `packages/simplycms-theme-solarstore/src/*`
      (git mv; `index.ts`, `manifest.ts`, `tokens.ts`, `messages.ts`,
      `components/` — відносні імпорти всередині не змінюються). Тека
      `themes/solarstore` зникає.
- [ ] **Step 2:** `package.json` пакета: імʼя `@simplycms/theme-solarstore`,
      `version 0.3.0`, `private: false`, `license MIT`,
      `publishConfig.access public` + dual exports (`"."`: dev `src/index.ts`,
      publish `dist/index.js` + `dist/index.d.ts`), `files` за Р3,
      `sideEffects: false`, deps/peers за Р3; `tsup.config.ts` за Р3;
      `manifest.ts`: `version: '0.3.0'`.
- [ ] **Step 3:** Аліаси: `tsconfig.json` paths і `vite.config.ts`
      resolve.alias — `@simplycms/theme-solarstore` →
      `packages/simplycms-theme-solarstore/src` (зразок —
      `@simplycms/plugin-faq`); `vitest.config.ts` — той самий рядок.
- [ ] **Step 4:** `simplycms.config.ts` (host): `solarstore: () =>
      import('@simplycms/theme-solarstore')` замість `@themes/solarstore/index`.
- [ ] **Step 5:** Гарди: eslint `I18N_MIGRATED_FILES` +
      `packages/simplycms-theme-*/**/*.tsx`; `tests/i18n-coverage/scan.ts` —
      дискавер тем з диска (Р9); `tests/theme-messages-parity.test.ts` —
      обидва корені (Р9); новий `tests/theme-manifest-parity.test.ts` (Р6:
      version==package.json.version, npm-імʼя `@simplycms/theme-<canonical>`,
      manifest.name==canonical, displayName непорожній).
- [ ] **Step 6:** README пакета (структура — `simplycms-plugin-faq/README.md`);
      прогнати повні гейти включно з `build:packages` + `test:packaging`
      (published-exports-parity авто-підхопить пакет) і `audit`-тести.

### Етап 2 — bootstrapThemes + registry-awareness адмінки

- [ ] **Step 1:** `packages/theme-system/src/bootstrapThemes.ts` (Р4):
      session-гард → SELECT known names → для відсутніх
      `ThemeRegistry.load(name)` → batch INSERT (`is_active: false`,
      display_name/version з manifest); помилки — `console.error`, без throw;
      ідемпотентно. Експорт із barrel + subpath.
- [ ] **Step 2:** Юніт-тести `packages/theme-system/src/__tests__/bootstrapThemes.test.ts`
      за методикою `plugin-system` bootstrap-тестів (mock supabase):
      без сесії — жодного load/insert; усі відомі — жодного insert; відсутня —
      insert рівно з manifest-полями; помилка load однієї теми не валить решту.
- [ ] **Step 3:** Wiring: `src/routes/__root.tsx` — виклик поруч із
      `PluginBootstrap` (`:111-127`); `pnpm template:sync` → канон
      `packages/cli/host/` і template оновлені; перевірити
      `create-store-template-parity`.
- [ ] **Step 4:** `packages/admin/src/pages/Themes.tsx`: `ThemeRegistry.has`
      → бейдж «модуль відсутній» + disabled activate (зразок —
      `Plugins.tsx:137`); нові ключі каталогу `admin.themes.*` в
      `packages/i18n/src/catalogs/{uk,en}/` (дзеркально, catalog-parity).
- [ ] **Step 5:** Повні гейти.

### Етап 3 — CLI: create theme, copy-in, doctor

- [ ] **Step 1:** `packages/cli/template-theme/` (Р6) — компілюється
      `ts.transpileModule`-перевіркою в тестах; `create.mjs`: kind `theme`,
      скаффолд у `themes/<name>/`, запис у конфіг, showSteps (dev-loop,
      активація в адмінці).
- [ ] **Step 2:** `add.mjs`: прапорець `--copy` (Р5, лише --theme) +
      theme-специфічний крок у showSteps після установки — «активуй в
      адмінці /admin/themes» (розрив UX, знайдений розвідкою).
- [ ] **Step 3:** doctor: нова offline-перевірка «ключі themes-конфігу
      резолвляться» (Р6) + розширення №9 маркером нового Tailwind-глоба (Р7).
- [ ] **Step 4:** Тести: `tests/cli-create-theme.test.ts` (методика
      `cli-create.test.ts`: temp-dir, плейсхолдери, transpile); розширення
      `tests/cli-add.test.ts` на `--copy` (валідації, dry-run, помилка при
      наявній теці) і на showSteps теми; `tests/cli-doctor.test.ts` — нова
      перевірка.
- [ ] **Step 5:** Gate TOOL: `tool-pkg-smoke.mjs` — блок `template-theme/`
      непорожня (зразок блоку `template-plugin/` `:108-124`), `--help`
      згадує `create theme`; `files` CLI-пакета + `template-theme`;
      `cli-pack.test.ts` — синхронно.
- [ ] **Step 6:** Повні гейти.

### Етап 4 — Пілот і Tailwind: Gate THEME-контур

- [ ] **Step 1:** `template/tailwind.config.ts` — глоби сторонніх тем (Р7)
      з поясненням-коментарем; `pnpm template:sync` за потреби (файл живе
      лише в шаблоні — перевірити, чи парність не зачеплена).
- [ ] **Step 2:** Пілот: `tests/pilot/store-template/package.json` +
      `@simplycms/theme-solarstore` (плейсхолдер-версія); `scaffold.mjs` —
      крок реального `simplycms add … --theme --no-install` (Р8);
      `gate-d.mjs` — маркер класу solarstore.
- [ ] **Step 3:** Прогнати `pnpm pilot:pack` — A/C/D/CLI/TOOL зелені з новим
      контуром; звірити provenance (26-й tarball локальний).
- [ ] **Step 4:** Повні гейти (packaging-пара обовʼязково).

### Етап 5 — Контракт маркетплейс-індексу

- [ ] **Step 1:** `docs/marketplace/README.md` (вимоги подачі, Р11) і
      `docs/marketplace/index.sample.json` (два живі записи).
- [ ] **Step 2:** `tests/marketplace-index.test.ts` — Zod-схема запису
      (name/type/package/description/license/engines/repository…),
      валідація семплу, унікальність пакетів, відповідність неймінгу Р1.
- [ ] **Step 3:** Повні гейти.

### Етап 6 — Доки, синхронізація канону, трекінг

- [ ] **Step 1:** Новий `docs/architecture/themes.md` за структурою
      `plugins.md` (Роль і межі / Контракт ThemeModule / Пакування npm vs
      copy-in / Установка й авторський цикл / bootstrapThemes і БД /
      Conformance-kit і чекліст автора / Чого свідомо немає (Р0, Р10) /
      Як це верифікується).
- [ ] **Step 2:** Синхронізація: `CLAUDE.md` (Project Structure, таблиця
      аліасів, розділ Theme System — установка/бутстрап, лічильник 25→26),
      `packages/README.md` (тіри + лічильник), `docs/architecture/cli.md`
      (create theme, --copy, doctor), `docs/architecture/release-process.md`
      і `test-contours.md` (лічильник/Gate THEME-контур), `AGENTS.md` за
      потреби; виправити застарілі «22» (`CHANGELOG.md:5`,
      `scripts/verify-published.mjs:3`).
- [ ] **Step 3:** `CHANGELOG.md` Unreleased — блок Фази 4 з 🔴-попередженням
      про публікацію нового пакета в момент мержу (Р12).
- [ ] **Step 4:** Роадмап: відмітити виконане у Фазі 4, оновити «Поточний
      стан» і борги (живий DoD-прогін — власник).
- [ ] **Step 5:** Фінальний повний прогін гейтів у канонічному порядку +
      `pnpm pilot:pack`.

---

## 2. DoD фази (частина «цієї сесії»)

- [ ] `@simplycms/theme-solarstore` — публікований пакет: гейти,
      packaging-parity, audit, README; host споживає його як пакет.
- [ ] `bootstrapThemes` + registry-awareness адмінки: юніти зелені, wiring у
      трьох копіях host-канону синхронний.
- [ ] `simplycms create theme` і `simplycms add … --theme --copy` — робочі,
      покриті тестами; doctor знає про теми; Gate TOOL розширено.
- [ ] Пілот доводить установку пакетної теми: реальний CLI-крок у скретчі,
      Gate D-маркер теми, provenance — зелені (`pnpm pilot:pack`).
- [ ] Контракт маркетплейс-індексу зафіксовано і стережеться тестом.
- [ ] `docs/architecture/themes.md` існує; канон/лічильники синхронізовані;
      CHANGELOG попереджає про реліз-у-момент-мержу.
- [ ] **Лишається власнику (без БД/браузера не доводиться):** живе
      перемикання встановленої теми в адмінці (`pnpm pilot:e2e` /
      `pnpm test:e2e`), поведінка `bootstrapThemes` проти живої RLS —
      разом із боргом №10 роадмапу.
