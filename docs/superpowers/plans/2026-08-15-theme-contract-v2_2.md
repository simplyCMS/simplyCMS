# План: контракт теми v2.2 — типографіка, fonts, розчинення brand-*

> Задача: [`docs/tasks/theme-contract-v2_2.md`](../../tasks/theme-contract-v2_2.md).
> Ресерч-обґрунтування: [`2026-08-15-theme-contract-expansion.md`](../research/2026-08-15-theme-contract-expansion.md).
> Гілка `claude/website-cloner-analysis-p7wf4z`, PR #32. Стан коду на момент
> плану — `b949513` (main `73ad460` + ресерч + задача).
>
> Кожна фаза лишає репо зеленим за канонічним порядком гейтів
> `install --frozen-lockfile → format:check → lint → build → typecheck →
> test → build:packages → test:packaging`.

## Зафіксовані рішення (Р)

| # | Рішення |
|---|---|
| Р1 | Нові токени — рівно два: `'font-sans'`, `'font-heading'`. Значення — повний CSS font-family stack рядком (`"'Manrope', system-ui, sans-serif"`). `font-mono` НЕ вводиться (у storefront не вживається — YAGNI). Прецедент не-кольорового токена — `radius`. |
| Р2 | 🔴 Пастка `var()` у `font-family`: невизначена змінна робить усю декларацію invalid-at-computed-value-time (браузер відкочує font-family до inherited, а НЕ «пропускає var»). Тому fallback-значення `--font-sans`/`--font-heading` у `:root` `globals.css` — обовʼязкова частина того самого кроку, що й перехід `tailwind.config.ts` на `var()`. Чистий магазин має лишитися візуально незмінним (Inter). |
| Р3 | Заголовки: у `@layer base` додається `h1..h6 { font-family: var(--font-heading); }` — токен `font-heading` діє на КАНОНІЧНІ сторінки без правок розмітки. Дефолт `--font-heading: var(--font-sans)` → нуль візуальних змін без теми. |
| Р4 | `ThemeModule.fonts?: ReadonlyArray<{ stylesheet: string }>` — лише абсолютні `https:`-URL зовнішніх stylesheet (Google Fonts тощо). БЕЗ `@font-face`-обʼєктів і роздачі файлів (npm-тема не має каналу статики) — межа v2.2, задокументувати. Фільтрація — єдина реалізація в `@simplycms/themes` (експортована функція, юніт-тести), споживається компонентом `ThemeFonts`; невалідний запис — skip + `console.warn` (дзеркало мʼякості до `messages`). Це гігієна проти одруків, не security-межа (теми довірені, Р10 Фази 4). |
| Р5 | `ThemeFonts` рендериться в ОБОХ каркасах (`StorefrontShell` і `ProtectedShell`) поруч із `ThemeTokens` — інакше шрифт «зникав би» на сторінках профілю. `<link rel="stylesheet">` у body — body-ok, працює в SSR-стрімі. `__root.tsx` НЕ чіпається: базовий Inter-`<link>` лишається (адмінка + fallback вітрини) — host-канон не дрейфує. |
| Р6 | Розчинення brand: імена utility-класів `.gradient-brand*` ЗБЕРІГАЮТЬСЯ (3 споживачі не правляться), нутро переходить на `--primary` + `color-mix(in oklab, …, white N%)` для світлого відтінку (baseline-підтримка з 2023; Tailwind v4 сам на ньому побудований). `--brand-*` і `colors.brand` видаляються з обох копій після grep-доказу нуля інших споживачів. `--sidebar-*` не чіпаються. |
| Р7 | Носії правок host-файлів: `src/styles/globals.css` правиться в МОНОРЕПО-корені, копії в template і `packages/cli/host/` — ТІЛЬКИ через `pnpm template:sync` (руками не редагувати). `tailwind.config.ts` — поза каноном host: правиться у ДВОХ місцях руками (корінь + `packages/create-simplycms-store/template/`). |
| Р8 | Демонстрація механізму: `@simplycms/theme-solarstore` декларує явні `fonts` (stylesheet Inter) + токен `'font-sans'` — нуль візуальних змін, але контур прожитий референс-пакетом і видимий у пілоті. `themes/default` — БЕЗ `fonts` (доводить опційність). `template-theme` CLI — закоментовані приклади обох полів. |
| Р9 | Gate D пілота розширюється рядком-маркером fonts-`<link>` (сід робить solarstore активною) — лише якщо чинна механіка Gate D дозволяє додати assert без перебудови гейта; інакше — зафіксувати як борг у роадмапі. |
| Р10 | Амендмент спеки — «§6.2 Амендмент за фактом v2.2» за зразком §6.1; жодних правок тексту рішень D2–D4. |

## Фаза 1 — Контракт у `@simplycms/themes`

- [ ] **Step 1:** `packages/theme-system/src/types.ts` — додати `'font-sans'?: string` і `'font-heading'?: string` у `ThemeTokenValues` (з doc-коментарем про формат «повний font-family stack»); додати тип `ThemeFontSource = { stylesheet: string }` і поле `fonts?: ReadonlyArray<ThemeFontSource>` у `ThemeModule` (з doc-коментарем про межі v2.2: лише https-stylesheet, без @font-face — Р4).
- [ ] **Step 2:** `packages/theme-system/src/applyTokens.ts` — додати обидва ключі в `TOKEN_KEYS`; перевірити коментар про «фактичний набір» і оновити його. Санітизацію НЕ послаблювати: пересвідчитися юніт-тестом, що font-stack із лапками/комами проходить `isSafeValue`, а значення з `;`/`}` — ні.
- [ ] **Step 3:** `packages/theme-system/src/` — нова функція фільтрації fonts (напр. `safeFontStylesheets(fonts: unknown): string[]`): приймає лише масив обʼєктів зі `stylesheet`-рядком, кожен URL — `new URL(...)` з протоколом `https:`, відкидання значень із `"`/`'`/`<`/`>`/пробілами; невалідний запис — skip + `console.warn`. Експорт із barrel `index.ts` (звірити з `package.json` exports пакета).
- [ ] **Step 4:** `packages/theme-system/src/validateThemeModule.ts` — мʼяка перевірка форми `fonts` (масив обʼєктів зі `stylesheet: string`), помилки — за зразком `messages`-гілки.
- [ ] **Step 5:** Юніти `packages/theme-system/src/__tests__/`: applyTokens (нові ключі рендеряться; ключ поза TOKEN_KEYS ігнорується; font-stack проходить, інʼєкція — ні), `safeFontStylesheets` (позитив/негатив: http:, відносний URL, лапки, не-масив, порожньо), validateThemeModule (валідний/битий fonts).
- [ ] **Step 6:** Гейти фази: `pnpm format:check && pnpm lint && pnpm build && pnpm typecheck && pnpm test`.

## Фаза 2 — Провід у host і каркасах (без візуальних змін)

- [ ] **Step 1:** `src/styles/globals.css` — у `:root` `@layer base`: `--font-sans: 'Inter', system-ui, sans-serif;` та `--font-heading: var(--font-sans);`; у base-layer — правило `h1,h2,h3,h4,h5,h6 { font-family: var(--font-heading); }` (Р3).
- [ ] **Step 2:** `tailwind.config.ts` (корінь) — `fontFamily: { sans: ['var(--font-sans)'], heading: ['var(--font-heading)'] }`; те саме в `packages/create-simplycms-store/template/tailwind.config.ts` (Р7: два ручні місця, template має власні глоби — правити лише fontFamily).
- [ ] **Step 3:** `packages/storefront-routes/src/shells/ThemeFonts.tsx` — новий компонент (зразок — `ThemeTokens.tsx`): `safeFontStylesheets(theme.fonts)` → `<link rel="stylesheet" href=…>` на кожен URL; підключити в `StorefrontShell.tsx` і `ProtectedShell.tsx` поруч із `ThemeTokens` (Р5).
- [ ] **Step 4:** `pnpm template:sync` — розкатати `globals.css` у template і канон `packages/cli/host/`; звірити, що `tests/create-store-template-parity.test.ts` зелений.
- [ ] **Step 5:** Компонентний тест рендера `ThemeFonts` (jsdom/Testing Library; зразок інфраструктури — `packages/admin/src/__tests__/`): валідні URL → `<link>`-и; порожньо/відсутнє поле → null; битий запис відфільтровано.
- [ ] **Step 6:** Гейти фази (повний канонічний порядок). Поведінкова звірка кроку: чистий магазин виглядає як раніше — жодних змін комп'ютед-шрифту (Inter лишається через fallback-змінні).

## Фаза 3 — Розчинення brand-*

- [ ] **Step 1:** Grep-доказ: по всьому репо (`src`, `packages`, `themes`, `plugins`, template) єдині споживачі `--brand-*`/`colors.brand` — три utility-класи в `globals.css` і мапінг у двох `tailwind.config.ts`; вживань `bg-brand`/`text-brand`/`border-brand` — нуль. Якщо знайдено інше — зупинка, повернення до плану.
- [ ] **Step 2:** `src/styles/globals.css` — переписати `.gradient-brand`, `.gradient-brand-subtle`, `.text-gradient-brand` на `hsl(var(--primary))` + `color-mix(in oklab, hsl(var(--primary)), white 15%)` (subtle — ті самі зупинки з альфами /0.1 і /0.05); видалити блок `--brand-*` із `:root`; оновити шапку-коментар файлу («SolarStore Design System» → нейтральний опис бази токенів).
- [ ] **Step 3:** Видалити `colors.brand` з обох `tailwind.config.ts` (корінь + template).
- [ ] **Step 4:** `pnpm template:sync` (розкат `globals.css`).
- [ ] **Step 5:** Гейти фази. Поведінкова звірка: `CartButton`/`CatalogLayout` градієнти живі й фарбуються `--primary` (дефолтна палітра globals — той самий синій, тож візуальна дельта ~нуль; зате під темою default кнопка стане кораловою — ОЧІКУВАНА зміна, зафіксувати в PR-описі).
- [ ] **Step 6:** Якщо існують юніт/снепшот-тести, що фіксують видалені класи або `colors.brand` — оновити в цій же фазі.

## Фаза 4 — Носії контракту: референс-тема і шаблон автора

- [ ] **Step 1:** `packages/simplycms-theme-solarstore/src/`: у `tokens.ts` — `'font-sans': "'Inter', system-ui, sans-serif"`; у `index.ts` — `fonts: [{ stylesheet: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap' }]` (Р8; нуль візуальних змін).
- [ ] **Step 2:** `packages/cli/template-theme/tokens.ts` — закоментований приклад `'font-sans'`/`'font-heading'` з поясненням; `template-theme/index.ts` — закоментований приклад `fonts`; `template-theme/README.md` — розділ про типографіку.
- [ ] **Step 3:** Перевірити `tests/cli-create-theme.test.ts` — якщо він асертить точний вміст шаблону, оновити фікстури.
- [ ] **Step 4:** (Р9, опційно) `scripts/pilot-pack/gate-d.mjs` — додати assert рядка `fonts.googleapis.com` у SSR HTML пілота; якщо це вимагає нетривіальної перебудови гейта — НЕ робити, додати пункт у борги роадмапу.
- [ ] **Step 5:** Гейти фази + `pnpm build:packages && pnpm test:packaging` (зміни зачіпають вміст tarball теми).

## Фаза 5 — Документація, амендмент спеки, фінальна верифікація

- [ ] **Step 1:** Спека `docs/superpowers/specs/2026-07-30-platform-architecture-design.md` — новий підрозділ «6.2. Амендмент за фактом v2.2» (Р10): типографічні токени, `fonts`, «brand-змінних більше немає — семантичні токени покривають воронку». D2–D4 не правити.
- [ ] **Step 2:** `docs/architecture/themes.md` §2 — розширити контракт (`fonts`, нові токени, межі v2.2 у §1/§8); `docs/guides/themes.md` §3.3 «Токени, а не CSS» — типографіка + приклад fonts; §3.2 — контракт модуля.
- [ ] **Step 3:** `CLAUDE.md` (розділ Theme System) і `.github/instructions/ui-architecture.instructions.md` — синхронізувати формулювання контракту (v2.2).
- [ ] **Step 4:** Роадмап `docs/tasks/platform-roadmap.md` — зафіксувати трек (виконано v2.2; посилання на ресерч і задачу; борг Р9, якщо Gate D не розширювався; згадка горизонтів 2–3 як рішень-кандидатів).
- [ ] **Step 5:** Повний прогін гейтів у канонічному порядку + `pnpm pilot:pack` (закон репо: зелений `pnpm test` пакування не доводить).
- [ ] **Step 6:** Оновити чекбокси в `docs/tasks/theme-contract-v2_2.md` (DoD §3) і PR #32.

## Поза скоупом плану (звірено із задачею §4)

Горизонти 2–3, `@font-face`/self-hosted, preconnect, темізація адмінки,
`--sidebar-*`, UI шрифтів в адмінці, реліз/бамп версій. Живий браузерний
прогін (`pnpm test:e2e`/`pilot:e2e`) — за власником (Docker), як у Фазі 4.
