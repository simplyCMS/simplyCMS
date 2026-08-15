# План: design-import — багатосторінкове охоплення + фікси живої проби

> Задача: [`docs/tasks/redesign-multipage-discovery.md`](../../tasks/redesign-multipage-discovery.md).
> Інкремент поверх етапу Б; гілка `claude/website-cloner-analysis-p7wf4z`.
>
> **v2 (2026-08-15):** влито 21/21 підтверджених знахідок адверсаріального
> ревʼю (4 лінзи на Opus × верифікація; жодну не спростовано). Ключове:
> scroll-through — на КОЖНОМУ viewport + явний десктопний семплінговий
> viewport (семпл зараз фактично йде з 390px — друга причина «5 кольорів»);
> шкала класифікатора перероблена (текст якоря — вирішальний сигнал, іконкові
> лінки читаються з aria-label); кандидат без успішного візиту → unresolved;
> merge шрифтів — голосуванням по сторінках (частот шрифтів у inspection
> немає); один вхід map-tokens ОМИНАЄ merge-шлях (гарантія сумісності);
> `--out` обовʼязковий при мультивході; template:sync у КОЖНІЙ фазі, що
> чіпає `.agents/skills/redesign-from-reference/scripts/`; розкладка артефактів `<slug>/<pageType>/`
> отримала явний механізм (скіл передає `--out`).
>
> Кожна фаза лишає репо зеленим за канонічним порядком гейтів.

## Зафіксовані рішення (Р)

| # | Рішення |
|---|---|
| Р1 | **Scroll-through — спільний хелпер** `scrollThrough(page)` у `lib/browser.mjs` (не замкнений в `inspectPage`): цикл `scrollBy` кроками ~viewport, пауза `SCROLL_STEP_MS≈400`, стабілізація = `scrollHeight` незмінний І низ досягнуто двічі поспіль, ліміт `SCROLL_MAX_ITERATIONS≈30`; у кінці `scrollTo(0,0)` + settle ≈500мс. Викликається: (а) у `captureScreenshots` — ПІСЛЯ `setViewportSize` і ПЕРЕД `screenshot({fullPage:true})` на КОЖНОМУ з трьох viewport-ів (mobile/tablet-only ліниві секції інакше лишаються нерозкритими саме там); (б) перед кожним `samplePalette` (Р1b); (в) у `discover.mjs` перед збором лінків (лінки з лінивих секцій/футера). Reverse-анімації — межа v1 (скіл §межі). Час CLI зростає ~4× пропорційно висоті сторінки — очікувана поведінка, згадати в гайді. |
| Р1b | **Семплінговий viewport — явний, десктопний.** Зараз `samplePalette` викликається після циклу скріншотів, який лишає сторінку на 390px (побічний ефект порядку ключів `VIEWPORTS`) — палітра де-факто мобільна, десктопні секції з `display:none` на вузькому лейауті випадають (`area<=0`). Фікс: перед семплінгом `inspectPage` явно ставить `VIEWPORTS.desktop`×900 + `scrollThrough`; те саме для `--dark`-проходу (після `emulateMedia`, той самий viewport — інакше light/dark порівнюють різні лейаути). В `inspection.json` — чесне поле `sampleViewport: {width, height}`. |
| Р2 | **Sanity радіусів — у Node-обгортці, не в браузері.** `browserSample` серіалізується в сторінковий контекст — модульна константа там `ReferenceError` (тому `SAMPLE_LIMIT` і передається аргументом). Фільтр — у `samplePalette` (Node): `RADIUS_SANITY_MAX = 64` (px; карткові/кнопкові ≤48, більше — pill/full: Tailwind `rounded-full` → `calc(infinity*1px)` → 33554400), повертає `{...sample, radius: kept, radiusDropped: dropped.length}`. `inspect.mjs` — дописати `radiusDropped` у whitelist-літерал `inspection` (поле інакше мовчки зникне); тест-інтерфейс `InspectionResult` — додати поле. |
| Р3 | **Шкала класифікатора:** збіг URL-патерну **+2**, збіг тексту якоря/aria **+2**, поріг **≥2** — текст якоря САМ closes тип (вимога власника «якір — сильний сигнал»; інакше вся uk-гілка словника мертва, бо кириличні pathname рідкісні). Словники en+uk — константи з коментарями. Вибір глобально-жадібний по парах (type,url): усі пари скоряться, сортуються стабільно (score↓ → коротший pathname → лексикографічно), вибираються зверху; і тип, і URL закриваються при виборі (конфлікт «два типи на один URL» отримує детермінований розвʼязок, програвший тип бере НАСТУПНОГО свого кандидата, а не зникає). `home` — корінь origin, якщо він серед лінків/стартового; інакше стартовий URL (з відповідним evidence). |
| Р3b | **Дедуп зберігає сигнали:** по нормалізованому pathname (без trailing slash, без `index.html`, без hash; query відкидається) агрегуються ВСІ тексти якорів (`textContent` + `aria-label` + `title` + `img[alt]` всередині лінка — іконковий кошик без тексту читається саме звідси); класифікатор дивиться на множину текстів, не на перший. |
| Р4 | **`discover.mjs`:** `loadChromium()` ВИНОСИТЬСЯ з `inspect.mjs` у `lib/browser.mjs` (спільний канал «Playwright не встановлено → команда установки», однакова поведінка обох CLI); один browser; стартова → `scrollThrough` → збір лінків (Р3b, ліміт ~200; `a[href]` з DOM незалежно від видимості — бургер-меню з `display:none` теж має href-и в DOM); `classifyLinks`; візити топ-кандидатів (`--max-visits`, дефолт 8). 🔴 Кандидат, чий візит НЕ ok (не-2xx / мережа) → тип іде в `unresolved` з причиною (перепідбір наступного кандидата — якщо є), а НЕ лишається «знайденим». Невідвідані через ліміт — `visited: false` чесно. |
| Р5 | **`sitemap-proposal.json`** (`schemaVersion: 1`): `pageTypes: { <type>: { url, score, evidence, visited, title? } }` — саме **`score`** (ціле, сума балів), НЕ `confidence` (щоб не плутати з часткою 0..1 у tokens-proposal, яку скіл уже вчить читати інакше). `evidence` — фіксований формат: `{ urlPattern?: string, anchorMatch?: string, source: 'anchor'|'aria'|'url' }`-масив. `unresolved: [{type, reason: 'no-candidate'|'visit-failed'}]` — обовʼязкове, навіть порожнє; `linksSeen: N`. |
| Р6 | **Merge інспекцій:** кольори — конкатенація семплів, частоти сумуються по парі (role,value), `interactive` — **OR** (будь-де інтерактивний → інтерактивний; інакше губиться primary-евристика); вхідні масиви перед злиттям сортуються стабільно (role → value) — детермінізм незалежно від порядку файлів. Шрифти: частот у inspection НЕМАЄ — **голосування по сторінках** (кожна сторінка = 1 голос за свій heading-family і 1 за body; більшість; tie-break — сторінка з більшою сумою колірних частот, потім лексикографічно). `fontStylesheets` — union (сорт). `radius` — конкатенація після Р2-фільтра. `darkDetected` — OR; dark-семпли зливаються лише зі сторінок, де dark виявлено. `sources: [{file, url}]` — ЛИШЕ в мультивхідному виводі. |
| Р6b | **CLI `map-tokens` при мультивході:** N позиційних файлів; 🔴 при N=1 — merge-шлях ПОВНІСТЮ оминається (early return на чинну логіку) — гарантія «стара поведінка байт-у-байт» задається структурно, а не тестом-порівнянням; при N>1 — `--out` **обовʼязковий** (дефолт-здогадка клала б зведення в теку однієї зі сторінок — гучна помилка з підказкою), у виводі `sources`. Чинні cli-тести (1 вхід) мають пройти БЕЗ правок — це і є регрес сумісності. |
| Р7 | **Діалог у скілі — обовʼязковий чекпойнт** (як у v1 плану) + **явний механізм розкладки артефактів**: скіл велить агенту кликати `discover.mjs <startUrl> --out docs/design-references/<slug>/sitemap-proposal.json`, потім для кожної підтвердженої сторінки `inspect.mjs <url> --out docs/design-references/<slug>/<pageType>` (CLI-дефолти НЕ міняються — розкладку задає скіл через `--out`), потім `map-tokens.mjs <всі inspection.json> --out docs/design-references/<slug>/tokens-proposal.json`. Продовження при непорожньому unresolved без відповіді користувача — заборонено текстом скіла. |
| Р8 | Доставка: `.agents/skills/redesign-from-reference/scripts/` уже цілком у `SYNCED_DIRS`; `EXPECTED_FILES` += `discover.mjs`. Заборона `__ВЕЛИКИХ__` діє. |
| Р9 | Живі DoD-перевірки — руками, артефакти в scratchpad, НЕ в тестах і НЕ в репо. |
| Р10 | 🔴 **`pnpm template:sync` — у КОЖНІЙ фазі, що чіпає `.agents/skills/redesign-from-reference/scripts/`** (фази 1–4), перед гейтами: `create-store-template-parity` порівнює копію байт-у-байт і завалить `pnpm test` без синку. |
| Р11 | **Оновлення SKILL.md — перелічені місця** (не «оновити фазу 1» абстрактно): блок фази 1 (discover+діалог), блок фази 2 (multi-input map-tokens), таблиця «Чесна деградація» (+рядок про unresolved/відмову користувача давати URL), розділ меж v1 (+reverse-анімації, +сторінки за логіном, +«палітра — десктопний viewport», +Google Fonts через `@import` не ловиться — вже є), приклади команд (нові `--out`). Гайд — ті самі місця у кроках. |

## Фаза 1 — Скрол + семплінговий viewport + радіуси

- [x] **Step 1:** `lib/browser.mjs` — `scrollThrough(page)` (Р1) + перенесення `loadChromium` з `inspect.mjs` (Р4; `inspect.mjs` імпортує звідти).
- [x] **Step 2:** `lib/sample.mjs` — `captureScreenshots`: scroll-through на кожному viewport перед знімком; `samplePalette` (Node-обгортка): Р2-фільтр радіусів + `radiusDropped`. `inspect.mjs`: явний десктопний семплінговий viewport + scroll-through перед обома проходами (light/dark, Р1b), поля `radiusDropped` і `sampleViewport` у whitelist-літерал `inspection`.
- [x] **Step 3:** Фікстура `reference.html`: ДВІ ліниві секції з унікальними кольорами — десктопна і mobile-only (`display:none` поза `@media (max-width:500px)`) — і десктопний-only елемент (`@media (max-width:700px){display:none}`) з третім унікальним кольором + pill (`border-radius: 9999px`). Синтетичну `inspection.fixture.mjs` звірити по полях (`radiusDropped`, `sampleViewport`).
- [x] **Step 4:** Регресії в `tests/design-import-inspect.test.ts`: колір десктопної лінивої секції — присутній (скрол); колір десктопного-only елемента — присутній (семпл із десктопу, НЕ з 390px); mobile-only колір — у скріншот-перевірці нема потреби асертити семплом (семпл десктопний — задокументовано); `9999`/`33554400` відсутні в radius, `radiusDropped > 0`; `InspectionResult`-інтерфейс розширено. Таймаути тестів звірити (скрол ×4 — фікстура коротка, у 60с вкладається).
- [x] **Step 5:** `pnpm template:sync` (Р10) → гейти фази. Жива перевірка (Р9): проба проти референсу — screenshot повний (продукт-грід+футер, раніше пропущені), radius чистий (`radiusDropped:1`, без `9999`/`33554400`), `sampleViewport` = `{1440,900}`. Кольорів лишилось 5 — НЕ регресія скролу (доведено окремим probe-скриптом: 1224/1289 непрозорих color-значень на сторінці Chromium серіалізує як `lab()`/`oklab()` — CSS Color 4, Tailwind v4 oklch-токени; наш `toHex` парсить лише `rgb()/rgba()` і мовчки їх дропає). Це окремий, раніше не виявлений дефект ПОЗА скоупом Р1/Р1b/Р2 — задокументовано у звіті фази, не фіксовано в цьому кроці.

## Фаза 2 — Класифікатор (без браузера)

- [x] **Step 1:** `lib/classify.mjs` за Р3/Р3b/Р5: `normalizePathname`, `classifyLinks(links: {url, anchors: string[]}[], startUrl)` → `{pageTypes, unresolved}` (глобально-жадібний вибір пар, score/evidence за Р5).
- [x] **Step 2:** Юніти `tests/design-import-discover.test.ts`: en/uk набори; якір-only сторінка (`/koshyk` + «Кошик») класифікується; іконковий лінк через aria-label; конфлікт двох типів на URL → детермінований розвʼязок + перепідбір; нормалізація pathname (slash/index.html); порожньо; unresolved із reason.
- [x] **Step 3:** `pnpm template:sync` (Р10) → гейти фази.

## Фаза 3 — `discover.mjs`

- [x] **Step 1:** CLI за Р4/Р5/Р7 (тонкий; спільні `loadChromium`/`resolveChromium`/`scrollThrough`; failLoud-канал).
- [x] **Step 2:** Фікстури-«сайт» `tests/fixtures/design-import/site/` (index + product + collection + cart з перехресними лінками, БЕЗ checkout-лінка — очікування unresolved чесне; кошик — іконковий лінк з aria-label); смок у browser-gated describe з локальним http-сервером: типи класифіковано, `checkout` в unresolved з reason, visit-failed кейс (лінк на 404-сторінку → тип в unresolved), `sitemap-proposal.json` валідний.
- [x] **Step 3:** `EXPECTED_FILES` += `discover.mjs` (Р8) + `pnpm template:sync` (Р10).
- [x] **Step 4:** Гейти фази + `pnpm pilot:pack`. Жива перевірка (Р9): discover проти референсу — home+product+listing знайдені, unresolved чесний; у звіт фази.

## Фаза 4 — Мультисторінковий мапінг

- [x] **Step 1:** `lib/merge.mjs` — чиста `mergeInspections(inspections)` за Р6 (окремий модуль ≤150 рядків); `map-tokens.mjs` за Р6b (N файлів; N=1 → early return на чинний шлях; N>1 → обовʼязковий `--out`, `sources`).
- [x] **Step 2:** Юніти: злиті частоти/OR-interactive/голосування шрифтів/union stylesheets/dark-OR; children-порядок файлів не впливає (перестановка → той самий результат); N=1 через CLI — чинні тести без правок зелені (регрес сумісності структурно за Р6b).
- [x] **Step 3:** `pnpm template:sync` (Р10) → гейти фази.

## Фаза 5 — Скіл, гайд, фінал

- [ ] **Step 1:** `SKILL.md` — рівно перелічені місця Р11 (+Р7 механізм `--out`); `.claude/commands/редизайн-за-референсом.md` — звірити формулювання.
- [ ] **Step 2:** `docs/guides/redesign-from-reference.md` — кроки discover→діалог→inspect×N→map-tokens×N, час скролу, десктопний семпл; `docs/tasks/platform-roadmap.md` — відмітка інкремента в розділі треку.
- [ ] **Step 3:** `pnpm template:sync` + повний канонічний порядок гейтів + `pnpm pilot:pack`.
- [ ] **Step 4:** Відмітки в задачі (DoD §3.1–3.3; §3.4 лайв-тест — наступний крок) і PR #32.

## Поза скоупом плану

Агентне блукання браузером; автентифіковані сторінки; частоти шрифтів у
семплері (голосування по сторінках достатнє для v1); зміни контрактів
тем/сторінок; повторне ревʼю всього етапу Б.
