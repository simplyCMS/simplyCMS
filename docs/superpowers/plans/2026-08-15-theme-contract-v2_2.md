# План: контракт теми v2.2 — типографіка, fonts, розчинення brand-*

> Задача: [`docs/tasks/theme-contract-v2_2.md`](../../tasks/theme-contract-v2_2.md).
> Ресерч-обґрунтування: [`2026-08-15-theme-contract-expansion.md`](../research/2026-08-15-theme-contract-expansion.md).
> Гілка `claude/website-cloner-analysis-p7wf4z`, PR #32. Стан коду на момент
> плану — main `73ad460`.
>
> **v2 (2026-08-15):** влито 8 підтверджених знахідок адверсаріального ревʼю
> плану (4 лінзи × верифікація спростуванням; 1 знахідку спростовано —
> React 19 precedence-попередження на `<link>` не відтворюється). Ключові
> зміни проти v1: Р3 доповнено заміною `font-serif`→`font-heading` у двох
> core-компонентах Home; Р6 отримав точні зупинки градієнтів; Р9 переписано
> повністю (Gate D розширити неможливо — він читає лише зібраний CSS; сід
> активує `default`, НЕ solarstore; голий маркер `fonts.googleapis.com` був
> би вічнозеленим через host-Inter-link — замість цього компонентний тест +
> борг у роадмапі); додано Р11 (субшлях-експорт, НЕ barrel — інакше
> `anon-client` вʼїжджає в клієнтський бандл і Gate C червоніє).
>
> Кожна фаза лишає репо зеленим за канонічним порядком гейтів
> `install --frozen-lockfile → format:check → lint → build → typecheck →
> test → build:packages → test:packaging`.

## Зафіксовані рішення (Р)

| # | Рішення |
|---|---|
| Р1 | Нові токени — рівно два: `'font-sans'`, `'font-heading'`. Значення — повний CSS font-family stack рядком (`"'Manrope', system-ui, sans-serif"`). `font-mono` НЕ вводиться (YAGNI). Прецедент не-кольорового токена — `radius`. |
| Р2 | 🔴 Пастка `var()` у `font-family`: невизначена змінна робить усю декларацію invalid-at-computed-value-time (браузер відкочує font-family до inherited, а НЕ «пропускає var»). Тому fallback-значення `--font-sans`/`--font-heading` у `:root` `globals.css` — обовʼязкова частина того самого кроку, що й перехід `tailwind.config.ts` на `var()`. Чистий магазин має лишитися візуально незмінним (Inter). |
| Р3 | Заголовки: у `@layer base` додається `h1..h6 { font-family: var(--font-heading); }`. 🔴 Ревʼю: цього НЕДОСТАТНЬО для Home — обидва core-заголовки флагманської сторінки несуть utility `font-serif` (`packages/storefront-routes/src/components/ProductCarousel.tsx:46`, `BannerSlider.tsx:146`), а utilities-шар Tailwind v4 виграє в base незалежно від порядку. Тому ТОЙ САМИЙ крок міняє в цих двох файлах `font-serif` → `font-heading` (utility з нового `fontFamily.heading`). Наслідок: серіф на чистому магазині зникає (заголовки стають Inter) — ОЧІКУВАНА зміна, зафіксувати в PR-описі. Компоненти `themes/default/**` з `font-serif` НЕ чіпати — там це вибір теми. |
| Р4 | `ThemeModule.fonts?: ReadonlyArray<{ stylesheet: string }>` — лише абсолютні `https:`-URL зовнішніх stylesheet. БЕЗ `@font-face`-обʼєктів і роздачі файлів (npm-тема не має каналу статики) — межа v2.2, задокументувати. Фільтрація — єдина реалізація `safeFontStylesheets` у `@simplycms/themes` (юніт-тести); невалідний запис — skip + `console.warn`. Гігієна проти одруків, не security-межа (теми довірені, Р10 Фази 4). |
| Р5 | `ThemeFonts` рендериться в ОБОХ каркасах (`StorefrontShell` і `ProtectedShell`) поруч із `ThemeTokens`. `<link rel="stylesheet">` у body — body-ok; ревʼю-верифікація підтвердила: React 19 precedence-попередження НЕ відтворюється (спростована знахідка). `__root.tsx` НЕ чіпається: базовий Inter-`<link>` лишається (адмінка + fallback) — host-канон не дрейфує. |
| Р6 | Розчинення brand: імена utility-класів `.gradient-brand*` зберігаються, нутро — на `--primary`. 🔴 Точні зупинки (ревʼю: наївний color-mix з альфою всередині дає ~19% молочну плівку замість 5%-тінту): `.gradient-brand` — `hsl(var(--primary))` → `color-mix(in oklab, hsl(var(--primary)), white 15%)`; `.gradient-brand-subtle` — `hsl(var(--primary) / 0.1)` → `hsl(var(--primary) / 0.05)` (на альфі 0.05 світлий відтінок невідрізненний — подвійний мікс не потрібен); `.text-gradient-brand` — як `.gradient-brand`. ЗАБОРОНЕНА форма: `color-mix(in oklab, hsl(var(--primary) / 0.05), white 15%)`. `--brand-*` і `colors.brand` видаляються після grep-доказу. `--sidebar-*` не чіпаються. |
| Р7 | Носії правок host-файлів: `src/styles/globals.css` правиться в МОНОРЕПО-корені, копії в template і `packages/cli/host/` — ТІЛЬКИ через `pnpm template:sync`. `tailwind.config.ts` — поза каноном host: правиться у ДВОХ місцях руками (корінь + template). |
| Р8 | Демонстрація механізму: `@simplycms/theme-solarstore` декларує `fonts` (stylesheet Inter) + токен `'font-sans'` — нуль візуальних змін. `themes/default` — БЕЗ `fonts` (доводить опційність). `template-theme` CLI — закоментовані приклади. 🔴 Уточнення ревʼю: у пілоті solarstore видима лише Tailwind-маркером Gate D (CSS-клас); fonts-контур пілотом НЕ доводиться (сід активує `default`) — його доводять юніт/компонентні тести Р9. |
| Р9 | **(переписано за ревʼю)** Видимість fonts-контуру: (а) Gate D розширити НЕМОЖЛИВО — він читає лише `dist/client/assets/*.css`, HTML не бачить; SSR HTML асертить лише Gate B (жива БД, поза `pilot:pack`), де голий `includes('fonts.googleapis.com')` до того ж вічнозелений через host-Inter-link `__root.tsx:66`; (б) сід пілота активує `default` (`seed-fixtures.mjs:19`), яка за Р8 без fonts. Тому: DB-free доказ — компонентний тест, що імпортує РЕАЛЬНИЙ модуль `@simplycms/theme-solarstore` і асертить: `fonts` проходить `safeFontStylesheets`, `ThemeFonts` рендерить `<link>`. Живий SSR-доказ (Gate B + SEED_THEME='solarstore' + перегенерація сіду + розрізнюваний маркер) — БОРГ у роадмап, у скоуп v2.2 не входить. |
| Р10 | Амендмент спеки — «### 6.2. Амендмент за фактом v2.2 (2026-08-15)» (повний заголовок З ДАТОЮ, шаблон §5.1/§6.1) + одне речення, чому «v2.2», а не «Фаза N» (контрактна версія, не фаза роадмапу) + назвати докази факту за жанром §6.1: юніти theme-system (Фаза 1 Step 5) і grep-доказ нуля споживачів brand-* (Фаза 3 Step 1). D2–D4 не правити. |
| Р11 | **(нове за ревʼю)** `safeFontStylesheets` експортується СУБШЛЯХОМ за прецедентом `applyTokens`, НЕ barrel-ом: barrel `index.ts` ре-експортує `getActiveThemeSSR` → `@simplycms/supabase/anon-client`, і імпорт barrel-а з клієнтського `ThemeFonts` затягнув би серверний код у клієнтський бандл (Gate C: `anon-client` у `SERVER_PAYLOAD`; провал виявився б аж на `pilot:pack`). Три обовʼязкові правки: ключ `"./safeFontStylesheets"` у `exports` `packages/theme-system/package.json` (`./src/…​.ts`), дзеркальний dist-запис у `publishConfig.exports`, новий entry у `tsup.config.ts`. Імпорт у `ThemeFonts` — ТІЛЬКИ `@simplycms/themes/safeFontStylesheets`. Гарди: `tests/audit-exports.test.ts` + `tests/published-exports-parity.test.ts` стережуть парність автоматично. |

## Фаза 1 — Контракт у `@simplycms/themes`

- [ ] **Step 1:** `packages/theme-system/src/types.ts` — додати `'font-sans'?: string` і `'font-heading'?: string` у `ThemeTokenValues` (doc-коментар про формат «повний font-family stack»); тип `ThemeFontSource = { stylesheet: string }` і поле `fonts?: ReadonlyArray<ThemeFontSource>` у `ThemeModule` (doc-коментар про межі v2.2 — Р4).
- [ ] **Step 2:** `packages/theme-system/src/applyTokens.ts` — додати обидва ключі в `TOKEN_KEYS`; оновити коментар про «фактичний набір». Санітизацію не послаблювати: юніт-тестом довести, що font-stack із лапками/комами проходить `isSafeValue`, а значення з `;`/`}` — ні.
- [ ] **Step 3:** Новий модуль `packages/theme-system/src/safeFontStylesheets.ts`: приймає `unknown`, повертає `string[]` — лише масив обʼєктів зі `stylesheet`-рядком, кожен URL парситься `new URL(...)` з протоколом `https:`, відкидання значень із `"`/`'`/`<`/`>`/пробілами; невалідний запис — skip + `console.warn`. 🔴 Експорт СУБШЛЯХОМ (Р11): ключ у `exports` → `./src/safeFontStylesheets.ts`, дзеркальний dist-запис у `publishConfig.exports` (`types` + `import`), новий entry у `tsup.config.ts`. Barrel — не чіпати.
- [ ] **Step 4:** `packages/theme-system/src/validateThemeModule.ts` — мʼяка перевірка форми `fonts` (масив обʼєктів зі `stylesheet: string`), тексти помилок — укр., за зразком `messages`-гілки.
- [ ] **Step 5:** Юніти `packages/theme-system/src/__tests__/`: applyTokens (нові ключі рендеряться; ключ поза TOKEN_KEYS ігнорується; font-stack проходить, інʼєкція — ні), `safeFontStylesheets` (позитив/негатив: `http:`, відносний URL, лапки, не-масив, порожньо), validateThemeModule (валідний/битий `fonts`).
- [ ] **Step 6:** Гейти фази: `pnpm format:check && pnpm lint && pnpm build && pnpm typecheck && pnpm test && pnpm build:packages && pnpm test:packaging` (packaging — бо мінявся `exports`/tsup theme-system; парність субшляху стережуть audit-exports + published-exports-parity).

## Фаза 2 — Провід у host і каркасах

- [ ] **Step 1:** `src/styles/globals.css` — у `:root` `@layer base`: `--font-sans: 'Inter', system-ui, sans-serif;` та `--font-heading: var(--font-sans);`; у base-layer — `h1,h2,h3,h4,h5,h6 { font-family: var(--font-heading); }` (Р3).
- [ ] **Step 2:** `tailwind.config.ts` (корінь) — `fontFamily: { sans: ['var(--font-sans)'], heading: ['var(--font-heading)'] }`; те саме у `packages/create-simplycms-store/template/tailwind.config.ts` (Р7: правити лише fontFamily, глоби template не чіпати).
- [ ] **Step 3:** 🔴 (Р3, ревʼю) `packages/storefront-routes/src/components/ProductCarousel.tsx:46` і `BannerSlider.tsx:146` — замінити `font-serif` → `font-heading`. `themes/default/**` не чіпати. Зафіксувати в PR-описі: серіф-заголовки Home на чистому магазині стають Inter.
- [ ] **Step 4:** `packages/storefront-routes/src/shells/ThemeFonts.tsx` — новий компонент (зразок — `ThemeTokens.tsx`): `import { safeFontStylesheets } from '@simplycms/themes/safeFontStylesheets'` (🔴 ТІЛЬКИ субшлях, Р11) → `<link rel="stylesheet" href=…>` на кожен URL; підключити в `StorefrontShell.tsx` і `ProtectedShell.tsx` поруч із `ThemeTokens` (Р5).
- [ ] **Step 5:** `pnpm template:sync` — розкатати `globals.css` у template і канон `packages/cli/host/`; `tests/create-store-template-parity.test.ts` зелений.
- [ ] **Step 6:** Компонентний тест рендера `ThemeFonts` (jsdom/Testing Library): валідні URL → `<link>`-и; порожньо/відсутнє поле → нічого; битий запис відфільтровано.
- [ ] **Step 7:** Гейти фази (повний канонічний порядок). Поведінкова звірка: чистий магазин — Inter скрізь (fallback-змінні працюють); заголовки Home (h2 каруселей/банера) реагують на зміну `--font-heading` (перевірити руками в dev або юнітом на клас `font-heading`).

## Фаза 3 — Розчинення brand-*

- [ ] **Step 1:** Grep-доказ по всьому репо (`src`, `packages`, `themes`, `plugins`, template): єдині споживачі `--brand-*`/`colors.brand` — три utility-класи в `globals.css` і мапінг у двох `tailwind.config.ts`; вживань `bg-brand`/`text-brand`/`border-brand`/`from-brand`/`to-brand`/`via-brand` — нуль. Інакше — зупинка, повернення до плану.
- [ ] **Step 2:** `src/styles/globals.css` — переписати три класи ТОЧНО за Р6 (зупинки зафіксовані там, включно із забороненою формою color-mix); видалити блок `--brand-*` із `:root`; оновити шапку-коментар файлу («SolarStore Design System» → нейтральний опис бази токенів).
- [ ] **Step 3:** Видалити `colors.brand` з обох `tailwind.config.ts` (корінь + template).
- [ ] **Step 4:** `pnpm template:sync` (розкат `globals.css`).
- [ ] **Step 5:** Гейти фази. Поведінкова звірка: `CartButton`/`CatalogLayout` градієнти живі й фарбуються `--primary` (база globals — той самий синій, дельта ~нуль; під темою default кнопка стане кораловою — очікувано, у PR-опис).
- [ ] **Step 6:** Якщо існують юніт/снепшот-тести на видалені класи чи `colors.brand` — оновити в цій же фазі.

## Фаза 4 — Носії контракту: референс-тема і шаблон автора

- [ ] **Step 1:** `packages/simplycms-theme-solarstore/src/`: у `tokens.ts` — `'font-sans': "'Inter', system-ui, sans-serif"`; у `index.ts` — `fonts: [{ stylesheet: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap' }]` (Р8).
- [ ] **Step 2:** `packages/cli/template-theme/tokens.ts` — закоментований приклад `'font-sans'`/`'font-heading'`; `template-theme/index.ts` — закоментований приклад `fonts`; `template-theme/README.md` — розділ про типографіку.
- [ ] **Step 3:** Перевірити `tests/cli-create-theme.test.ts` — якщо асертить точний вміст шаблону, оновити фікстури.
- [ ] **Step 4:** (Р9) Компонентний тест із РЕАЛЬНИМ модулем `@simplycms/theme-solarstore`: `fonts` проходить `safeFontStylesheets` без відкидань, `ThemeFonts` рендерить `<link>` з очікуваним href. Gate D/B НЕ чіпати.
- [ ] **Step 5:** Гейти фази + `pnpm build:packages && pnpm test:packaging` (мінявся вміст tarball теми).

## Фаза 5 — Документація, амендмент спеки, фінальна верифікація

- [ ] **Step 1:** Спека — «### 6.2. Амендмент за фактом v2.2 (2026-08-15)» ТОЧНО за Р10 (дата в заголовку; речення про «v2.2 ≠ фаза»; докази: юніти theme-system + grep-доказ brand-*). D2–D4 не правити.
- [ ] **Step 2:** `docs/architecture/themes.md` §2 — контракт (`fonts`, нові токени) + §1/§8 межі v2.2 (без @font-face, fonts-контур у пілоті не видимий — борг); `docs/guides/themes.md` §3.2/§3.3 — типографіка + приклад `fonts`.
- [ ] **Step 3:** `CLAUDE.md` (Theme System) і `.github/instructions/ui-architecture.instructions.md` — синхронізувати формулювання контракту v2.2.
- [ ] **Step 4:** Роадмап — зафіксувати трек (виконано v2.2; посилання на ресерч/задачу/план; 🔴 борг Р9: живий SSR-доказ fonts-контуру потребує Gate B + SEED_THEME='solarstore' + перегенерації сіду + розрізнюваного маркера — свідомо відкладено; горизонти 2–3 — рішення-кандидати).
- [ ] **Step 5:** Повний прогін гейтів у канонічному порядку + `pnpm pilot:pack` (закон репо: зелений `pnpm test` пакування не доводить).
- [ ] **Step 6:** Оновити чекбокси в `docs/tasks/theme-contract-v2_2.md` (DoD §3) і PR #32.

## Поза скоупом плану (звірено із задачею §4)

Горизонти 2–3, `@font-face`/self-hosted, preconnect, темізація адмінки,
`--sidebar-*`, UI шрифтів в адмінці, реліз/бамп версій, живий SSR-доказ
fonts-контуру в пілоті (борг Р9). Живий браузерний прогін
(`pnpm test:e2e`/`pilot:e2e`) — за власником (Docker), як у Фазі 4.
