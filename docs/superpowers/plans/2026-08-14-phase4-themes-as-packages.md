# План Фази 4 — Теми як пакети + маркетплейс-індекс (v1)

> Створено 2026-08-14; переглянуто після адверсаріального рев'ю трьома
> незалежними лінзами (спека/канон, здійсненність, повнота) — 2 блокери і
> ~12 major-знахідок влито в рішення нижче. Джерело правди вимог —
> [`../specs/2026-07-30-platform-architecture-design.md`](../specs/2026-07-30-platform-architecture-design.md)
> §6 (контракт теми), §13 (неймінг/вимоги індексу — там лише НАГАДУВАННЯ їх
> зафіксувати, тому фіксує їх цей план), §17 сценарій 4 (наскрізний флоу
> `simplycms add … --theme` npm/copy-in → rebuild → перемикання в адмінці).
> Трекінг — [`../../tasks/platform-roadmap.md`](../../tasks/platform-roadmap.md), Фаза 4.
> Окремої спеки Фази 4 немає — рішення Р0–Р14 нижче виконують її роль.
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

Розвідка (9 звітів) + рев'ю плану (3 лінзи), сесія 2026-08-14.

- **Р0 — скоуп фази.** У фазі: (1) референс-тема як публікований npm-пакет;
  (2) обидва шляхи установки зі спеки §17.4 — npm (`simplycms add … --theme`,
  вже працює) і copy-in (`--copy`, робота з нуля); (3) `bootstrapThemes` —
  синхронізація зареєстрованих тем у таблицю `themes` (без цього DoD
  недосяжний: адмінка бачить ЛИШЕ БД — `packages/admin/src/pages/Themes.tsx:57-63`,
  а аналога `bootstrapPlugins` для тем не існує — `git grep bootstrapThemes` = 0);
  (4) registry-awareness адмінки тем; (5) `simplycms create theme` +
  conformance-kit v1; (6) контракт маркетплейс-індексу в монорепо;
  (7) Tailwind-глоби під сторонні теми + Gate THEME-контур пілота;
  (8) лагодження реліз-міни `manifest.version`-літералів (Р13); (9) доки.
  ПОЗА фазою: повна заміна канонічних сторінок темою (спека §6, свідомо),
  строгий semver `engines.simplycms` (реліз-потяг v1.0), позиція щодо
  ліцензії екосистеми (рішення власника, спека §13 — див. Р11 про гейт
  подач), сам репозиторій `simplycms/marketplace` і вітрина (окремий репо —
  спека §4.1:153, дія власника), runtime-встановлення тем (D1, §14),
  uninstall-рядка теми з адмінки (деактивація достатня для v1).
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
  (`sync-create-store-template.mjs:52-56` `SYNCED_DIRS`) і є живим зразком
  copy-in-форми. Сід-міграції з рядком `solarstore` у БД (3 синхронні копії,
  `…20260215122821_theme_system_refactor.sql`) НЕ чіпаються: історію міграцій
  не переписуємо, шар «що зареєстровано в БД» незалежний від способу доставки
  коду. 🔴 Два відомі наслідки, зафіксовані як межа v1 (не баг):
  (а) рядок `solarstore` у БД лишається з `version '1.0.0'` міграції, тоді як
  пакет — `0.3.0`: `bootstrapThemes` insert-only (Р4), UPDATE метаданих рядків
  відкладено (та сама межа, що `plugins.migrations_applied` у Фазі 3);
  (б) свіжий магазин із шаблону має рядок `solarstore` у БД (міграція) без
  модуля в конфізі — після Р4 адмінка чесно покаже «модуль відсутній» замість
  тихої підміни; SQL-рядок для прибирання — у `docs/architecture/themes.md`.
- **Р3 — форма пакета теми.** За взірцем `@simplycms/plugin-faq`
  (найближчий: React-компоненти + messages): tsup, `format: esm`,
  `splitting: false` (тема — пасивний модуль без спільного singleton-стану
  між entry; обґрунтування в `simplycms-plugin-faq/tsup.config.ts:1-13`),
  `external: [/^@simplycms\//]`, `sideEffects: false`. Єдиний entry —
  `src/index.ts` (default-експорт `ThemeModule`); `exports` лише `"."`
  (dev → `src/index.ts`, `publishConfig` → `dist/index.js`).
  `files: ["dist", "src", "!src/**/__tests__/**"]` — **src обовʼязково в
  tarball-і**: він потрібен copy-in-варіанту (Р5). Манифест — повний за
  чеклістом `packages/README.md:55-104`: `registry` у `publishConfig`
  (інакше червоніє `published-exports-parity.test.ts:66-73`), `description`
  англійською (вимога подачі в індекс, Р11), `repository.directory`,
  власний `tsconfig.json` пакета (без нього tsup не згенерує `.d.ts` —
  зразок `simplycms-plugin-faq/tsconfig.json`).
  Залежності РЕФЕРЕНС-теми ядра: `@simplycms/*` (core, i18n, supabase,
  themes, ui) — `dependencies` (один реліз-потяг, одна версія); peer-и за
  `audit-deps/classify.mjs:25-36`: `react`, `@tanstack/react-query`,
  `@tanstack/react-router`, `lucide-react`. 🔴 Для СТОРОННІХ тем конвенція
  інша й фіксується в `docs/architecture/themes.md` + `docs/marketplace/README.md`:
  `@simplycms/*` — **peerDependencies** (стороння тема не в реліз-потягу;
  dependencies дублювали б React-контексти на кшталт `SupabaseProvider` —
  vite-dedupe шаблону покриває лише react/react-dom/react-query),
  сумісність із ядром — `engines.simplycms`.
- **Р4 — `bootstrapThemes` + registry-awareness адмінки.** Новий
  `bootstrapThemes` у `@simplycms/themes` — дзеркало
  `plugin-system/src/bootstrap.ts:49-80` (`syncPluginRows`) з переставленим
  порядком, що мінімізує ціну: (1) SELECT known names (публічна RLS) →
  `missing` = зареєстровані-в-registry, відсутні-в-БД; порожньо → вихід
  (типовий випадок, нуль зайвої роботи); (2) session-гард; (3) лише тоді
  `ThemeRegistry.load(name)` для missing (чанки тем тягнуться тільки в
  рідкісному вікні «тема додана, адмін ще не зайшов»); (4) batch INSERT.
  `name` рядка = ключ реєстрації (ідентичність, за якою резолвить
  `getActiveThemeSSR`); розбіжність із `manifest.name` — `console.warn`
  (дзеркало плагінного bootstrap). INSERT завжди `is_active: false` —
  інваріант `themes_active_idx` (частковий унікальний індекс,
  `schema.ts:858`) не порушується. RLS уже готова (`Admins can manage
  themes`, `schema.ts:861`) — міграцій не треба. 🔴 Чесна межа (як у
  плагінів): залогінений НЕ-адмін у вікні «є missing» пройде session-гард,
  потягне чанки і отримає RLS-відмову INSERT → `console.error`; приймаємо
  симетрично до `syncPluginRows:70-79`, фіксуємо в themes.md. Виклик —
  клієнтський `useEffect` поруч із `PluginBootstrap` у `__root.tsx`
  (три синхронні копії: host, `packages/cli/host/`, template — через
  `pnpm template:sync`; `src/routes/__root.tsx` входить у `SYNCED_FILES` —
  перевірено). Адмінка: `Themes.tsx` отримує `ThemeRegistry.has(name)` →
  бейдж «модуль відсутній» + disabled «Активувати» (дзеркало `hasModule` у
  `Plugins.tsx:137`; `packages/admin` уже залежить від `@simplycms/themes`).
  Покривається компонентним тестом (Р9). Uninstall-рядка НЕ додаємо (Р0).
  ⚠ Нотатка власнику в роадмап: e2e-смок `tests/e2e/admin-smoke/theme.e2e.ts`
  тисне ПЕРШУ кнопку «Активувати» — з появою disabled-рядків селектор треба
  буде уточнити при живому прогоні.
- **Р5 — copy-in: прапорець `--copy` команди `add`.** Лише для `--theme`
  (з `--plugin` або `--no-install` — гучна помилка: copy без install
  неможливий за природою). Порядок (незворотні дії лише після усіх
  можливих валідацій; те, що вимагає вмісту пакета, — з відкатом):
  (1) `deriveKey`; (2) **ідемпотентність**: тека `themes/<key>` існує І
  конфіг уже має `import('@themes/<key>/index')` → успіх-нічого-робити
  (контракт §2 cli.md; `hasPackage` перевіряти по `@themes/<key>/index`,
  бо npm-імʼя в copy-конфізі не зʼявляється ніколи); (3) **колізія**: тека
  існує, а конфіг на неї не вказує → помилка ДО будь-яких дій;
  (4) `pnpm add <pkg>`; (5) валідація `node_modules/<pkg>/src/index.ts`
  (конвенція форми Р3) — провал → rollback `pnpm remove <pkg>` + помилка;
  (6) **злиття залежностей**: `dependencies` пакета теми, яких немає в
  манифесті магазину, дописуються в `dependencies` магазину (інакше
  `pnpm remove` забере замикання залежностей і стороння тема з власною
  бібліотекою не збереться; на solarstore це невидимо — всі її імпорти
  випадково покриті шаблоном); (7) копія `src/*` → `themes/<key>/`
  (+ README.md/LICENSE з кореня пакета, якщо є); (8) запис у конфіг
  `'<key>': () => import('@themes/<key>/index')`; (9) `pnpm remove <pkg>`.
  `--dry-run` підтримується. Скопійована тема підпадає під наявні глоби
  (`./themes/**/*.{ts,tsx}`) і аліас `@themes/*` — жодних змін резолву.
- **Р6 — `create theme` + conformance-kit v1.** `create.mjs` знімає блок
  `'теми — Фаза 4'` (`packages/cli/src/create.mjs:46-49`); новий шаблон
  `packages/cli/template-theme/` (package.json.tpl — private, локальна
  форма як `themes/default`; manifest.ts, tokens.ts, messages.ts, index.ts,
  components/Header.tsx, components/Footer.tsx, README.md; плейсхолдери
  `__THEME_NAME__`, `__THEME_DISPLAY_NAME__`, `__CORE_RANGE__`), скаффолд у
  `themes/<name>/` + запис у конфіг — локальний dev-loop без build, як у
  плагінів. Conformance-kit v1 (чесний склад, без окремого пакета):
  (1) `validateThemeModule` — уже публічний рантайм-контракт, падає при
  `ThemeRegistry.load`; (2) нова offline-перевірка doctor рівня **warn**
  (реєструється в `runOfflineChecks`, `packages/cli/src/doctor-checks.mjs:101-137`
  — НЕ у fs-checks і НЕ розширенням №9, який має рівень error і який
  `update --write` полагодити не може): кожен запис themes-конфігу
  резолвиться — тека `themes/<key>/` або пакет у node_modules; перевірка
  йде по СПЕЦИФІКАТОРУ import(), для чого в `config-edit.mjs` додається
  `configThemeEntries(source) → {key, spec}[]` (дзеркало
  `configPluginEntries:165-177`; наявний `configThemeKeys` повертає лише
  ключі, а ключ ≠ імʼя пакета через `--name`); туди ж — warn-підказка
  додати Tailwind-глоби сторонніх тем, якщо встановлено пакет під
  конвенцією Р1, а глоба в `tailwind.config.ts` немає (файл поза каноном
  host/, `update --write` його не чіпає — лагодиться вручну за
  інструкцією warn-тексту); (3) монорепо-гарди на референс-теми —
  `theme-manifest-parity` (взірець `tests/plugin-manifest-parity.test.ts:17-46`,
  плюс `displayName`; дискаверить ЛИШЕ `packages/simplycms-theme-*` —
  `themes/default` під parity НЕ підпадає свідомо: private, власна версія),
  розширені `theme-messages-parity` та i18n-coverage (Р9);
  (4) розділ «Чекліст автора теми» в `docs/architecture/themes.md`.
  CLI-команда `theme:check` НЕ вводиться: CLI — чистий ESM без TS-лоадера,
  імпортувати `index.ts` теми він не може; глибока перевірка модуля
  лишається за `validateThemeModule` на build/рантаймі — межа v1.
- **Р7 — Tailwind-глоби сторонніх тем.** Шаблонний
  `template/tailwind.config.ts:10-16` доповнюється:
  `./node_modules/simplycms-theme-*/dist/**/*.js` і
  `./node_modules/@*/simplycms-theme-*/dist/**/*.js`. Референс під
  `@simplycms/theme-*` УЖЕ покритий чинним
  `./node_modules/@simplycms/*/dist/**/*.js`. Вимога «класи мають бути в
  зібраному dist-JS» стає частиною конвенції пакета теми (Р3; tsup лишає
  className-літерали в JS — перевірено на dist plugin-faq). 🔴 Нові глоби
  МУСЯТЬ мати власний доказ (Gate D-маркер solarstore зеленіє через СТАРИЙ
  глоб і їх не доводить): новий `tests/theme-tailwind-globs.test.ts` —
  витягує content-масив із шаблонного конфігу, синтезує в temp-dir
  node_modules-фікстури під усі три конвенції неймінгу (плюс негативний
  кейс: src-only пакет без dist НЕ матчиться) і проганяє патерни через
  `fs.globSync` (Node 22). Це наближення сканера Tailwind v4 стандартною
  glob-семантикою — фіксується в коментарі тесту. Монорепо-`tailwind.config.ts:6-12`
  НЕ потребує змін: `./packages/**/src/**/*.{ts,tsx}` покриває нову теку.
- **Р8 — пілот: Gate THEME-контур, а не новий гейт-скрипт.** 🔴 Оверлейний
  `tests/pilot/store-template/package.json` НЕ чіпається: parity-тест
  (`tests/create-store-template-parity.test.ts:121-127`) вимагає рівності
  МНОЖИН ключів deps шаблону й оверлею, а шаблон solarstore не отримує
  (свіжий магазин — лише default; друга тема — рішення користувача).
  Натомість скретч проходить ту саму послідовність, що користувач, ПІСЛЯ
  `pnpmInstall` (порядок `run.mjs:72-104`: pack → scaffold → install →
  [ТУТ theme-кроки] → provenance → build): (а) copy-in-гілка —
  `pnpm exec simplycms add @simplycms/theme-solarstore --theme --copy
  --name solarcopy` (встановленим бінарником CLI з devDeps шаблону; пакет
  резолвиться в ЛОКАЛЬНИЙ tarball через `overrides:` у
  `pnpm-workspace.yaml` скретча — `writeOverrides` уже пише їх для ВСІХ
  спакованих імен, включно з темою); (б) npm-гілка — `pnpm exec simplycms
  add @simplycms/theme-solarstore --theme` (реальний install, запис
  `solarstore:` у конфіг); (в) provenance після цих кроків — доводить, що
  й тема приїхала з tarball-а (`parseCorePackages` виводить scope з
  `tarballNames` автоматично); (г) Gate D — маркер унікального
  utility-класу з компонента solarstore (`gate-d.mjs:13-19` `MARKERS`,
  `from: '@simplycms/theme-solarstore · <Component>'`); (д) Gate A
  незмінний (теми роутів не несуть). Так обидві гілки §17.4 прожиті
  наскрізно на рівні збірки; чого контур НЕ доводить — розрізнення джерела
  маркера між глобами (`themes/**` для copy vs `@simplycms/*` для npm) —
  це закриває тест глобів із Р7.
- **Р9 — гарди дискаверяться з диска, не списком.** Асиметрію, зафіксовану
  розвідкою, вирівнюємо за плагінним патерном: `tests/i18n-coverage/scan.ts`
  замінює статичні `'themes/default'`, `'themes/solarstore'` (`:60-61`) на
  дискавер `themes/*` + `packages/simplycms-theme-*`
  (зразок — `pluginPackageRoots()` `:31-43`); `theme-messages-parity`
  дискаверить обидва корені з РІЗНОЮ формою шляху — `themes/<name>/messages.ts`
  (copy-in/локальна) і `packages/simplycms-theme-*/src/messages.ts`
  (пакетна) — обидві прописуються явно (зразок — `pluginDirs()`
  `tests/plugin-messages-parity.test.ts:26-49`); eslint-зона i18n
  доповнюється `packages/simplycms-theme-*/**/*.tsx`
  (`eslint.config.mjs:35-45`). Registry-awareness `Themes.tsx` покривається
  компонентним тестом (Testing Library/jsdom, у `packages/admin/src/__tests__/`):
  рядок без модуля → бейдж + disabled activate.
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
  `ThemeModule` за `validateThemeModule` і конвенція deps Р3; подача через
  PR) і `index.sample.json` — зразок індексу з двома живими записами
  (`@simplycms/theme-solarstore`, `@simplycms/plugin-faq`). 🔴 README
  відкривається явним блоком: «подачі не приймаються, доки власник не
  зафіксував позицію щодо ліцензії екосистеми (спека §13) — цей документ
  фіксує лише машинний контракт». Форму стереже
  `tests/marketplace-index.test.ts` із Zod-схемою (zod уже в репо) — схема
  в тесті і є машинним контрактом v1. Репозиторій `simplycms/marketplace`
  і вітрина — дія власника (сесія скоупнута на `simplycms/simplycms`).
- **Р12 — реліз-механіка нового пакета.** `private: false` одразу, версія
  `0.3.0` (синхронна — всі 25 чинних пакетів уже на 0.3.0),
  `publishConfig.access: "public"`, README за структурою plugin-faq. Пакет
  автоматично входить у bump/verify/parity/audit (`bump.mjs` фільтрує лише
  за `private`). Наслідок чинного правила: **мерж гілки фази в `main`
  опублікує `@simplycms/theme-solarstore`** — те саме релізне рішення в
  момент мержу, що для plugin-sdk/plugin-faq; попередження — у CHANGELOG
  (Unreleased). 🔴 `pnpm-lock.yaml`: перенос забирає importer
  `themes/solarstore` (`pnpm-lock.yaml:969`) і додає новий у `packages/*` —
  обовʼязковий крок «`pnpm install` (НЕ frozen) → коміт lockfile» ДО
  прогону гейтів (перший гейт — frozen; клас поламки PR #20). Лічильник
  пакетів 25→26 (26-й = 25 `@simplycms/*` + unscoped) — оновити **всі
  входження** в кожному файлі: `CLAUDE.md:447` (там і «25», і «24»),
  `docs/architecture/release-process.md:21` і `:24`,
  `docs/tasks/platform-roadmap.md:16-18` і `:440`, `packages/README.md:40`,
  кореневий `README.md:5,27` («24 пакети») + рядки статусу Фази 4 `:33,42`;
  принагідно виправити застарілі коментарі: «22» у `CHANGELOG.md:5` і
  `scripts/verify-published.mjs:3`, «21» у `scripts/release/bump.mjs:21`.
- **Р13 — реліз-міна `manifest.version`-літералів лагодиться тут.**
  Знахідка рев'ю: `bump.mjs:98-115` переписує лише `package.json` +
  `CORE_VERSION`, а `plugin-faq` тримає `version: '0.3.0'` літералом у
  `src/index.ts:15` під parity-тестом (`plugin-manifest-parity.test.ts:43`)
  — наступний `pnpm release X.Y.Z` упав би на власних гейтах ЩЕ ДО цієї
  фази, а референс-тема додала б другий такий літерал. Фікс у скоупі фази:
  `bump.mjs` вчиться переписувати version-літерал маніфестів референс-пакетів
  (`packages/simplycms-plugin-*/src/index.ts`,
  `packages/simplycms-theme-*/src/manifest.ts`) тим самим строгим
  regex-патерном, що `CORE_VERSION_RE` (не знайшов — гучна помилка);
  покривається юнітом у `tests/release-bump-coverage.test.ts`.
- **Р14 — амендменти спеки (за прецедентом §4.0).** Дві зафіксовані
  розбіжності факту зі спекою дописуються АМЕНДМЕНТАМИ, не мовчазно:
  (а) §6 — маніфест теми фактично несе `displayName` (типи
  `theme-system/src/types.ts:9-15`, гард theme-manifest-parity);
  (б) §5 — Tailwind-скан іде через `content`-глоби `tailwind.config.ts`,
  а не через генерацію `@source`-директив у `globals.css`.

---

## 1. Етапи

Кожен етап лишає репо зеленим за канонічним порядком гейтів
(`pnpm install --frozen-lockfile → format:check → lint → build → typecheck →
test`; packaging-пара — де етап торкається пакування). 🔴 Де крок міняє
будь-який `package.json` — перед гейтами `pnpm install` (НЕ frozen) і коміт
`pnpm-lock.yaml` (Р12).

### Етап 1 — Референс-тема як пакет

- [ ] **Step 1:** Перенести `themes/solarstore/*` → `packages/simplycms-theme-solarstore/src/*`
      (git mv; `index.ts`, `manifest.ts`, `tokens.ts`, `messages.ts`,
      `components/` — відносні імпорти всередині не змінюються). Тека
      `themes/solarstore` зникає.
- [ ] **Step 2:** Манифест і збірка пакета за Р3: `package.json`
      (імʼя/версія/private:false/license/description/repository/
      publishConfig із registry+access/dual exports/files/sideEffects/
      deps+peers), `tsup.config.ts`, власний `tsconfig.json` (зразок —
      plugin-faq); `manifest.ts`: `version: '0.3.0'`.
- [ ] **Step 3:** `pnpm install` (НЕ frozen) → коміт `pnpm-lock.yaml`
      (зникає importer `themes/solarstore`, зʼявляється новий пакет).
- [ ] **Step 4:** Аліаси: `tsconfig.json` paths, `vite.config.ts`
      resolve.alias, `vitest.config.ts` — `@simplycms/theme-solarstore` →
      `packages/simplycms-theme-solarstore/src` (зразок —
      `@simplycms/plugin-faq`). Host `simplycms.config.ts`:
      `solarstore: () => import('@simplycms/theme-solarstore')`.
- [ ] **Step 5:** Гарди (Р9): eslint `I18N_MIGRATED_FILES` +
      `packages/simplycms-theme-*/**/*.tsx`; `tests/i18n-coverage/scan.ts`
      — дискавер тем з диска; `tests/theme-messages-parity.test.ts` —
      обидва корені, обидві форми шляху; новий
      `tests/theme-manifest-parity.test.ts` (Р6, лише пакетні теми).
- [ ] **Step 6:** Р13: `bump.mjs` — перезапис version-літералів маніфестів
      референс-пакетів (plugin-faq `src/index.ts` + theme `src/manifest.ts`)
      + юніт у `tests/release-bump-coverage.test.ts`.
- [ ] **Step 7:** README пакета (структура — `simplycms-plugin-faq/README.md`);
      повні гейти включно з `build:packages` + `test:packaging` і
      audit-тестами.

### Етап 2 — bootstrapThemes + registry-awareness адмінки

- [ ] **Step 1:** `packages/theme-system/src/bootstrapThemes.ts` (Р4:
      SELECT→missing→early-return → session-гард → load → batch INSERT;
      name = ключ реєстрації, mismatch із manifest.name — warn; помилки —
      `console.error`, без throw; ідемпотентно). Експорт у ТРЬОХ місцях
      синхронно: barrel, `exports`+`publishConfig.exports`, `tsup entry`
      (пропуск третього валить published-exports-parity).
- [ ] **Step 2:** Юніт-тести `packages/theme-system/src/__tests__/bootstrapThemes.test.ts`
      (mock supabase, методика плагінного bootstrap.test.ts): без missing —
      жодного load/insert і жодного getSession-виклику ПІСЛЯ select; без
      сесії — жодного load; missing → insert рівно з manifest-полями;
      помилка load однієї теми не валить решту; mismatch імен — warn.
- [ ] **Step 3:** Wiring: `src/routes/__root.tsx` — виклик поруч із
      `PluginBootstrap` (`:111-127`); `pnpm template:sync` → канон
      `packages/cli/host/` і template оновлені; `create-store-template-parity`
      зелений.
- [ ] **Step 4:** `packages/admin/src/pages/Themes.tsx`: `ThemeRegistry.has`
      → бейдж «модуль відсутній» + disabled activate (зразок —
      `Plugins.tsx:137`); нові ключі каталогу `admin.themes.*` в
      `packages/i18n/src/catalogs/{uk,en}/` (дзеркально, catalog-parity);
      компонентний тест у `packages/admin/src/__tests__/` (Р9).
- [ ] **Step 5:** Повні гейти.

### Етап 3 — CLI: create theme, copy-in, doctor

- [ ] **Step 1:** `packages/cli/template-theme/` (Р6) + `create.mjs`: kind
      `theme`, скаффолд у `themes/<name>/`, запис у конфіг, showSteps
      (dev-loop, активація в адмінці); `files` CLI-пакета + `template-theme`
      → `pnpm install` + коміт lockfile за правилом Р12.
- [ ] **Step 2:** `config-edit.mjs`: нова `configThemeEntries(source)`
      (дзеркало `configPluginEntries`) + юніти в `tests/cli-add.test.ts`.
- [ ] **Step 3:** `add.mjs`: прапорець `--copy` (Р5 — порядок, rollback,
      злиття deps, ідемпотентність по `@themes/<key>/index`, конфлікт із
      `--no-install`) + theme-специфічний крок у showSteps після установки
      («активуй в адмінці /admin/themes»).
- [ ] **Step 4:** doctor: нова offline-перевірка тем рівня warn (Р6, у
      `doctor-checks.mjs`/`runOfflineChecks`; №9 НЕ чіпається) — записи
      конфігу резолвляться + підказка про Tailwind-глоби.
- [ ] **Step 5:** Тести: `tests/cli-create-theme.test.ts` (методика
      `cli-create.test.ts`: temp-dir, плейсхолдери, transpile);
      розширення `tests/cli-add.test.ts` на `--copy` (ядро copy-логіки —
      чиста функція над фікстурним node_modules у temp-store: валідації,
      злиття deps, ідемпотентність, колізія, dry-run); `tests/cli-doctor.test.ts`
      — нова перевірка.
- [ ] **Step 6:** Gate TOOL: `tool-pkg-smoke.mjs` — блок `template-theme/`
      непорожня (зразок блоку `template-plugin/` `:108-124`), `--help`
      згадує `create theme`; `cli-pack.test.ts` — синхронно.
- [ ] **Step 7:** Повні гейти.

### Етап 4 — Пілот і Tailwind: Gate THEME-контур

- [ ] **Step 1:** `template/tailwind.config.ts` — глоби сторонніх тем (Р7)
      з поясненням-коментарем; новий `tests/theme-tailwind-globs.test.ts`
      (fs.globSync-фікстури, три конвенції + негативний src-only кейс).
- [ ] **Step 2:** Пілот (Р8): у `run.mjs`/`scaffold.mjs` після
      `pnpmInstall`, до provenance — copy-in-крок
      (`… add @simplycms/theme-solarstore --theme --copy --name solarcopy`)
      і npm-крок (`… add @simplycms/theme-solarstore --theme`) встановленим
      `pnpm exec simplycms`; `gate-d.mjs` — маркер класу solarstore.
      Оверлейний package.json НЕ чіпати (parity!).
- [ ] **Step 3:** Прогнати `pnpm pilot:pack` — A/C/D/CLI/TOOL зелені з
      новим контуром; звірити provenance (26-й tarball локальний, обидві
      add-гілки відпрацювали).
- [ ] **Step 4:** Повні гейти (packaging-пара обовʼязково).

### Етап 5 — Контракт маркетплейс-індексу

- [ ] **Step 1:** `docs/marketplace/README.md` (вимоги подачі + 🔴
      ліцензійний гейт власника, Р11) і `docs/marketplace/index.sample.json`
      (два живі записи).
- [ ] **Step 2:** `tests/marketplace-index.test.ts` — Zod-схема запису
      (name/type/package/description/license/engines/repository…),
      валідація семплу, унікальність пакетів, відповідність неймінгу Р1.
- [ ] **Step 3:** Повні гейти.

### Етап 6 — Доки, синхронізація канону, трекінг

- [ ] **Step 1:** Новий `docs/architecture/themes.md` за структурою
      `plugins.md` (Роль і межі / Контракт ThemeModule / Пакування npm vs
      copy-in, конвенція deps сторонніх тем / Установка й авторський цикл /
      bootstrapThemes і БД (межі: insert-only, version-дрейф рядка, свіжий
      магазин і рядок solarstore + SQL прибирання) / Conformance-kit і
      чекліст автора / Чого свідомо немає (Р0, Р10) / Як це верифікується).
- [ ] **Step 2:** Синхронізація канону — конкретні якорі: `CLAUDE.md`
      (Project Structure `:255`, таблиця аліасів, розділ Theme System —
      установка/бутстрап, лічильники `:447` — усі входження),
      `packages/README.md` (лічильник `:40` + рядки таблиці
      `@simplycms/theme-solarstore` І пропущений з Фази 3
      `@simplycms/plugin-faq`), кореневий `README.md:5,27,33,42`,
      `AGENTS.md:104`, `.github/instructions/ui-architecture.instructions.md`
      (`applyTo` + структура тем + еталон) і
      `architecture-core.instructions.md:15`, `docs/architecture/cli.md`
      (create theme, --copy, нова doctor-перевірка),
      `docs/architecture/release-process.md:21,24` і `test-contours.md`
      (лічильник/Gate THEME-контур); застарілі коментарі за Р12.
- [ ] **Step 3:** Амендменти спеки §5/§6 (Р14) — за прецедентом §4.0.
- [ ] **Step 4:** `CHANGELOG.md` Unreleased — блок Фази 4 з 🔴-попередженням
      про публікацію нового пакета в момент мержу (Р12) + виправлення «22».
- [ ] **Step 5:** Роадмап: відмітити виконане у Фазі 4, оновити «Поточний
      стан», лічильники і борги (живий DoD-прогін + e2e-селектор theme.e2e —
      власник).
- [ ] **Step 6:** Фінальний повний прогін гейтів у канонічному порядку +
      `pnpm pilot:pack`.

---

## 2. DoD фази (частина «цієї сесії»)

- [ ] `@simplycms/theme-solarstore` — публікований пакет: гейти,
      packaging-parity, audit, README; host споживає його як пакет;
      lockfile перегенеровано.
- [ ] `bootstrapThemes` + registry-awareness адмінки: юніти і компонентний
      тест зелені, wiring у трьох копіях host-канону синхронний.
- [ ] `simplycms create theme` і `simplycms add … --theme --copy` — робочі,
      покриті тестами (включно зі злиттям deps і ідемпотентністю copy);
      doctor знає про теми (warn-рівень); Gate TOOL розширено.
- [ ] Пілот доводить ОБИДВІ гілки §17.4 на рівні збірки: copy-in і npm
      реальними CLI-командами в скретчі, Gate D-маркер теми, provenance —
      зелені (`pnpm pilot:pack`); нові Tailwind-глоби доведені
      glob-тестом.
- [ ] `bump.mjs` переписує version-літерали маніфестів референс-пакетів
      (Р13) — реліз-міна Фази 3 знешкоджена, тест є.
- [ ] Контракт маркетплейс-індексу зафіксовано і стережеться тестом;
      README містить ліцензійний гейт власника.
- [ ] `docs/architecture/themes.md` існує; канон/інструкції/лічильники
      синхронізовані (включно з кореневим README і .github/instructions);
      амендменти спеки §5/§6 внесені; CHANGELOG попереджає про
      реліз-у-момент-мержу.
- [ ] **Лишається власнику (без БД/браузера не доводиться):** живе
      перемикання встановленої теми в адмінці (`pnpm pilot:e2e` /
      `pnpm test:e2e`), поведінка `bootstrapThemes` проти живої RLS,
      уточнення селектора `theme.e2e.ts` під disabled-рядки — разом із
      боргом №10 роадмапу.
