# Task: Скіл «редизайн за референсом» (redesign-from-reference)

> **Джерело рішення:** ресерч
> [`2026-08-15-website-cloner-tools.md`](../superpowers/research/2026-08-15-website-cloner-tools.md)
> (§4 — концепт, §5 — правові межі, §6 — відкриті питання) + рішення власника
> (там же і в
> [`2026-08-15-theme-contract-expansion.md`](../superpowers/research/2026-08-15-theme-contract-expansion.md) §7).
> **Передумова виконана:** контракт теми v2.2
> ([задача](./theme-contract-v2_2.md) — типографічні токени, `fonts`,
> розчинення brand-*) — скіл спирається на повний контракт.
>
> **Статус:** затверджено до виконання 2026-08-15. Гілка —
> `claude/website-cloner-analysis-p7wf4z`, PR #32 (етап Б треку).
>
> **Суть:** користувач магазину (скаффолд `create-simplycms-store`) дає
> AI-агенту URL референс-сайту → діалог про глибину/мапінг → детерміністична
> інспекція → нова тема за штатним лайфсайклом (`simplycms create theme`) з
> токенами/шрифтами/компонентами «за мотивами» референсу. Це **design
> transfer**, НЕ піксельний клон: канонічні сторінки лишаються ядром (D3/D4).

---

## 1. Контекст і поточний стан (факти, гілка `aa97ff9`)

### 1.1 Що вже є і на що спираємось (не дублювати!)

- **Контракт v2.2:** 23 кольорові токени + `radius` + `font-sans`/`font-heading`
  (`packages/theme-system/src/types.ts`, `applyTokens.ts`) + `ThemeModule.fonts`
  (https-stylesheet, фільтр `@simplycms/themes/safeFontStylesheets`) +
  `dark?`-блок. Компоненти: `Header`/`Footer` (обовʼязкові),
  `HeroBanner?`/`HomeSections?`. Каталог теми `messages` (uk/en) через
  `useThemeT` — стережуть `tests/theme-messages-parity.test.ts` і
  eslint-глоб `themes/*/components/**/*.tsx`.
- **Лайфсайкл теми:** `pnpm simplycms create theme <name>` — скаффолд у
  `themes/<name>/` + запис у конфіг (`packages/cli/src/create.mjs`,
  шаблон `packages/cli/template-theme/`); активація — `bootstrapThemes` +
  адмінка. Канон — `docs/architecture/themes.md`, посібник —
  `docs/guides/themes.md`.
- **Playwright:** `@playwright/test@1.61.1` у devDeps МОНОРЕПО
  (`playwright.config.ts`, `tests/e2e/`); Chromium у цьому середовищі
  преінстальований (`PLAYWRIGHT_BROWSERS_PATH`). У ШАБЛОНІ магазину
  Playwright НЕМАЄ.
- **Скіли репо:** джерело правди — `.agents/skills/<name>/SKILL.md`
  (frontmatter `name`+`description`, тіло markdown; зразок —
  `.agents/skills/codebase-research/`); `.claude/skills/<name>` — СИМЛІНК на
  нього. Команди — `.claude/commands/*.md` (`description`, `argument-hint`,
  `$ARGUMENTS`).
- **Синхронізація шаблону:** `scripts/sync-create-store-template.mjs` —
  `SYNCED_FILES` (host-канон) і `SYNCED_DIRS` (теки байт-копією);
  парність — `tests/create-store-template-parity.test.ts`.
- **Еталон методології:** ai-website-cloner-template (проаналізовано в
  ресерчі): спека-файл перед збіркою, interaction-model-first, усі стани,
  complexity budget ~150 рядків/агент, візуальний QA, анти-патерни.

### 1.2 Вирішені відкриті питання ресерчу (§6) — дефолти цієї задачі

1. **Playwright у шаблоні:** НЕ додається в devDeps шаблону (важкий браузер
   у кожен магазин — ні). Скрипт інспекції при старті перевіряє
   резолвабельність `playwright` і, якщо нема, друкує ТОЧНУ команду
   установки (`pnpm add -D playwright && pnpm exec playwright install
   chromium`) і виходить із кодом 1. У монорепо все вже є.
2. **Артефакти інспекції:** `docs/design-references/<slug>/` магазину
   (скріншоти + `inspection.json` + `tokens-proposal.json`), КОМІТЯТЬСЯ —
   аудитований слід рішень (модель клонера). Тека створюється скриптом.
3. **Імʼя/мова:** імʼя скіла — англійське `redesign-from-reference`
   (їде кінцевим користувачам скаффолда, які можуть не знати української;
   конвенція імен пакетів/CLI репо теж англійська); ТІЛО скіла — українською
   (мова проєкту, як усі skills/commands). У монорепо додається і
   slash-команда `.claude/commands/редизайн-за-референсом.md` — тонка
   обгортка, що інвокує скіл (двомовний вхід).
4. **Обсяг:** повний скіл одним етапом (інспекція + мапінг + тема +
   компоненти + QA), бо контракт v2.2 уже готовий; але всередині скіла
   фази 4–5 (компоненти за спеками, візуальний QA) явно позначені як такі,
   що потребують браузерного MCP/людини — без нього скіл чесно зупиняється
   після фази 3 з робочою «перефарбованою» темою.

---

## 2. Скоуп

### A. Скрипт інспекції `scripts/design-import/inspect.mjs`

CLI: `node scripts/design-import/inspect.mjs <url> [--out docs/design-references/<slug>] [--dark]`.

1. Playwright chromium (headless): відкрити URL, дочекатись networkidle,
   зняти повносторінкові скріншоти на 1440/768/390 (`desktop.png`,
   `tablet.png`, `mobile.png`).
2. Семплінг computed styles по DOM (одна `page.evaluate`, ліміт елементів
   ~2000, без зовнішніх залежностей): кольори (color/background/border) з
   ЧАСТОТАМИ і площею елемента, шрифти (family/weight/size по
   заголовках h1-h3 vs body), border-radius (кластери), box-shadow (топ-N),
   spacing-шкала (padding/margin гістограма), viewport-мета.
3. `--dark`: повторити семплінг з `prefers-color-scheme: dark` емуляцією;
   якщо палітра не змінилась — чесно записати `darkDetected: false`.
4. Вивід: `inspection.json` (структурований, версіонований полем
   `schemaVersion: 1`) + скріншоти. Мережеві збої/таймаути — гучна помилка
   з підказкою, не порожній JSON.

### B. Скрипт мапінгу `scripts/design-import/map-tokens.mjs`

CLI: `node scripts/design-import/map-tokens.mjs <inspection.json> [--out tokens-proposal.json]`.

1. Чиста детерміністична логіка (ядро — окремі функції в
   `scripts/design-import/lib/*.mjs`, покриті юнітами): кластеризація
   близьких кольорів (HSL-відстань), евристики мапінгу на семантичні
   токени: найчастіший фон → `background`, домінантний текст →
   `foreground`, найчастіший насичений акцент на інтерактивних елементах →
   `primary`, другорядний → `accent`/`secondary`, поверхні → `card`,
   бордери → `border`/`input`, радіус-кластер → `radius`; шрифти →
   `font-sans` (body) і `font-heading` (заголовки, якщо відрізняються) +
   пропозиція `fonts`-stylesheet URL для Google Fonts, якщо сімʼї звідти.
2. Значення — у форматі токенів теми (HSL-трійки без `hsl()`; шрифти —
   повний stack). `dark`-блок — з dark-семплінгу, якщо був.
3. WCAG-перевірка контрасту всіх пар `*`/`*-foreground` (AA 4.5:1 для
   тексту): провалені пари позначаються в JSON (`contrastWarnings`) —
   рішення лишається за агентом+користувачем, скрипт не «виправляє» сам.
4. Вивід `tokens-proposal.json`: `{ tokens, dark?, fonts?, confidence,
   contrastWarnings, unmapped }` — `unmapped` чесно перелічує кольори, які
   нікуди не лягли.

### C. Скіл `.agents/skills/redesign-from-reference/SKILL.md`

Джерело правди методології (+ симлінк `.claude/skills/redesign-from-reference`).
Розділи (стисло; повний зміст — за ресерчем §4 і дисциплінами клонера §1.2):

1. **Фаза 0 — кларіфай:** обовʼязкові питання (URL/сторінки; глибина:
   токени-only / повна тема / + кастомні сторінки `src/routes/my/`; мапінг
   блоків референсу на слоти Hero/HomeSections; ключ теми) + **правові
   межі** (переносимо: токени/лейаут-ідеї/настрій; НЕ переносимо: логотипи,
   бренд-ассети, тексти, фото; заборона фішинг/імперсонація) + чесне
   очікування fidelity (воронка — «в кольорах і шрифтах», не структурно).
2. **Фаза 1 — інспекція:** запуск `inspect.mjs` (з гілкою «Playwright не
   встановлено → команда установки»); опційний interaction sweep браузерним
   MCP, якщо доступний (чек-ліст: скрол/клік/ховер/стани) — без MCP фаза
   деградує до статичної інспекції, і скіл це каже.
3. **Фаза 2 — мапінг:** `map-tokens.mjs` → обговорити пропозицію з
   користувачем (особливо `contrastWarnings` і `unmapped`), затвердити.
4. **Фаза 3 — тема:** `pnpm simplycms create theme <key>` → перенести
   затверджені `tokens`/`fonts` у `themes/<key>/tokens.ts` і `index.ts` →
   `pnpm build` → активація в адмінці. Checkpoint: робочий «перефарбований»
   магазин.
5. **Фаза 4 — компоненти за спеками** (потребує браузерного MCP або
   скріншотів від користувача): для Header/Footer/HeroBanner/HomeSections —
   спека-файл ПЕРЕД кодом (`docs/design-references/<slug>/components/
   <Name>.spec.md`: точні значення, модель взаємодії
   static/click/scroll/time, усі стани, responsive 1440/768/390); збірка за
   спекою; ВСІ рядки UI — через `useThemeT` + каталог uk/en (інакше валиться
   лінт/парність). Дані компонент тягне хуками ядра (межі довіри на теми
   немає — Р10 Фази 4). Кастомні сторінки — `src/routes/my/`.
6. **Фаза 5 — верифікація:** гейти магазину; side-by-side скріншоти
   референс vs локальний магазин (той самий `inspect.mjs` проти
   `http://localhost:3000`); ітерація по розбіжностях (спека винна →
   ре-інспекція; код винен → фікс по спеці).
7. **Анти-патерни** (адаптовані з клонера): не вгадуй значення «на око»;
   не будуй click-UI там, де референс scroll-driven; не тягни чужі
   ассети/тексти; не клади рядки теми в core-каталог i18n; не редагуй
   канонічні сторінки ядра.

### D. Доставка в шаблон скаффолдера

1. `scripts/sync-create-store-template.mjs`: розширити `SYNCED_DIRS` парами
   `scripts/design-import` → `scripts/design-import` і
   `.agents/skills/redesign-from-reference` →
   `.claude/skills/redesign-from-reference` (у шаблоні — РЕАЛЬНА КОПІЯ, не
   симлінк: `npm pack`/`cpSync` шаблону не переносить симлінки надійно).
   Прогнати `pnpm template:sync`.
2. `tests/create-store-template-parity.test.ts` — має підхопити нові
   пари (перевірити, чи список пар у тесті дискаверний чи ручний — якщо
   ручний, доповнити).
3. Монорепо: `.claude/commands/редизайн-за-референсом.md` — обгортка
   («Виконай скіл redesign-from-reference для $ARGUMENTS») — у шаблон НЕ
   їде (команди — конвенція монорепо).

### E. Тести

1. Юніти чистих функцій мапінгу — `tests/design-import-map-tokens.test.ts`
   (зразок розташування — `tests/audit-deps.test.ts` та інші тести
   monorepo-скриптів): кластеризація, евристики мапінгу на фікстурному
   `inspection.json`, WCAG-контраст (позитив/негатив), формат виводу,
   `unmapped`-чесність.
2. Смок інспекції БЕЗ мережі — `tests/design-import-inspect.test.ts`:
   `inspect.mjs` проти локального фікстурного HTML (`file://` або
   `page.setContent`) у headless chromium монорепо: скріншоти зʼявились,
   `inspection.json` має очікувані кольори/шрифти фікстури. Якщо запуск
   браузера в CI-контурі неможливий — тест у `test.exclude` дефолтного
   прогону за зразком packaging-suite, з окремою командою (рішення
   планувальника — звірити з обмеженнями `pnpm test` у CI: там Docker
   недоступний, але chromium для юніт-джоба теж НЕ преінстальований).
3. Парність шаблону (§D.2).

### F. Документація

1. `docs/guides/redesign-from-reference.md` — короткий how-to для
   розробника магазину (як запустити, що отримаєш, межі).
2. `CLAUDE.md` — рядок у Agent Tooling про новий скіл; згадка скриптів у
   Quick Reference НЕ потрібна (це не гейт).
3. `docs/tasks/platform-roadmap.md` — відмітка етапу Б треку.
4. Ресерч-файл website-cloner-tools §6 — позначити питання вирішеними
   (посилання на цю задачу).

---

## 3. Верифікація / DoD

1. Юніти мапінгу зелені; смок інспекції зелений локально (або чесно
   виведений з дефолтного прогону з задокументованою причиною).
2. Повний канонічний порядок гейтів зелений; `template:sync` + парність.
3. Поведінковий DoD (монорепо, без мережі до чужих сайтів): `inspect.mjs`
   проти фікстурного HTML → `map-tokens.mjs` → валідний `tokens-proposal`,
   який після підстановки в `create theme`-скаффолд проходить
   `validateThemeModule` (юніт-ланцюжок).
4. Живий прогін по реальному референс-сайту + фази 4-5 скіла — за
   власником (потребує зовнішньої мережі/браузерного MCP/судження про
   схожість), фіксується боргом.

---

## 4. Поза скоупом (свідомо)

- Піксельний клон довільних сторінок; правки канонічних сторінок ядра
  (D3/D4); page-overrides (горизонт 2) і секційна модель (горизонт 3).
- Firecrawl/зовнішні API; окремий npm-пакет `@simplycms/design-import`
  (можлива майбутня екстракція — після обкатки скілом).
- Адмінка-UI для редизайну; автоматичне «затвердження» контрасту.
- Playwright у devDeps шаблону.

---

## 5. Відкриті питання для планувальника

1. Точний спосіб виключення браузерного смоку з CI-прогону (`test.exclude`
   + окремий config, як packaging, чи `describe.skipIf(!chromium)`) —
   звірити з фактичною поведінкою `pnpm test` у GitHub Actions.
2. Чи виносити чисті функції мапінгу в `scripts/design-import/lib/` з
   юнітами через прямий імпорт `.mjs` (прецедент — як тестуються
   `scripts/release/bump.mjs` і `audit-deps`) — слідувати наявному зразку.
3. Ліміт розміру SKILL.md: клонерський ~500 рядків; наш скіл має бути
   компактнішим (методологія без дублювання канону тем — посилання на
   `docs/architecture/themes.md` замість переказу).
