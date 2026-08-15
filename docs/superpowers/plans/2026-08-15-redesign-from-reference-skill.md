# План: скіл redesign-from-reference (етап Б треку редизайну)

> Задача: [`docs/tasks/redesign-from-reference-skill.md`](../../tasks/redesign-from-reference-skill.md).
> Ресерч: [`2026-08-15-website-cloner-tools.md`](../research/2026-08-15-website-cloner-tools.md).
> Гілка `claude/website-cloner-analysis-p7wf4z`, PR #32. Стан коду — `f965aaa`
> (контракт v2.2 виконаний і зревʼюваний).
>
> Кожна фаза лишає репо зеленим за канонічним порядком гейтів.

## Зафіксовані рішення (Р)

| # | Рішення |
|---|---|
| Р1 | Структура: `scripts/design-import/{inspect.mjs,map-tokens.mjs}` + чисті функції в `scripts/design-import/lib/*.mjs` (колір/кластеризація/мапінг/контраст окремими модулями, кожен ≤150 рядків, коментарі українською). CLI-файли — тонкі: парсинг аргументів + IO + виклики lib. |
| Р2 | **Нуль нових залежностей.** Колір-математика (parse hex/rgb → HSL, luminance, WCAG-контраст) — власна (~50 рядків, юніти). Playwright — ДИНАМІЧНИЙ import у `inspect.mjs`: спершу `'@playwright/test'` (є в devDeps монорепо), fallback `'playwright'` (магазин після установки); обидва відсутні → друк точної команди `pnpm add -D playwright && pnpm exec playwright install chromium` і `process.exit(1)`. `map-tokens.mjs` браузера не потребує взагалі. |
| Р3 | Смок інспекції в CI: `tests/design-import-inspect.test.ts` загорнути в `describe.skipIf(<chromium недоступний>)` — детект через спробу резолву playwright + перевірку executable (`chromium.executablePath()` існує). Скіп — гучний (повідомлення причини в назві describe). У CI GitHub Actions браузери не інстальовані → чесний skip; локально і в середовищах із преінстальованим chromium — ганяється. Фікстура — `tests/fixtures/design-import/reference.html` з ВІДОМИМИ кольорами/шрифтами/radius; рендер через `page.setContent` (нуль мережі). |
| Р4 | Формати даних версіоновані: `inspection.json` (`schemaVersion: 1`, colors-з-частотами/fonts/radius/shadows/spacing/viewports, `darkDetected`), `tokens-proposal.json` (`{ schemaVersion: 1, tokens, dark?, fonts?, confidence, contrastWarnings, unmapped }`). Значення токенів — у форматі контракту (HSL-трійки без `hsl()`; шрифти — повний stack). `unmapped` — обовʼязково чесний (кольори, що нікуди не лягли). |
| Р5 | SKILL.md ≤ ~250 рядків: методологія (фази 0–5 задачі §2.C, дисципліни клонера, анти-патерни, правові межі) БЕЗ переказу канону тем — на контракт/лайфсайкл лише посилання (`docs/architecture/themes.md`, `docs/guides/themes.md`). Frontmatter — `name: redesign-from-reference` + `description` (укр., з тригерами «редизайн», «як у сайту», «за референсом»). |
| Р6 | Доставка: `SYNCED_DIRS` += `{ from: 'scripts/design-import', to: 'scripts/design-import' }` і `{ from: '.agents/skills/redesign-from-reference', to: '.claude/skills/redesign-from-reference' }` (у шаблоні — реальна копія; симлінк лишається лише в монорепо-`.claude/`). Gate CLI: у `EXPECTED_FILES` `scripts/pilot-pack/create-pkg-smoke.mjs` додати `.claude/skills/redesign-from-reference/SKILL.md` і `scripts/design-import/inspect.mjs` — доказ, що тека доїжджає в tarball скаффолдера (dot-теки — типова жертва npm pack). |
| Р7 | Евристики мапінгу детерміністичні: стабільні сортування (частота ↓, потім hue), tie-break зафіксований; кластеризація — поріг HSL-відстані константою з коментарем-обґрунтуванням. WCAG — AA 4.5:1 для текстових пар `*`/`*-foreground`; скрипт НЕ «виправляє» кольори сам — лише `contrastWarnings`. |
| Р8 | `.claude/commands/редизайн-за-референсом.md` — тонка обгортка в МОНОРЕПО (інвокація скіла з `$ARGUMENTS`); у шаблон не синкується. `docs/design-references/` у шаблоні НЕ створюється заздалегідь (скрипт створює сам; порожні теки в git не живуть). |

## Фаза 1 — Ядро мапінгу (без браузера)

- [ ] **Step 1:** `scripts/design-import/lib/color.mjs` — parse (`#hex`, `rgb()`, `rgba()`) → HSL-трійка формату токенів; relative luminance; WCAG-ratio. Юніти покривають відомі пари (чорний/білий = 21, AA-межа).
- [ ] **Step 2:** `scripts/design-import/lib/cluster.mjs` — кластеризація кольорів за HSL-відстанню (поріг-константа, Р7), агрегація частот/площі.
- [ ] **Step 3:** `scripts/design-import/lib/map.mjs` — евристики мапінгу кластерів на семантичні токени v2.2 (задача §2.B.1) + шрифти → `font-sans`/`font-heading` + Google Fonts URL-детект → `fonts`; вивід — обʼєкт `tokens-proposal` (Р4) з `confidence`/`unmapped`.
- [ ] **Step 4:** `scripts/design-import/lib/contrast.mjs` — перевірка пар `*`/`*-foreground` → `contrastWarnings` (Р7).
- [ ] **Step 5:** `tests/design-import-map-tokens.test.ts` (зразок імпорту — `tests/audit-deps.test.ts`): юніти всіх lib-модулів на фікстурному `inspection`-обʼєкті + ланцюжок-тест DoD §3.3 — зібраний із proposal `ThemeModule` (мінімальний manifest/components + tokens/fonts з proposal) проходить `validateThemeModule` без падіння.
- [ ] **Step 6:** Гейти фази (канонічний порядок; packaging не потрібен — пакети не мінялись).

## Фаза 2 — Скрипт інспекції

- [ ] **Step 1:** `scripts/design-import/inspect.mjs` — CLI за задачею §2.A: динамічний playwright (Р2), скріншоти 1440/768/390, один `page.evaluate`-семплінг (ліміт ~2000 елементів; кольори з частотами+площею, шрифти h1-h3 vs body, radius/shadows/spacing-гістограми), `--dark` через емуляцію `prefers-color-scheme`, `--out` (дефолт `docs/design-references/<slug>`), `inspection.json` з `schemaVersion: 1`. Помилки мережі/таймаути — гучні, не порожній JSON.
- [ ] **Step 2:** Фікстура `tests/fixtures/design-import/reference.html` — контрольовані кольори (фон/текст/CTA), два шрифти (serif-заголовки, sans-body), radius; `tests/design-import-inspect.test.ts` — `describe.skipIf` за Р3: `page.setContent(фікстура)` → скріншоти існують, `inspection.json` містить очікувані кольори/шрифти/radius.
- [ ] **Step 3:** Наскрізний юніт БЕЗ браузера: `map-tokens.mjs`-ядро на СИНТЕТИЧНОМУ `inspection.json`, ідентичному тому, що зняла б фікстура — доводить контракт між скриптами незалежно від skipIf.
- [ ] **Step 4:** Гейти фази. Явно перевірити: у середовищі з chromium смок ганяється (не skip) — зафіксувати в звіті фази, який шлях спрацював.

## Фаза 3 — CLI мапінгу

- [ ] **Step 1:** `scripts/design-import/map-tokens.mjs` — CLI за задачею §2.B: читання `inspection.json`, виклики lib, запис `tokens-proposal.json`, людиночитний підсумок у stdout (топ-мапінги, warnings, unmapped) українською.
- [ ] **Step 2:** Доповнити `tests/design-import-map-tokens.test.ts` тестом CLI-обгортки (tmp-dir, реальний запуск `node scripts/design-import/map-tokens.mjs` через `execFile` — прецедент виконання скриптів є в cli-тестах).
- [ ] **Step 3:** Гейти фази.

## Фаза 4 — Скіл і доставка в шаблон

- [ ] **Step 1:** `.agents/skills/redesign-from-reference/SKILL.md` за Р5 (фази 0–5, правові межі, анти-патерни, деградація без браузерного MCP, чекліст спека-файлу компонента); симлінк `.claude/skills/redesign-from-reference` → `../../.agents/skills/redesign-from-reference` (зразок — сусідні скіли, звірити `ls -la .claude/skills/`).
- [ ] **Step 2:** `.claude/commands/редизайн-за-референсом.md` — обгортка (Р8).
- [ ] **Step 3:** `scripts/sync-create-store-template.mjs` — дві нові пари в `SYNCED_DIRS` (Р6) + `pnpm template:sync`; `tests/create-store-template-parity.test.ts` підхоплює автоматично (`it.each(SYNCED_DIRS)`).
- [ ] **Step 4:** `scripts/pilot-pack/create-pkg-smoke.mjs` — розширити `EXPECTED_FILES` (Р6).
- [ ] **Step 5:** Гейти фази + `pnpm build:packages && pnpm test:packaging` (мінявся вміст майбутнього tarball create-simplycms-store — звірити, чи packaging-suite його зачіпає; якщо ні — зафіксувати, що доказ у Gate CLI пілота).
- [ ] **Step 6:** `pnpm pilot:pack` — Gate CLI має пройти з розширеними `EXPECTED_FILES` (доказ доставки dot-теки в tarball).

## Фаза 5 — Документація і фінал

- [ ] **Step 1:** `docs/guides/redesign-from-reference.md` — how-to для розробника магазину (запуск скриптів, що отримаєш, межі fidelity, установка playwright, посилання на скіл).
- [ ] **Step 2:** `CLAUDE.md` — рядок у таблиці Agent Tooling; `docs/tasks/platform-roadmap.md` — відмітка етапу Б у розділі треку.
- [ ] **Step 3:** Ресерч `2026-08-15-website-cloner-tools.md` §6 — позначити питання вирішеними з посиланням на задачу.
- [ ] **Step 4:** Повний канонічний порядок гейтів + фінальний `pnpm pilot:pack`.
- [ ] **Step 5:** Відмітки в `docs/tasks/redesign-from-reference-skill.md` (DoD §3; живий прогін по реальному сайту — борг власника, лишити `[ ]`) і оновлення PR #32.

## Поза скоупом плану

Живий прогін по зовнішньому референс-сайту (мережа/судження — власник),
браузерний MCP-контур, npm-пакет design-import, адмінка-UI, playwright у
devDeps шаблону.
