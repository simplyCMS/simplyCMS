# План: design-import — багатосторінкове охоплення + фікси живої проби

> Задача: [`docs/tasks/redesign-multipage-discovery.md`](../../tasks/redesign-multipage-discovery.md).
> Інкремент поверх етапу Б; гілка `claude/website-cloner-analysis-p7wf4z`,
> стан коду `6f33f89`. Кожна фаза лишає репо зеленим за канонічним порядком
> гейтів.

## Зафіксовані рішення (Р)

| # | Рішення |
|---|---|
| Р1 | **Scroll-through у `inspect.mjs`:** перед скріншотами/семплінгом — цикл `scrollBy` кроками ~виспорту з паузою ~400мс, до стабілізації `document.scrollHeight` двічі поспіль АБО ліміту ітерацій (константа, ~30); потім `scrollTo(0,0)` + settle ~500мс. Reveal-once секції лишаються видимими; reverse-анімації — задокументована межа v1. Логіка — в `inspectPage` (діє і на `--dark`-прохід). |
| Р2 | **Sanity радіусів:** `RADIUS_SANITY_MAX = 64` (px, константа з коментарем: карткові/кнопкові радіуси ≤ 32–48; більше — pill/full, зокрема Tailwind `rounded-full` → `calc(infinity*1px)` → 33554400). Фільтр у семплері; кількість відкинутих — поле `radiusDropped` в `inspection.json` (чесність, не мовчазний дроп). |
| Р3 | **Класифікатор — чиста функція** `lib/classify.mjs`: `classifyLinks(links: {url, anchorText}[], startUrl) → {pageTypes, unresolved}`. Типи: `home listing product cart checkout contact about`. Шкала: збіг URL-патерну +2, збіг тексту якоря +1 (словники en+uk у константах); кандидат типу — max score ≥ 2; tie-break стабільний (score↓, потім коротший pathname, потім лексикографічно). `home` — завжди стартовий URL. Один URL не може закрити два типи (жадібно за score). |
| Р4 | **`discover.mjs`:** один browser (той самий `resolveChromium`), стартова сторінка → збір `a[href]` ПІСЛЯ рендера (same-origin, без hash, дедуп по pathname, ліміт ~200 лінків) → `classifyLinks` → візити топ-кандидатів (ліміт `--max-visits`, дефолт 8): перевірка `response.ok` + `<title>`; невідвідані кандидати лишаються з поміткою `visited: false`. Помилки старту — гучні (failLoud-канал, як inspect). |
| Р5 | **`sitemap-proposal.json`** (`schemaVersion: 1`): `{ pageTypes: { <type>: {url, confidence, evidence, visited, title?} }, unresolved: [...], linksSeen: N }`. `unresolved` — обовʼязкове поле, навіть порожнє. |
| Р6 | **Мультисторінковий `map-tokens`:** кілька позиційних `inspection.json`; злиття ДО кластеризації: частоти сумуються по парі (role,value) (канонікалізація toHex уже є), `fontStylesheets` — union, шрифти — найчастотніші heading/body по сумі частот, radius — merged (після Р2-фільтра). У виводі `sources: [{file, url}]`. Один вхід — поведінка без змін (сумісність із чинними тестами). |
| Р7 | **Діалог у скілі — обовʼязковий чекпойнт:** фаза 1 = discover → таблиця «знайшов (url, confidence) ↔ unresolved» → користувач підтверджує/виправляє; для КОЖНОГО unresolved — питання «дай URL або пропускаємо». Продовження без відповіді користувача ЗАБОРОНЕНО текстом скіла. Потім inspect на кожну підтверджену: `docs/design-references/<slug>/<pageType>/`. Сторінки за логіном — чесно поза інспекцією. |
| Р8 | **Доставка:** `scripts/design-import/` уже в `SYNCED_DIRS` цілком — нові файли їдуть у шаблон самим `template:sync`; у `EXPECTED_FILES` (`create-pkg-smoke.mjs`) додати `scripts/design-import/discover.mjs`. Заборона `__ВЕЛИКИХ__` токенів діє (Gate CLI placeholder-скан). |
| Р9 | **Живі DoD-перевірки** (проти реального референсу) — руками у фазах, артефакти в scratchpad, НЕ в тестах (тести — лише локальні фікстури/сервер) і НЕ в репо. |

## Фаза 1 — Фікси проби: scroll + radius

- [ ] **Step 1:** `inspect.mjs`/`lib/sample.mjs` — scroll-through за Р1; `radiusDropped` за Р2 (фільтр у семплері, константа в `sample.mjs`).
- [ ] **Step 2:** Фікстура `tests/fixtures/design-import/reference.html`: лінива секція (IntersectionObserver являє блок з унікальним кольором лише після скролу) + pill-елемент (`border-radius: 9999px`). Синтетичну фікстуру `inspection.fixture.mjs` НЕ ламати (звірити узгодженість полів).
- [ ] **Step 3:** Регресії в `tests/design-import-inspect.test.ts`: унікальний колір лінивої секції присутній у семплах; `33554400`/`9999` відсутні в radius-кластерах; `radiusDropped > 0`.
- [ ] **Step 4:** Гейти фази. Жива перевірка (Р9): проба проти референсу — кольорів суттєво >5, radius без сміття; результат у звіт фази.

## Фаза 2 — Класифікатор (без браузера)

- [ ] **Step 1:** `scripts/design-import/lib/classify.mjs` за Р3 (≤150 рядків; словники патернів — константи з коментарями).
- [ ] **Step 2:** Юніти в `tests/design-import-discover.test.ts` (нова назва файлу — покриє і Фазу 3): класифікація типових наборів (en/uk), tie-break, поріг, «один URL — один тип», порожній вхід, unresolved.
- [ ] **Step 3:** Гейти фази.

## Фаза 3 — `discover.mjs`

- [ ] **Step 1:** CLI за Р4/Р5 (тонкий: аргументи + browser + виклики classify + IO; шаблон — inspect.mjs).
- [ ] **Step 2:** Фікстури-«сайт»: 3–4 HTML-сторінки з перехресними лінками (index → product/collection/cart) у `tests/fixtures/design-import/site/`; смок у browser-gated describe (локальний http-сервер — прецедент 403-тесту): типи класифіковано, checkout в unresolved, `sitemap-proposal.json` валідний.
- [ ] **Step 3:** `EXPECTED_FILES` += `scripts/design-import/discover.mjs` (Р8) + `pnpm template:sync`.
- [ ] **Step 4:** Гейти фази + `pnpm pilot:pack` (Gate CLI з новим EXPECTED_FILES). Жива перевірка (Р9): discover проти референсу — home+product+listing знайдені, unresolved чесний; у звіт фази.

## Фаза 4 — Мультисторінковий мапінг

- [ ] **Step 1:** `map-tokens.mjs` + `lib/map.mjs` за Р6 (merge-хелпер — чиста функція, юніт-тестована).
- [ ] **Step 2:** Юніти: два синтетичні inspection → злиті частоти/шрифти/union stylesheets/sources; один вхід — байт-та-сама пропозиція, що раніше (регрес сумісності).
- [ ] **Step 3:** Гейти фази.

## Фаза 5 — Скіл, гайд, фінал

- [ ] **Step 1:** `SKILL.md` — фаза 1 за Р7 (діалог-чекпойнт, заборона мовчазного продовження), фаза 2 — multi-input, межі v1 (reverse-анімації, сторінки за логіном); `.claude/commands/редизайн-за-референсом.md` — за потреби синхронізувати формулювання.
- [ ] **Step 2:** `docs/guides/redesign-from-reference.md` — кроки discover→діалог→inspect×N→map-tokens×N; `docs/tasks/platform-roadmap.md` — відмітка інкремента в розділі треку.
- [ ] **Step 3:** `pnpm template:sync` + повний канонічний порядок гейтів + `pnpm pilot:pack`.
- [ ] **Step 4:** Відмітки в задачі (DoD §3.1–3.3; §3.4 лайв-тест — наступний крок поза задачею) і PR #32.

## Поза скоупом плану

Агентне блукання браузером; автентифіковані сторінки; зміни контрактів
тем/сторінок; повторне ревʼю всього етапу Б (ревʼю — по дифу інкремента).
