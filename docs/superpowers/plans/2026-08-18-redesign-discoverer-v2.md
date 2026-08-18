# План: інкремент Б.3 — дискаверер v2 + чесність вимірювальних каналів

> Задача (скоуп, DoD, якорі): [`docs/tasks/redesign-discoverer-v2.md`](../../tasks/redesign-discoverer-v2.md).
> Базова гілка інкремента: `claude/redesign-increment-b3` (сесійна гілка
> виконавця мержиться PR-ом у неї — модель інкремента Б.2).
> Середовище: Docker/БД НЕ потрібні; браузерні тести — фікстурні
> (`page.setContent` / локальний HTTP-сервер фікстур, патерн
> `describe.skipIf` наявний). Ре-валідація проти живого референсу потребує
> мережі — якщо її немає, крок чесно відкладається (DoD це дозволяє).
>
> 🔴 Після КОЖНОЇ фази репо зелене: `format:check → lint → build →
> typecheck → test`. Повний ланцюг із `build:packages`/`test:packaging` —
> у фінальній фазі.

## Зафіксовані рішення (Р1–Р9)

- **Р1. Бали і форма evidence не змінюються** (+2 за сигнал,
  `score = evidence.length * 2`); нові сигнали — ДОДАТКОВІ записи evidence:
  `{ structural: 'prefix-fanout', count, source: 'structure' }`. Пороги —
  константи з коментарем-обґрунтуванням: fan-out ≥ 3 дітей; картки
  visit-probe ≥ 6.
- **Р2. Type-aware тайбрейк** — мінімальна правка компаратора
  (`classify.mjs:106-111`): компонент довжини стає
  `pair.type === 'product' ? -length : length`. Наявний конфлікт-тест
  (`design-import-discover.test.ts:105-126`) не має зламатись — перевірити
  ДО правки, що його кейс не спирається на довжину для product.
- **Р3. Fan-out — окремий чистий модуль `lib/classify-structure.mjs`**
  (канон 150 рядків; `classify.mjs` 132). Вхід — та сама
  `Map<pathname, {url, anchors}>`; вихід —
  `Map<pathname, { listing?: true, product?: true, childCount }>`.
  Лист = кандидат без власних дітей під fan-out-префіксом. Корінь `/`
  виключений. Детермінізм — жодних ітерацій, залежних від порядку вставки,
  у видимому результаті (сортування стабільні).
- **Р4. `schemaVersion` sitemap: 1 → 2.** Додається: `links:
  [{ pathname, anchors }]` (усі ≤200 після same-origin-фільтра — V-3),
  evidence-джерело `structure`, причина `visit-mismatch`. Споживач
  пропозиції — агент за скілом; скрипт `map-tokens` sitemap не читає, тож
  міграційного шлейфу немає. Тести, що асертять форму, оновлюються.
- **Р5. Visit-probe** — `lib/visit-probe.mjs`, чиста функція над
  результатом одного `page.evaluate`: `{ jsonLdTypes: string[],
  cardLinks: number }` (картка = `a[href]` з `img` нащадком, href глибший
  за поточний pathname). Правила невідповідності (консервативні, лише
  груба помилка): тип `product` І `cardLinks >= 6` І серед `jsonLdTypes`
  немає `Product` → mismatch; тип `listing` І серед `jsonLdTypes` є
  `Product` І `cardLinks < 3` → mismatch. Інтеграція: сигнатура
  інжектованої `visit(url)` розширюється до `visit(url, type)`;
  `sitemap.mjs` трактує mismatch як провал кандидата з причиною
  `visit-mismatch` (той самий шлях перепідбору, що `visit-failed`).
- **Р6. Reveal-корінь (V-5):** стратегія кандидатів — діти `<main>`;
  якщо `<main>` немає — `body > section` ПЛЮС онуки body (діти обгорток
  верхнього рівня), з дедуплікацією. У `motion.reveal` — поле обсягу
  вибірки (число семпльованих вузлів). `suspectJsDriven` при нульовій
  вибірці віддає **не** `false`: форма — за виконавцем (nullable поле або
  явний статус-рядок), вимога задачі — нуль вибірки відрізненний від
  «перевірено, не підозрюється» і в JSON, і в тесті.
- **Р7. Структурований `unmapped` (V-6+V-7):** записи
  `{ hex, count, contrastOnBackground, contrastOnCard, belowAA }` —
  дедуп, стабільне сортування за `count` ↓ потім hex. Рахується наявним
  `contrastRatio` з `lib/contrast.mjs` проти запропонованих
  `background`/`card`. `contrastWarnings` по змапованих парах —
  незмінний. `tokens-proposal.json` — це РОЗШИРЕННЯ форми: свій
  `schemaVersion` пропозиції бампнути, якщо він є; якщо ні — додати поле
  аддитивно і зафіксувати тестом.
- **Р8. Ре-валідація** — фінальний крок: один запуск `discover.mjs` проти
  живого референсу; очікування: `listing = /product` (structure/словник),
  `product = /product/omega-speedmaster` (глибина + patterns), `about`,
  `contact`, `home` — як у прогоні №2; `cart`/`checkout` —
  `no-candidate`. Резутат зберегти в нотатки гілки (тека артефактів поза
  git).
- **Р9. Жодних правок** `scripts/pilot-pack/`, `supabase/seed.sql`,
  контрактів тем; `themes/default/` цієї задачі не стосується.

---

## Фаза 1 — Словники + type-aware тайбрейк

- [ ] **Step 1:** `lib/classify-terms.mjs` — розширити `URL_PATTERNS` і
      `ANCHOR_TERMS` за блоком A.1 задачі (listing: category/categories/
      catalogue/product-category + bare-форми `products?|items?|tovary?`;
      product: product-page, `/p/<slug>`, термінальний `/p`, сімʼя
      `p<id>`; якорі en/uk/ru). Кожен доданий патерн — коментар-джерело
      (платформа).
- [ ] **Step 2:** type-aware тайбрейк у `classify.mjs` (Р2).
- [ ] **Step 3:** юніти в `tests/design-import-discover.test.ts`: bare
      `/product` → listing-кандидат; `/product/<slug>` → product; те саме
      для `tovary`/`tovar`; `p12345`-сегмент → product; конфліктний кейс
      deo (обидва URL, якір «Product») — правильна пара типів; негативний
      контроль тайбрейка (відкат Р2 → червоно).
- [ ] **Step 4:** гейти фази.

## Фаза 2 — Структурний fan-out + schemaVersion 2

- [ ] **Step 1:** новий `lib/classify-structure.mjs` (Р3) + юніти на
      чисту функцію (fan-out ≥3, листи, корінь виключено, стабільність).
- [ ] **Step 2:** інтеграція в `classifyLinks`: додаткові evidence для
      listing/product; юніт — deo-кейс класифікується правильно навіть із
      ВИРІЗАНИМИ словниковими термінами product/products (сила сигналу).
- [ ] **Step 3:** `sitemap.mjs`: `schemaVersion: 2`, поле `links` (V-3);
      оновити тести форми.
- [ ] **Step 4:** гейти фази.

## Фаза 3 — Visit-probe + фікстура deo-кейсу

- [ ] **Step 1:** `lib/visit-probe.mjs` (Р5) + юніти правил mismatch на
      обʼєктах-результатах (без браузера).
- [ ] **Step 2:** `discover.mjs` — виклик проба для listing/product після
      2xx; `sitemap.mjs` — обробка `visit-mismatch` (шлях перепідбору
      `visit-failed`); юніт із fake-visit: product-кандидат зі сторінкою-
      колекцією відхиляється, тип перепідбирається наступним кандидатом.
- [ ] **Step 3:** нова CLI-фікстура `tests/fixtures/design-import/
      site-singular/` — bare `/product` (колекція з ≥6 картками) +
      `/product/<slug>` (картка з Product JSON-LD) — прямий регрес живого
      кейсу; новий кейс у `design-import-discover-cli.test.ts`
      (skipIf-патерн наявний).
- [ ] **Step 4:** гейти фази.

## Фаза 4 — Чесність motion і unmapped (V-5, V-6, V-7)

- [ ] **Step 1:** reveal-корінь (Р6) у `lib/browser.mjs`; фікстура
      `motion.html` доповнюється варіантом без `<main>` (секції на рівень
      глибше) — тест: вузли знайдені; тест обсягу вибірки.
- [ ] **Step 2:** `suspectJsDriven`/`motion` — нуль вибірки → явне
      «невідомо» (Р6); тест відрізняє три стани: підозрюється / не
      підозрюється / невідомо.
- [ ] **Step 3:** структурований `unmapped` із контрастом (Р7) у
      `lib/color-tokens.mjs`/`lib/map.mjs`; тест-кейс `#6a7282` на
      `#f5f5f5` → `belowAA: true`; оновити наявні тести форми
      tokens-proposal.
- [ ] **Step 4:** гейти фази.

## Фаза 5 — Скіл/гайд, синк, фінальні гейти, ре-валідація

- [ ] **Step 1:** SKILL.md: фаза 1 — нові сигнали (structure,
      visit-mismatch, `links`, `schemaVersion: 2`); фаза 5 — чек-лист
      браузерної перевірки фільтрів (V-8: чиста сторінка на стан,
      очікування з БД, контрольний непорожній випадок); нотатка про
      політику артефактів у монорепо (V-1).
- [ ] **Step 2:** гайд `docs/guides/redesign-from-reference.md` і команда
      `.claude/commands/редизайн-за-референсом.md` — звірити.
- [ ] **Step 3:** `pnpm template:sync`; parity зелений.
- [ ] **Step 4:** фінальні гейти повним ланцюгом (+ `build:packages`,
      `test:packaging`).
- [ ] **Step 5:** ре-валідація проти живого референсу (Р8); результат — у
      нотатки; якщо мережі немає — чесно позначити відкладеним у задачі.
- [ ] **Step 6:** відмітки DoD у задачі + рядок Б.3 у роадмапі.

## Верифікація (для окремого верифікаційного воркфлоу)

1. Негативні контролі: відкат Р2 (тайбрейк) і вимкнення fan-out — червоні
   тести; повернення старого кореня reveal — червоний тест фікстури без
   `<main>`.
2. deo-кейс: фікстура site-singular класифікується правильно наскрізно
   (CLI-смок), і юніт доводить те саме без словникових термінів product.
3. Жодних змін поза скоупом: `scripts/pilot-pack/`, `supabase/seed.sql`,
   `packages/theme-system/`, `themes/default/`.
4. Форми `schemaVersion: 2` (sitemap) і розширеного tokens-proposal — під
   тестами; старі фікстури v1 не використовуються тестами як актуальні.
5. Скіл/гайд/команда/шаблон — узгоджені (parity + читання).
