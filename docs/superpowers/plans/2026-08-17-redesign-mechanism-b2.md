# План: інкремент Б.2 — шліфування механізму клонування дизайну

> Задача (джерело скоупу і DoD): [`docs/tasks/redesign-mechanism-b2.md`](../../tasks/redesign-mechanism-b2.md).
> Гілка виконання: `claude/redesign-increment-b2`.
> Середовище: Docker/жива БД НЕ потрібні (виняток — реальний дамп у Фазі 4,
> див. Р8: чесна деградація). Фікстурні браузерні тести — за наявним
> патерном `describe.skipIf` по launch-probe Playwright.
>
> 🔴 Після КОЖНОЇ фази репо зелене за канонічним порядком гейтів:
> `format:check → lint → build → typecheck → test`
> (build перед typecheck — генерує `src/routeTree.gen.ts`; гейт саме
> `format:check`; обидві команди покривають увесь репозиторій, виключення —
> `.prettierignore`). `build:packages`/`test:packaging` — у фінальній фазі
> (пакети ядра цей план не чіпає, але фінальна звірка обовʼязкова).

## Зафіксовані рішення (Р1–Р10)

- **Р1. Форма `motion` в `inspection.json`.** Нова верхньорівнева секція:
  `motion: { transitions, keyframes, reveal, jsLibraries, hover? }`.
  Точні поля — за виконавцем у цих межах: `transitions` — кластери
  (property, durationMs, easing, count) із стабільним сортуванням;
  `keyframes` — імена з same-origin stylesheet-ів + чесний лічильник
  `inaccessibleSheets` (cross-origin НЕ мовчазний дроп); `reveal` —
  прапорці анімованих при скролі секцій верхнього рівня; `jsLibraries` —
  `{ detected: string[], markers: string[] }`.
- **Р2. `schemaVersion` інспекції: 1 → 2.** `map-tokens.mjs` приймає
  обидві версії (motion він не споживає — токени теми НЕ розширюються,
  рішення власника). Тести, що асертять `schemaVersion`, оновлюються.
- **Р3. `merge.mjs` секцію `motion` НЕ зливає** — вона пер-сторінкова за
  природою (спеки компонентів читають per-page `inspection.json`).
  У зведеному виводі `motion` відсутній свідомо; це фіксується тестом
  (зведення N>1 не містить ключа `motion`).
- **Р4. Reveal-дифи** — усередині наявного `scrollThrough()`
  (`lib/browser.mjs`): снапшоти `opacity`/`transform` дітей `main`
  (fallback — top-level `section`) до/після кроків скролу; «анімована» =
  зміна opacity ≥ 0.2 або поява/зміна transform.
- **Р5. Hover-sweep** — детерміністичний Playwright `hover()` по
  обмеженому списку (`header a`, `nav a`, `button`, `[role="button"]`,
  видимі; ліміт ~20 елементів), фіксується дельта computed
  (`background-color`, `color`, `border-color`, `box-shadow`,
  `transform`) — лише значущі дельти. Живе в `motion.hover`.
- **Р6. JS-детект** — сигнатури GSAP / Framer Motion / Lottie / anime.js
  (script src + window-глобали + data-атрибути); плюс евристичний
  прапорець «reveal є, а CSS-механізму не видно» → motion керується JS.
- **Р7. Шрифт-евристика** — вада в семплері, не в merge: `topFont` у
  `lib/browser-sample.mjs` рахує ЧАСТОТУ елементів, тож span-мітки
  переважують body-текст. Вага стає сумою довжин `textContent` по сімʼї
  (ліміт на вузол, щоб один довгий блок не монополізував); частота —
  tie-break. `voteFontConsensus` у merge не міняється.
- **Р8. Demo-датасет** — `scripts/dev-stand/`: `dump-demo-data.mjs`
  (підключення `pg` через `DATABASE_URL` із env — session pooler; читає
  ЛИШЕ каталожні таблиці — та сама множина, що в `supabase/seed.sql`,
  плюс зображення; санітизація за allowlist-ом колонок) → генерує
  `scripts/dev-stand/seed-demo.sql`. 🔴 Згенерований SQL —
  **gitignored** (чужі каталожні дані не комітяться в OSS-репо);
  комітяться скрипт, фікстурний семпл для тесту і README. Ідемпотентність
  — `on conflict do update` по slug/унікальних ключах. Без `DATABASE_URL`
  скрипт гучно падає з інструкцією — це і є чесна деградація задачі.
- **Р9. `findStoreRoot`** (`packages/cli/src/context.mjs`) — визнає
  корінь МОНОРЕПО валідним store root: маркер `pnpm-workspace.yaml` +
  `simplycms.config.ts` у тому самому каталозі. Скаффолди йдуть у
  `themes/`/`plugins/` кореня. Поведінка в справжньому магазині — без
  змін (наявні cli-юніти лишаються зеленими як регрес-гард).
- **Р10. Нумерація фаз скіла:** side-by-side лишається фазою 5
  (розширюється), «Шліфування» — нова ОПЦІЙНА фаза 6. Драбина рішень
  фази 6 — токен → setting → кастомна сторінка → прийняти канон;
  щабель «view теми» — позначка-місце під трек A (не описувати як
  наявний). Текст скіла правиться ОСТАННІМ (Фаза 5 плану), коли всі
  можливості вже в коді.

---

## Фаза 1 — Motion-капчер: transitions, keyframes, reveal, JS-детект

- [x] **Step 1:** `lib/browser-sample.mjs` — у наявному
      `page.evaluate`-семплінгу додатково зняти computed
      `transition-property/duration/timing-function` семплованих елементів
      і зібрати сирі записи для кластеризації (property → duration/easing
      → count).
- [x] **Step 2:** там само (або окремим evaluate у
      `lib/inspect-page.mjs`) — обхід `document.styleSheets` через CSSOM:
      імена `@keyframes` same-origin; cross-origin аркуші рахувати в
      `inaccessibleSheets` (try/catch на `cssRules`).
- [x] **Step 3:** `lib/browser.mjs` `scrollThrough()` — снапшоти
      `opacity`/`transform` секцій верхнього рівня до/після кроків
      (Р4), результат повертається нагору в `inspect-page`.
- [x] **Step 4:** JS-детект (Р6) — окрема чиста функція
      `lib/motion-detect.mjs` (сигнатури по script src + глобалах) +
      виклик з `inspect-page`; юніти на чистій функції.
- [x] **Step 5:** зібрати все в секцію `motion` `inspection.json`,
      `schemaVersion: 2` (Р1/Р2); `map-tokens.mjs` приймає 1 і 2;
      `merge.mjs` — тест «зведення не містить motion» (Р3).
- [x] **Step 6:** фікстура `tests/fixtures/design-import/motion.html`
      (CSS transitions + @keyframes + reveal через inline-скрипт
      IntersectionObserver + підключений фейковий «gsap»-скрипт) +
      тести `tests/design-import-inspect.test.ts` на всі чотири канали;
      стабільність сортувань — прогін двічі, глибока рівність.
- [x] **Step 7:** гейти фази: `format:check → lint → build → typecheck →
      test`.

## Фаза 2 — Hover-sweep

- [x] **Step 1:** `lib/inspect-page.mjs` — hover-прохід (Р5): відбір
      видимих елементів за селекторами, ліміт, `hover()` → пауза →
      дельта computed; повернення `motion.hover` (лише значущі дельти,
      стабільне сортування за селектором+індексом).
- [x] **Step 2:** розширити фікстуру motion.html hover-стилями
      (`:hover` на кнопці й лінку) + тести: дельта є там, де є
      `:hover`-правило, і відсутня де немає.
- [x] **Step 3:** SKILL.md НЕ чіпати (це Фаза 5 плану); але перевірити,
      що `inspect.mjs --help`/повідомлення CLI згадують нові дані
      коректно, якщо такий вивід існує.
- [x] **Step 4:** гейти фази.

## Фаза 3 — Беклог лайв-тесту: шрифт-вага і findStoreRoot

- [x] **Step 1:** `lib/browser-sample.mjs` — вага шрифт-сімʼї за
      `textContent` (Р7); tie-break — стара частота.
- [x] **Step 2:** тест-кейс лайв-тесту: фікстурна сторінка, де
      span-мітки в моно чисельніші за body-вузли, а body-текст довший —
      `fonts.body` = body-сімʼя (до фікса тест червоний — перевірити
      відкатом).
- [x] **Step 3:** `packages/cli/src/context.mjs` `findStoreRoot` —
      маркер монорепо (Р9); `create theme`/`create plugin` скаффолдять у
      корінь монорепо.
- [x] **Step 4:** юніти: новий кейс у `tests/cli-create-theme.test.ts`
      (тимчасова тека з `pnpm-workspace.yaml` + `simplycms.config.ts`);
      наявні cli-юніти (справжній магазин) — без змін, зелені.
- [x] **Step 5:** гейти фази.

## Фаза 4 — Demo-датасет діагностичного стенда

- [x] **Step 1:** звірити множину каталожних таблиць із
      `supabase/seed.sql` (products / sections / властивості / ціни +
      зображення) — зафіксувати allowlist таблиць і колонок у коді
      дампера (Р8), санітизація за allowlist-ом (жодних users/orders).
- [x] **Step 2:** `scripts/dev-stand/dump-demo-data.mjs` — `pg` по
      `DATABASE_URL`, генерація ідемпотентного `seed-demo.sql`
      (on conflict do update); без `DATABASE_URL` — гучне падіння з
      інструкцією. `.gitignore`: `scripts/dev-stand/seed-demo.sql`.
- [x] **Step 3:** генерацію SQL винести в чисту функцію
      (рядки-фікстури → SQL) + тест на фікстурному семплі
      (`scripts/dev-stand/fixtures/…` або `tests/fixtures/`):
      санітизація, ідемпотентна форма, екранування.
- [x] **Step 4:** `scripts/dev-stand/README.md` — як зняти дамп і
      накотити на локальний стек ПОВЕРХ сіду пілота (psql на порт стенда);
      🔴 явно: `supabase/seed.sql` і `scripts/pilot-pack/` не чіпаються,
      стенд до клауд-БД напряму не підключається.
- [x] **Step 5:** гейти фази.

## Фаза 5 — Скіл: фаза 5 side-by-side, нова фаза 6 «Шліфування», Motion у спеках

- [x] **Step 1:** `SKILL.md` фаза 5 — обовʼязковий side-by-side по
      КОЖНОМУ підтвердженому типу зі `sitemap-proposal.json`
      (`_ours/<pageType>/`), класифікація кожної розбіжності
      (токен-фіксабельна / дані / структурна-за-дизайном), підсумкова
      таблиця «тип → розбіжність → клас → рішення»; заборона
      продовжувати без пари (виняток — тип, свідомо пропущений
      користувачем на фазі 1.2).
- [x] **Step 2:** `SKILL.md` фаза 4 — у дисципліни спека-файлів додати
      обовʼязкову секцію **Motion** (з виміряних `motion`-даних
      інспекції: тривалості/easing-и, reveal, hover; «JS-driven —
      дивись очима» як чесна межа).
- [x] **Step 3:** `SKILL.md` нова фаза 6 «Шліфування» (опційна, Р10) +
      оновити «Межі v1»/«Чесну деградацію», якщо зачеплені.
- [x] **Step 4:** звірити гайд
      `docs/guides/redesign-from-reference.md` і команду
      `.claude/commands/редизайн-за-референсом.md` з новим текстом скіла.
- [x] **Step 5:** `pnpm template:sync` (скіл їде в шаблон копією) —
      parity-тести зелені.
- [x] **Step 6:** фінальні гейти ПОВНИМ ланцюгом:
      `format:check → lint → build → typecheck → test →
      build:packages → test:packaging`.
- [x] **Step 7:** відмітити DoD у задачі
      (`docs/tasks/redesign-mechanism-b2.md`) і рядок інкремента Б.2 у
      роадмапі (виконані пункти; «фінальна валідація прогоном» лишається
      відкритою — вона поза задачею).

## Верифікація плану (для окремого верифікаційного воркфлоу)

1. Негативні контролі: Р7-тест червоніє на відкаті фікса семплера;
   монорепо-кейс `findStoreRoot` червоніє на відкаті Р9.
2. `merge` N=1 — байт-сумісність із одиночним входом зберігається
   (наявний early-return тест зелений).
3. `schemaVersion: 2` не ламає `map-tokens` на старих фікстурах v1.
4. Жодних змін у `supabase/seed.sql`, `scripts/pilot-pack/`,
   `packages/theme-system/` (токени не розширені).
5. Скіл/гайд/команда/шаблон — узгоджені (парність-тест + читання).
