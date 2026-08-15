# Task: Контракт теми v2.2 — типографіка, шрифти від теми, розчинення brand-*

> **Джерело рішення:** ресерч
> [`2026-08-15-theme-contract-expansion.md`](../superpowers/research/2026-08-15-theme-contract-expansion.md)
> (§5 «Горизонт 1», §7 — рішення власника). Це передумова етапу Б — скіла
> «редизайн за референсом»
> ([`2026-08-15-website-cloner-tools.md`](../superpowers/research/2026-08-15-website-cloner-tools.md)).
>
> **Статус:** затверджено до виконання 2026-08-15. Гілка —
> `claude/website-cloner-analysis-p7wf4z`, PR #32.
>
> **Межі:** усе в рамках чинних рішень D2–D4 спеки — сторінки/лейаути тем НЕ
> зʼявляються. Горизонти 2 (page-overrides) і 3 (секційна модель) — поза
> скоупом, свідомо.

---

## 1. Контекст і поточний стан (факти з кодової бази, main `73ad460`)

### 1.1 Шрифти — один хардкод на весь застосунок

- `src/routes/__root.tsx:64-66` — єдине джерело шрифту: `<link>` на Google
  Fonts `Inter:wght@400;500;600;700`. Синхронні копії:
  `packages/cli/host/src/routes/__root.tsx` (канон host для
  `simplycms update`) і `packages/create-simplycms-store/template/src/routes/__root.tsx`.
- `tailwind.config.ts:87-89` — `fontFamily: { sans: ['Inter', 'system-ui',
  'sans-serif'] }` буквальним рядком; те саме в
  `packages/create-simplycms-store/template/tailwind.config.ts:102-104`.
  🔴 `tailwind.config.ts` — ПОЗА каноном `host/` (див.
  `docs/architecture/themes.md` §7 п.2), тобто копій дві, не три.
- `@font-face` / `next/font` у репо немає ніде. `font-serif` у компонентах
  тем — системний fallback без завантаження.
- Тема не має жодного каналу вплинути на шрифт: `ThemeComponents` — це
  `React.ComponentType` без head-каналу
  (`packages/theme-system/src/types.ts:79-91`).

### 1.2 Механізм токенів — жорсткий allowlist

- `ThemeTokenValues` (`packages/theme-system/src/types.ts:27-52`) — 23
  кольорові ключі + `radius`; `DesignTokens` додає `dark?`.
- `TOKEN_KEYS` (`packages/theme-system/src/applyTokens.ts:7-32`) — статичний
  масив тих самих ключів; `renderBlock` (50-58) фільтрує ПО ньому — ключ
  поза списком мовчки не потрапляє в CSS. Санітизація значень —
  `UNSAFE_VALUE = /[;{}<>]|\/\*/` (39).
- `validateThemeModule` конкретні token-ключі НЕ звіряє (лише
  `isRecord(tokens)`) — для нових ключів правок не потребує.
- Рендер — `ThemeTokens` (`packages/storefront-routes/src/shells/ThemeTokens.tsx`):
  inline-`<style>` у `StorefrontShell`, нешаровий, перекриває `@layer base`.
- Fallback-значення змінних — `src/styles/globals.css` (`:root`/`.dark`;
  копії: канон `packages/cli/host/src/styles/globals.css` + template).

### 1.3 brand-* — кольори воронки поза контрактом теми

- Визначення: `src/styles/globals.css:12-15` (`--brand`, `--brand-light`,
  `--brand-dark`, `--brand-foreground`; лише `:root`, `.dark` їх не
  перевизначає).
- Tailwind-мапінг: `tailwind.config.ts:29-34` (`colors.brand.*`).
  Прямих вживань класів `bg-brand`/`text-brand` тощо — 0.
- Реальні споживачі — три raw-CSS utility-класи
  `.gradient-brand`/`.gradient-brand-subtle`/`.text-gradient-brand`
  (`globals.css:156-181`), вжиті рівно тричі:
  `packages/catalog-ui/src/CatalogLayout.tsx:61,153`,
  `packages/cart-ui/src/CartButton.tsx:11`.
- Наслідок: перемикання теми НЕ перефарбовує градієнти воронки — лишаються
  кольори SolarStore-палітри. Це дірка контракту, а не дизайн-рішення
  (ресерч §1.3, §3.2).
- `--sidebar-*` — виключно адмінка; адмінка темою свідомо не фарбується.
  **НЕ чіпати.**

### 1.4 Що вже готове і підхопить зміни автоматично

- i18n-скан і `theme-messages-parity` — автодискаверинг тем з диска.
- `theme-manifest-parity` — лише `packages/simplycms-theme-*`.
- Спека має механізм амендментів «за фактом» (§5.1, §6.1) — для v2.2
  додається аналогічний підрозділ.
- Синхронізація копій — `pnpm template:sync`
  (`scripts/sync-create-store-template.mjs`), парність стережуть
  `tests/create-store-template-parity.test.ts` і host-drift перевірки CLI
  (`packages/cli/src/host-drift.mjs`, doctor №9 / `update --write`).

---

## 2. Скоуп

### A. Типографічні токени

1. `ThemeTokenValues` + `TOKEN_KEYS`: додати **`'font-sans'`** і
   **`'font-heading'`** (значення — повний CSS font-family stack рядком,
   напр. `"'Manrope', system-ui, sans-serif"`). Прецедент не-кольорового
   токена вже є (`radius`).
2. `src/styles/globals.css` (та обидві копії): fallback у `:root` —
   `--font-sans: 'Inter', system-ui, sans-serif;`
   `--font-heading: var(--font-sans);`
3. `tailwind.config.ts` + template-копія:
   `fontFamily: { sans: ['var(--font-sans)'], heading: ['var(--font-heading)'] }`.
   🔴 **Пастка CSS-змінних у font-family:** `var()` без визначеного значення
   робить УСЮ декларацію invalid-at-computed-value-time (браузер відкотить
   font-family до inherited, а не «пропустить var»). Тому fallback у
   `:root` `globals.css` (п.2) — обовʼязкова частина цього ж кроку, і клас
   `font-sans` має лишитися візуально незмінним на чистому магазині
   (Inter), поки тема не задала своє.
4. Санітизація: перевірити, що `UNSAFE_VALUE` пропускає лапки/коми
   font-stack-ів (за поточним regex — так) і блокує керуючі символи CSS.

### B. `ThemeModule.fonts` — завантаження шрифтів темою

1. Нове опційне поле контракту:
   `fonts?: ReadonlyArray<{ stylesheet: string }>` — https-URL зовнішніх
   stylesheet (Google Fonts і аналоги). v1 свідомо БЕЗ `@font-face`-обʼєктів
   і без роздачі файлів шрифтів темою (npm-тема не має каналу статики).
2. Рендер: компонент поруч із `ThemeTokens` у
   `StorefrontShell` (`packages/storefront-routes/src/shells/StorefrontShell.tsx`) —
   `<link rel="stylesheet" href=…>` на кожен запис. `<link rel=stylesheet>`
   у body — body-ok за HTML-спекою; працює і в SSR-стрімі.
3. Валідація/санітизація: приймати ЛИШЕ абсолютні `https:`-URL; відкидати
   значення з символами, що дозволяють вирватися з атрибута (лапки, `<`,
   `>`); невалідний запис — skip + `console.warn` (дзеркало м'якості
   `validateThemeModule` до settings). Тема — довірений код (Р10 Фази 4),
   тож це гігієна проти одруків, а не security-межа.
4. `validateThemeModule`: мʼяка перевірка форми поля (масив обʼєктів зі
   `stylesheet: string`), як для `messages`.
5. Адмінка/`__root.tsx` НЕ чіпаються: базовий Inter-`<link>` лишається
   (адмінка + fallback вітрини).

### C. Розчинення brand-*

1. Переписати `.gradient-brand`, `.gradient-brand-subtle`,
   `.text-gradient-brand` у `globals.css` (обидві копії) на семантичні
   токени (`hsl(var(--primary))` ± `--accent`), зберігши візуальний характер
   (градієнт від основного до світлішого/темнішого відтінку). Імена класів
   НЕ міняти (3 споживачі лишаються як є).
2. Видалити `--brand-*` з `globals.css` і `colors.brand` з
   `tailwind.config.ts` (обидві копії). Перед видаленням — повторний
   репо-грепом доказ нуля інших споживачів.
3. DoD-ефект: перемикання теми перефарбовує градієнти воронки.

### D. Документація і амендмент спеки

1. Спека: підрозділ «§6.2 Амендмент за фактом v2.2» (за зразком §6.1) —
   типографічні токени + `fonts` + принцип «brand-змінних більше немає».
2. `docs/architecture/themes.md` §2 (контракт) і `docs/guides/themes.md`
   §3.3 «Токени, а не CSS» — розширити типографікою і `fonts`.
3. `CLAUDE.md` (розділ Theme System) + `.github/instructions/ui-architecture.instructions.md` —
   синхронізувати формулювання контракту.
4. `packages/cli/template-theme/tokens.ts` — закоментований приклад
   `'font-sans'`; `template-theme/index.ts` — закоментований приклад
   `fonts`. README template-theme — згадка.

### E. Синхронізація носіїв контракту

- `pnpm template:sync` після правок host-файлів (`globals.css`,
  за потреби `__root.tsx`) — парність-тести мають лишитися зеленими.
- Теми: `themes/default` — без власних `fonts` (успадковує Inter-fallback);
  `packages/simplycms-theme-solarstore` — **рекомендація**: задекларувати
  явний `fonts` зі stylesheet Inter (нуль візуальних змін, але механізм
  прожитий референс-пакетом і покритий Gate D-контуром пілота) — фінальне
  рішення за планувальником.

---

## 3. Верифікація / DoD

1. **Юніти `packages/theme-system`:** `applyTokens` рендерить нові ключі;
   ключ поза `TOKEN_KEYS` ігнорується (регрес); санітизація font-stack і
   fonts-URL (позитив/негатив); `validateThemeModule` — форма `fonts`.
2. **Компонентний тест** рендера fonts-`<link>` (Testing Library, зразок —
   тести `packages/admin/src/__tests__/`).
3. **Гейти в канонічному порядку:** `pnpm install --frozen-lockfile` →
   `format:check` → `lint` → `build` → `typecheck` → `test` →
   `build:packages` → `test:packaging`.
4. **`pnpm pilot:pack`** — зміни зачіпають exports/вміст пакетів теми і
   theme-system → за законом репо (`test-contours.md`) зелений `pnpm test`
   пакування не доводить.
5. **Поведінковий DoD:** тема, що задає `font-sans`+`fonts`, міняє шрифт
   вітрини перемиканням з адмінки БЕЗ перезбірки; `.gradient-brand`
   фарбується `--primary` активної теми; чистий магазин без тем-шрифтів
   виглядає як раніше (Inter). Живий браузерний прогін
   (`pnpm test:e2e`/`pilot:e2e`) — за власником (Docker), як у Фазі 4.

---

## 4. Поза скоупом (свідомо)

- Горизонт 2 (page-presentation overrides) і горизонт 3 (секційна модель).
- `@font-face`/self-hosted шрифти від теми; preconnect-оптимізації.
- Темізація адмінки; `--sidebar-*`.
- UI налаштувань шрифтів в адмінці (тема задає шрифти кодом; `settings` —
  окрема історія).
- Реліз/бамп версій (окреме рішення власника після завершення треку).

---

## 5. Відкриті питання для планувальника

1. Чи давати solarstore власний `fonts` (рекомендація §2.E) — і якщо так,
   чи розширювати Gate D-маркер.
2. Точна форма градієнтів після розчинення brand-* (зберегти
   light/dark-відтінки через `color-mix()`? Підтримка target-браузерів —
   перевірити; альтернатива — пари `--primary`/`--accent`).
3. Чи потрібен `'font-mono'` токен одразу (у воронці моноширинний шрифт
   не вживається — схиляюсь до «ні, YAGNI»).
