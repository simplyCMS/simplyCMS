# План: скіл redesign-from-reference (етап Б треку редизайну)

> Задача: [`docs/tasks/redesign-from-reference-skill.md`](../../tasks/redesign-from-reference-skill.md).
> Ресерч: [`2026-08-15-website-cloner-tools.md`](../research/2026-08-15-website-cloner-tools.md).
> Гілка `claude/website-cloner-analysis-p7wf4z`, PR #32. Стан коду — `ad01740`.
>
> **v2 (2026-08-15):** влито 14/14 підтверджених знахідок адверсаріального
> ревʼю (4 лінзи × верифікація; жодну не спростовано). Ключове: (1) 🔴
> blocker — преінстальований chromium rev 1194 ≠ очікуваному в
> `@playwright/test@1.61.1` rev 1228, докачування блокує проксі; живим
> запуском ДОВЕДЕНО, що 1194 працює через `launch({ executablePath })` →
> Р2/Р3 переписані на резолвер із фолбеком; (2) ланцюжок-тест DoD був би
> майже вічнозеленим (validateThemeModule перевіряє tokens лише як isRecord)
> → Р9; (3) Google-Fonts-детект неможливий із самих computed styles → в
> inspection додано `fontStylesheets`; (4) `dark` у proposal — всередині
> tokens (форма контракту); (5) скіл: заборона `__ВЕЛИКИХ__` плейсхолдерів
> (Gate CLI сканує весь скаффолд), description англійською за каноном
> скілів; (6) eslint-виняток template/scripts — оновити обґрунтування;
> (7) дрібне: spawnSync-прецедент, таймаут смоку 60с, роадмап — доповнення
> наявного розділу треку.
>
> Кожна фаза лишає репо зеленим за канонічним порядком гейтів.

## Зафіксовані рішення (Р)

| # | Рішення |
|---|---|
| Р1 | Структура: `scripts/design-import/{inspect.mjs,map-tokens.mjs}` + чисті функції в `scripts/design-import/lib/*.mjs` (browser/колір/кластеризація/мапінг/контраст окремими модулями, кожен ≤150 рядків, коментарі українською). CLI-файли — тонкі: аргументи + IO + виклики lib. |
| Р2 | **Нуль нових залежностей.** Колір-математика власна. Playwright — ДИНАМІЧНИЙ import: спершу `'@playwright/test'` (devDeps монорепо), fallback `'playwright'`; обидва відсутні → друк команди установки і exit 1. 🔴 Резолюція браузера — окремий хелпер `lib/browser.mjs` `resolveChromium()`: якщо `chromium.executablePath()` існує — використати; інакше сканувати `PLAYWRIGHT_BROWSERS_PATH` глобом `chromium-*/chrome-linux*/chrome` (обидві розкладки: `chrome-linux/` у ≤1194 і `chrome-linux64/` у нових) і повернути `{ executablePath }` для `launch()` — з укр. коментарем про revision drift (доведено живим запуском: 1.61.1 водить chromium-1194). Нічого не знайдено → чесна відмова з командою установки. Хелпер споживають І `inspect.mjs`, І смок-тест. |
| Р3 | Смок-детект у `tests/design-import-inspect.test.ts`: **top-level await** (vitest підтримує TLA) → try `chromium.launch({...resolveChromium()})` → close → boolean у `describe.skipIf`; причина скипу — в назві describe (текст помилки launch). 🔴 ЗАБОРОНЕНО класти async-функцію безпосередньо в `skipIf` (Promise — truthy → вічний skip, TS не зловить). Таймаут браузерних тестів — локальний ~60_000 мс (третій аргумент it), глобальний конфіг не чіпати. У CI GitHub Actions браузерів немає → чесний skip; у цьому середовищі смок МАЄ ганятись через executablePath-фолбек (Р2) — «не skip» тут = гейт фази. Фікстура — `tests/fixtures/design-import/reference.html`, рендер `page.setContent` (нуль мережі). |
| Р4 | Формати версіоновані (`schemaVersion: 1`). `inspection.json`: colors-з-частотами/площею, fonts (h1-h3 vs body), radius/shadows/spacing, viewports, `darkDetected`, 🔴 `fontStylesheets: string[]` — hrefs усіх `link[rel="stylesheet"]` документа (Google Fonts через CSS `@import` v1 не ловить — задокументувати в скілі). `tokens-proposal.json`: `{ schemaVersion, tokens, fonts?, confidence, contrastWarnings, unmapped }`, де 🔴 `dark` — ВСЕРЕДИНІ `tokens` (форма `DesignTokens` контракту 1:1), а `fonts` — точно `[{ stylesheet: 'https://…' }]`. Значення: HSL-трійки без `hsl()`; шрифти — повний stack. `unmapped` — обовʼязково чесний. |
| Р5 | SKILL.md ≤ ~250 рядків: методологія (фази 0–5 задачі §2.C, дисципліни клонера, анти-патерни, правові межі, деградація без браузерного MCP) БЕЗ переказу канону тем — посилання на `docs/architecture/themes.md`/`docs/guides/themes.md`. Frontmatter: `name: redesign-from-reference`, `description` — АНГЛІЙСЬКОЮ у стилі «Use when …» (канон сусідніх скілів) з обома наборами тригерів (redesign/make it look like/from reference + редизайн/як у сайту/за референсом); тіло — українською. 🔴 У SKILL.md і скриптах design-import ЖОДНИХ токенів виду `__ВЕЛИКИМИ__` (Gate CLI після скаффолду сканує ВЕСЬ магазин регекспом плейсхолдерів) — для прикладів лише `<slug>`-нотація. |
| Р6 | Доставка: `SYNCED_DIRS` += `{ from: 'scripts/design-import', to: 'scripts/design-import' }` і `{ from: '.agents/skills/redesign-from-reference', to: '.claude/skills/redesign-from-reference' }` (у шаблоні — реальна копія; симлінк лише в монорепо). Gate CLI: `EXPECTED_FILES` у `scripts/pilot-pack/create-pkg-smoke.mjs` += `.claude/skills/redesign-from-reference/SKILL.md` і `scripts/design-import/inspect.mjs` (доказ доставки dot-теки в tarball). |
| Р7 | Евристики детерміністичні: стабільні сортування (частота ↓, потім hue), tie-break зафіксований; поріг кластеризації — константа з обґрунтуванням. `fonts`-stylesheet пропонується ЛИШЕ коли сімʼя підтверджена в googleapis-лінку з `fontStylesheets` (парсинг `family=` css/css2-URL); інакше сімʼя йде тільки в font-stack. WCAG AA 4.5:1 для текстових пар; скрипт НЕ «виправляє» кольори — лише `contrastWarnings`. |
| Р8 | `.claude/commands/редизайн-за-референсом.md` — обгортка в МОНОРЕПО; у шаблон не синкується. `docs/design-references/` заздалегідь не створюється. |
| Р9 | 🔴 Ланцюжок-тест DoD §3.3 — НЕ лише `validateThemeModule` (він перевіряє tokens тільки як isRecord — сам собою майже вічнозелений). Додаткові асерти: (а) на КОЖЕН ключ із proposal.tokens `applyTokens(tokens)` емить рівно одну декларацію `--<key>:` (невідомий ключ → менше декларацій → червоно; без нових експортів із theme-system); (б) значення 23 кольорових ключів матчать HSL-трійку `/^\d+(\.\d+)?\s+\d+(\.\d+)?%\s+\d+(\.\d+)?%$/` (radius/font-* — виняток); (в) для фікстурного inspection очікувані конкретні ключі (`background`, `foreground`, `primary`, `font-sans`) присутні в proposal. `validateThemeModule` лишається в ланцюжку (чесно перевіряє manifest/components/fonts-форму). |
| Р10 | ESLint: копія в `template/scripts/design-import` потрапляє під наявну негацію `!template/scripts/**` і лінтується вдруге — прийнято СВІДОМО (парність стереже create-store-template-parity; у design-import має бути 0 ворнінгів, тож норма «0/13» не пливе). Коментар-обґрунтування винятку в `eslint.config.mjs` (рядки ~211-215) оновити: тепер під негацією живе і синкована копія. |

## Фаза 1 — Ядро мапінгу (без браузера)

- [ ] **Step 1:** `scripts/design-import/lib/color.mjs` — parse (`#hex`, `rgb()`, `rgba()`) → HSL-трійка формату токенів; relative luminance; WCAG-ratio. Юніти: відомі пари (чорний/білий = 21, AA-межа).
- [ ] **Step 2:** `scripts/design-import/lib/cluster.mjs` — кластеризація за HSL-відстанню (поріг-константа, Р7), агрегація частот/площі.
- [ ] **Step 3:** `scripts/design-import/lib/map.mjs` — евристики мапінгу (задача §2.B.1) + шрифти → `font-sans`/`font-heading`; `fonts`-пропозиція ЛИШЕ з підтвердженням із `fontStylesheets` (Р7); вивід — `tokens-proposal` за Р4 (`dark` всередині tokens).
- [ ] **Step 4:** `scripts/design-import/lib/contrast.mjs` — пари `*`/`*-foreground` → `contrastWarnings`.
- [ ] **Step 5:** `tests/design-import-map-tokens.test.ts` (імпорт-зразок — `tests/audit-deps.test.ts`): юніти lib на фікстурному inspection-обʼєкті (з `fontStylesheets`) + ланцюжок-тест ЗА Р9 (applyTokens-емісія по кожному ключу + HSL-regex + очікувані ключі + validateThemeModule).
- [ ] **Step 6:** Гейти фази (канонічний порядок; packaging не потрібен).

## Фаза 2 — Скрипт інспекції

- [ ] **Step 1:** `scripts/design-import/lib/browser.mjs` (`resolveChromium()`, Р2) + `scripts/design-import/inspect.mjs` — CLI за задачею §2.A: динамічний playwright, скріншоти 1440/768/390, один `page.evaluate`-семплінг (~2000 елементів; кольори+частоти+площа, шрифти h1-h3 vs body, radius/shadows/spacing, 🔴 `fontStylesheets` — hrefs `link[rel=stylesheet]`), `--dark` (емуляція `prefers-color-scheme`), `--out`, `inspection.json` `schemaVersion: 1`. Помилки — гучні.
- [ ] **Step 2:** Фікстура `tests/fixtures/design-import/reference.html` (контрольовані кольори/два шрифти/radius/googleapis-`link`) + `tests/design-import-inspect.test.ts` — детект за Р3 (TLA + launch-probe, локальний таймаут 60с): скріншоти існують, `inspection.json` містить очікувані кольори/шрифти/radius/`fontStylesheets`.
- [ ] **Step 3:** Наскрізний юніт БЕЗ браузера: ядро мапінгу на СИНТЕТИЧНОМУ `inspection.json`, ідентичному фікстурному — контракт між скриптами незалежно від skipIf.
- [ ] **Step 4:** Гейти фази. 🔴 У ЦЬОМУ середовищі смок має ганятись (не skip) через executablePath-фолбек Р2 — зафіксувати в звіті, який шлях резолвера спрацював; skip тут = провал кроку.

## Фаза 3 — CLI мапінгу

- [ ] **Step 1:** `scripts/design-import/map-tokens.mjs` — CLI за задачею §2.B: читає `inspection.json`, кличе lib, пише `tokens-proposal.json`, підсумок у stdout українською (топ-мапінги, warnings, unmapped).
- [ ] **Step 2:** Тест CLI-обгортки: tmp-dir + `spawnSync(process.execPath, …)` за зразком `tests/cli-add.test.ts:204` (НЕ execFile).
- [ ] **Step 3:** Гейти фази.

## Фаза 4 — Скіл і доставка в шаблон

- [ ] **Step 1:** `.agents/skills/redesign-from-reference/SKILL.md` за Р5 (включно з 🔴 заборонами: без `__ВЕЛИКИХ__`, description англійською); симлінк `.claude/skills/redesign-from-reference` (зразок — сусіди, звірити `ls -la`).
- [ ] **Step 2:** `.claude/commands/редизайн-за-референсом.md` — обгортка (Р8).
- [ ] **Step 3:** `scripts/sync-create-store-template.mjs` — дві пари в `SYNCED_DIRS` (Р6) + оновити коментар eslint-винятку `!template/scripts/**` (Р10) + `pnpm template:sync`; parity-тест підхоплює автоматично.
- [ ] **Step 4:** `scripts/pilot-pack/create-pkg-smoke.mjs` — розширити `EXPECTED_FILES` (Р6).
- [ ] **Step 5:** Гейти фази + `pnpm build:packages && pnpm test:packaging`.
- [ ] **Step 6:** `pnpm pilot:pack` — Gate CLI з розширеними `EXPECTED_FILES`; памʼятати: placeholder-скан гейта пройдеться по нових файлах (Р5 — тому без `__ВЕЛИКИХ__`).

## Фаза 5 — Документація і фінал

- [ ] **Step 1:** `docs/guides/redesign-from-reference.md` — how-to (запуск, що отримаєш, межі fidelity, установка playwright у магазині, посилання на скіл).
- [ ] **Step 2:** `CLAUDE.md` — рядок у Agent Tooling; роадмап — 🔴 ДОПОВНИТИ наявний розділ «Трек: контракт теми v2.2 …» підрозділом етапу Б (окремий паралельний розділ НЕ створювати; за потреби перейменувати заголовок треку на «Трек: редизайн за референсом»), з боргом живого прогону.
- [ ] **Step 3:** Ресерч `2026-08-15-website-cloner-tools.md` §6 — питання вирішені (посилання на задачу).
- [ ] **Step 4:** Повний канонічний порядок гейтів + фінальний `pnpm pilot:pack`.
- [ ] **Step 5:** Відмітки в задачі (DoD §3; живий прогін по реальному сайту — борг `[ ]`) і PR #32.

## Поза скоупом плану

Живий прогін по зовнішньому референс-сайту, браузерний MCP-контур,
npm-пакет design-import, адмінка-UI, playwright у devDeps шаблону,
downgrade `@playwright/test` заради revision-парності з преінстальованим
chromium (окреме рішення власника — зачіпає і `tests/e2e`; зафіксовано як
відкрите питання в роадмапі).
