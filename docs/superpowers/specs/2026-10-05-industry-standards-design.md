# Стандарти індустрії: інструменти, можливості стеку, React Compiler — дизайн

> **Статус:** брейншторм триває (2026-10-05). Затверджені власником: рамка (React 19),
> теми 1, 2, 3, 4 (хвиля 1; CSP — беклог), 5, 12, 13. Відкриті: 6, 7, 8, 9, 10, 11.
> Рішення дописуються в цей файл у міру закриття. Імплементаційного плану ще немає.
>
> **Попередній трек** (оновлення, безпека, тулінг, фундамент даних адмінки) —
> [`2026-10-04-deps-security-tooling-design.md`](./2026-10-04-deps-security-tooling-design.md);
> його незакриті пункти до К3-Е6а (санітизація HTML — тема 9 того треку) не дублюються тут.
>
> **Мірило — індустрія React/TypeScript/Vite (жовтень 2026), а не окремий референсний
> проєкт.** Три дослідження цієї сесії: (1) огляд стандартних інструментів екосистеми —
> завантаження npm, дати релізів, офіційні рекомендації; (2) наші самописні механізми проти
> вбудованих можливостей бібліотек, які ми вже використовуємо; (3) React Compiler — стан
> інструментів і пробний прогін компілятора по нашому коду. Ключові твердження перевірені
> по коду/документації; що не перевірено — позначено.

## Рамка

- **React 18 більше не підтримуємо:** peer `react`/`react-dom` → `^19` у ядрі й сателітах
  (рішення власника). Потрібно для React Compiler (`react/compiler-runtime` є лише в 19) і
  знімає гілку сумісності; шаблон магазину вже на `^19.3`.

## Огляд тем

| # | Тема | Шлях | Стан |
|---|---|---|---|
| 1 | `publint` + `attw` для опублікованих пакетів | точкова | ✅ |
| 2 | Renovate + аудит залежностей у CI | точкова | ✅ |
| 3 | Передзавантаження маршрутів + індикатор переходу | точкова | ✅ |
| 4 | Заголовки безпеки (хвиля 1); CSP — беклог | точкова | ✅ |
| 5 | Лінт із перевіркою типів | точкова | ✅ |
| 6 | TanStack Query + SSR-інтеграція Router | архітектурна | ⏳ |
| 7 | React Compiler | архітектурна | ⏳ |
| 8 | Тести: покриття, `user-event`, axe, E2E у CI | точкова | ⏳ |
| 9 | knip (звіт) | точкова | ⏳ |
| 10 | Дрібні заміни: `Auth.tsx` на RHF, `validateSearch` через zod, дати через i18n | точкова | ⏳ |
| 11 | `Cache-Control` анонімних SSR-сторінок, `srcSet` зображень | точкова | ⏳ |
| 12 | Помилки валідації serverFn адмінки → помилки полів форми | точкова | ✅ (до К3-Е6а) |
| 13 | TypeScript 5.9 → 6.0 | точкова | ✅ виконано (b973b8d1) |

---

## Тема 1 · publint + attw ✅

- **Не опції tsdown:** `.d.ts` емітить окремий `tsc` ПІСЛЯ tsdown (обхід TSDOWN-1), тож
  `attw` усередині tsdown бачив би пакет без типів і давав хибний результат.
- Новий крок у гейті `test:packaging` (по tarball-ах після `build:packages`): `publint` +
  `attw --pack` для всіх 5 публікованих пакетів (скаффолдер — теж, через `bin`).
- Профіль `attw` під ESM-only (`node16` + `bundler`; CJS не вимагаємо).
- Знахідки першого прогону виправляються в тій самій задачі; кожен `ignoreRules` — з причиною.
- CI: job `packaging`. Доказ: зламаний субшлях у `exports` → гейт червоніє.

## Тема 2 · Renovate + аудит у CI ✅

- **Renovate, не Dependabot:** версії шаблону живуть у `package.json.tpl`, і тест
  `tests/template-version-parity.test.ts` вимагає їх рівності з коренем; Dependabot `.tpl`
  не бачить — кожен його PR червонів би. Renovate — regex-менеджер для `.tpl` і пілотного
  оверлею: корінь/шаблон/оверлей одним PR.
- Групи: TanStack Start/Router; TanStack DB (3 пакети — точні звʼязки версій); tiptap; React;
  eslint + typescript-eslint; drizzle.
- Точні піни лишаються точними; `minimumReleaseAge` ≥ порогу pnpm; розклад щотижня;
  безпекові — одразу; мажорні — окремими PR; **автомержу немає** (реліз — рішення людини).
- Пакети із записами в `docs/architecture/upstream-workarounds.md` (TanStack, drizzle,
  better-auth, typescript-eslint, tsdown) — мітка + нотатка «перевір записи реєстру».
- CI: `pnpm audit --prod --audit-level=high` червонить; dev-вразливості — звітом (інакше
  вічний `esbuild` через `drizzle-kit` блокував би все).
- **Власник:** встановити GitHub-app Renovate на репозиторій.

## Тема 3 · Передзавантаження + індикатор переходу ✅

- Факти: `src/router.tsx` не задає `defaultPreload` (дефолт Router — `false`); лоадери вже
  мають `staleTime` (каркас вітрини 5 хв, головна/каталог/розділ — 60 с); індикатора
  переходу у вітрині немає; `cart`/`checkout` з `ssr: false` без `pendingComponent`.
- `defaultPreload: 'intent'` у `getRouter()` (host + шаблон); `defaultPreloadStaleTime`
  стандартний (30 с) — 0 лише разом із Query + SSR (тема 6). Ціна — додаткові запити до БД
  від наведень: замір у `live:smoke` (кількість викликів лоадера до/після).
- Компонент ядра `RouterProgress` (`useRouterState`): тонка смуга вгорі, стара сторінка
  лишається на екрані; поріг ~200 мс; монтується в каркасах вітрини й адмінки; колір —
  `--primary` (тема перефарбовує).
- `cart`/`checkout`: `pendingComponent` зі скелетоном — закриває борг роадмапу №12.
- Тести: смуга на повільному лоадері й без неї на швидкому; скелетон `cart`/`checkout` на
  першому рендері.

## Тема 4 · Заголовки безпеки ✅ (хвиля 1) · CSP → беклог

**Факти:** захисні заголовки є лише на роздачі медіа (`storage/serve.ts`); SSR-сторінки — без
жодного. Router вміє nonce на свої скрипти (`router-core` `ssr: { nonce }`,
`router.ts:544`; проставляється в `Scripts.tsx`, `hydrationScripts.ts`,
`renderRouterToStream.tsx`), але звʼязку «nonce з middleware → `getRouter()`» Start готовою
не дає. Статика `/assets` віддається sirv у `server.mjs` ПОВЗ Start.

**Хвиля 1 (зараз):**
- Функція ядра `buildSecurityHeaders(config, { isHttps, pathname })` у `simplycms/runtime` —
  ЄДИНЕ джерело; викликають request middleware (третій елемент `requestMiddleware` у трьох
  `start.ts`) і `setHeaders` sirv (`server.mjs` / `server-runtime.mjs`).
- Дефолти: `X-Content-Type-Options: nosniff`; `Referrer-Policy:
  strict-origin-when-cross-origin`; `Permissions-Policy: camera=(), microphone=(),
  geolocation=(), usb=(), serial=(), bluetooth=()` (`payment` не чіпати — Google Pay);
  `X-Frame-Options: DENY` для `/admin*` і `/auth*`, `SAMEORIGIN` для вітрини;
  `Cross-Origin-Opener-Policy: same-origin-allow-popups` (popup-и OAuth/3-D Secure);
  HSTS лише при довіреному `x-forwarded-proto=https`, `max-age=15552000`, без
  `includeSubDomains`/`preload` (HSTS незворотний на строк дії).
- Конфіг магазину: `simplycms.config.ts` → `security: { frameAncestors?, hsts?: false |
  { maxAge, includeSubDomains }, permissionsPolicy?, coop?, referrerPolicy? }`.
- Тести: юніти `buildSecurityHeaders` (HTTP/HTTPS, `/admin` vs вітрина, конфіг);
  інтеграційні — заголовки на SSR, редіректах, 404, server functions; sirv-статика має
  `nosniff`; `live:smoke` — заголовки на живій сторінці.

**CSP — беклог, окремий трек разом із механізмом інтеграції типових пікселів і аналітики
(рішення власника).** Передумови: санітизація HTML (попередній трек, тема 9); прибрати
інлайн-скрипт `src/routes/__root.tsx:97` (у data-атрибут/meta); канал для сторонніх скриптів
(продуктове рішення — зараз механізму немає взагалі). Нотатки з дослідження: nonce через
`ssr.nonce` + спайк звʼязки middleware → `getRouter()`; спершу Report-Only + ендпоінт
`/api/csp-report` (свідомий виняток у CSRF); декларації origin-ів у маніфестах тем/плагінів;
суворий режим — за вибором магазину; у dev CSP вимкнено (HMR); кеш HTML на CDN знецінює nonce.
Також памʼятати: вебхуки платіжних систем — свідомі винятки CSRF.

## Тема 5 · Лінт із перевіркою типів ✅

- Факт: `eslint.config.mjs:232` — лише `tseslint.configs.recommended` (без інформації про типи).
- Окремий блок `parserOptions.projectService` для коду ядра й host `src/`.
- Правила (error): `no-floating-promises`, `no-misused-promises`
  (`checksVoidReturn.attributes: false` — `onClick={async …}`), `await-thenable`,
  `@typescript-eslint/require-await`, `switch-exhaustiveness-check`.
- Норма лінту 0 errors / 8 warnings незмінна: усі знахідки виправляються в задачі, без
  ратчетів/винятків; >~150 — ділити по теках.
- Ціна — час лінту: замір до/після; ріст >2× → звузити зону до серверних тек.
- Негативний контроль: фікстура з незахопленим промісом у серверному файлі → червоніє.

## Тема 12 · Помилки валідації serverFn адмінки → помилки полів ✅ (до К3-Е6а)

- Знахідка ручного прогону плану фундаменту даних: помилка Zod у serverFn адмінки
  показується сирим JSON у загальному тості, без помилки поля (борг роадмапу №15; якорі
  `StockEditor.tsx:65-67`, `PricesEditor.tsx:69`, `ModificationsTable.tsx:75`).
- Того ж класу: `numeric`-колонки в `columnsToZod` — лише `z.string()` без формату/scale
  (як було в drizzle-zod), тож `'abc'` дає 500 від БД (22P02) замість 400; виправляти разом
  (формат десяткового числа з precision/scale колонки + свідоме оновлення гейту паритету —
  навмисне розходження з оракулом).
- Рішення власника: **ДО К3-Е6а** (нові форми Е6а одразу з правильними помилками).
- Напрям: серверна помилка валідації → типізована доменна помилка з issues (path →
  message/i18n-ключ) через той самий межовий механізм, що `domainErrorAdapter` /
  `AdminConflictError`; на клієнті — `setError` по полях react-hook-form; загальний тост —
  лише для помилок без поля. Короткий дизайн — перед реалізацією.

## Тема 13 · TypeScript 5.9 → 6.0 ✅ (виконано, `b973b8d1`)

- TS 7 заблокований лише `typescript-eslint` (peer `<6.1.0`, запис TSESL-1); 6.0.x допустимий.
- **Спайк (2026-10-05):** чиста міграція на 6.0.3 — бамп у 5 місцях (корінь, `apps/www`,
  `tools/content-loader-mcp`, пілотний оверлей, шаблон) + прибрати `"baseUrl": "."` у трьох
  `tsconfig` (`paths` уже відносні). **Без `ignoreDeprecations`.** Нуль правок коду. Усі
  гейти зелені (включно з `test:schema`, packaging, pilot, `build:www`), лінт 0/8 без
  попереджень typescript-eslint. `.d.ts` від TS 6 **байт у байт** ідентичні TS 5.9 (750
  файлів) — магазин на TS 5.9 компілюється проти нашого `dist`. Перешкоди спроби
  2026-08-04 (TS5101, TS2209) не відтворюються.
- Бонус: TS 7.0.2 перевіряє наш код без помилок (4,8 с проти 16,5 с); `.d.ts` від 7 —
  лише порядок членів union/ключів (`--stableTypeOrdering` — на майбутнє).
- Доки: «TS 6.0; TS 7 блокує лише typescript-eslint» — `AGENTS.md`, `TOOLING.md`, TSESL-1.
- `tools/content-loader-mcp` (поза workspace, борг №13): під TS 6 потребує
  `"types": ["node"]`, якщо його відроджувати.

---

## Відкриті теми (вихідні факти)

### Тема 6 · TanStack Query + SSR-інтеграція Router ⏳ (архітектурна)
- Зараз: лоадер → props → `useQuery({ initialData })` (напр. `pages/Home.tsx:47`,
  `Properties.tsx:31`); `queryOptions`/`useSuspenseQuery` — 0 використань;
  `@tanstack/react-router-ssr-query` не встановлено.
- Стандарт: `setupRouterSsrQueryIntegration({ router, queryClient })`, у лоадері
  `ensureQueryData(queryOptions)`, у компоненті `useSuspenseQuery`; інтеграція
  дегідрує/гідрує/стрімить.
- Імовірна вада нашого патерну (гіпотеза, прогоном не перевірено): `initialData` діє лише при
  створенні запису — свіжі дані лоадера не потрапляють у наявний запис (два джерела правди).
- Сумісність: реєстр `entityKey` і контракт тем (view — чиста функція від vm) зберігаються.
- Запропоновано: пілот на головній (SSR-HTML без повторного запиту після гідрації), потім
  решта сторінок. Відкрите питання власнику: пілот одразу чи спершу глибше дослідження
  наслідків.

### Тема 7 · React Compiler ⏳ (архітектурна)
- Пробний прогін (babel-plugin-react-compiler 1.0.0, `panicThreshold: 'none'`): ядро — 502
  функції скомпільовано, 31 пропущено (94 %); теми, сателіти, host, шаблон — 0 пропусків.
  Порушень правил React немає (`eslint-plugin-react-hooks` 7.1.1, лінт 0 errors). Причини
  пропусків: `try/finally` (14), `try` без `catch` (5), `throw` у `try/catch` (3),
  збереження ручної мемоізації (2), інше.
- Ручної мемоізації мало: ~45 `useMemo` + ~29 `useCallback`, `memo()` — 0.
- **Компілювати треба на НАШІЙ збірці пакета:** Vite магазину не обробляє `node_modules`
  (`defaultExcludeRE`). Доведено в спайку: tsdown 0.23 + `@rolldown/plugin-babel` +
  `reactCompilerPreset` — збірка працює, бандл +5,5 % raw / +2,7 % gzip, вивід імпортує
  `react/compiler-runtime` (target 19). `reactCompilerPreset` у plugin-react діє лише на
  клієнтський споживач — SSR не компілюється (вітрину не прискорить).
- Досвід MetaHub (не мірило, але корисні пастки): заміряного прискорення UI немає («Перф не
  є аргументом», `DEPENDENCY_MONITORING.md`); тихі пропуски, замерзання похідного від
  стабільного інстансу (`useForm`, `useReactTable`), хук як значення → прод-падіння;
  гейт `memo-gate` (сума слотів `_c(N)` до/після).
- Попередня рекомендація: Profiler-замір адмінки → компіляція на збірці пакета в режимі
  `annotation` на гарячих компонентах → гейти; для магазину — лише опція в шаблоні.

### Тема 8 · Тести ⏳
- `@testing-library/user-event` — 0 використань (`fireEvent` у ~27 тестах); покриття не
  міряється; a11y-тестів немає (`vitest-axe` мертвий з 2022 — брати `axe-core` напряму або
  `@axe-core/playwright`; вхід — фікстури `simplycms/contracts/views/fixtures`); E2E у CI
  немає (`live:smoke` — лише локально).

### Тема 9 · knip ⏳
- Мертвий код/залежності; спершу режим звіту; звірити перетин із `scripts/audit-deps*`.

### Тема 10 · Дрібні заміни ⏳
- `storefront-routes/pages/Auth.tsx` (508 рядків): ручний стан форми поверх zod → RHF +
  `zodResolver` (як у 13 інших формах).
- `validateSearch` руками в 4 роутах → zod (Router приймає Standard Schema напряму; потрібен
  `.catch` для мовчазного відкидання некоректних значень).
- Захардкоджена `uk`-локаль дат в адмінці (`date-fns` з `uk`, `toLocaleDateString('uk-UA')`)
  → локаль з i18n.

### Тема 11 · Кешування й зображення ⏳
- `Cache-Control` лише на `/media` і SEO; для анонімних SSR-сторінок без `Set-Cookie` —
  кандидат (ризик віддати чужий кошик — лише анонімні).
- Зображення без `srcSet`/`sizes` (8 місць) — потребує серверного ресайзу.

## Свідомо НЕ беремо (з обґрунтуванням)

changesets (наш `pnpm release` з гейтами й синхронною версією 5 пакетів кращий); syncpack
(не читає `.tpl` — наш тест паритету потрібен); `nuqs` (є search params Router); `dinero.js`
(цілі центи вже є); `@total-typescript/ts-reset` (глобально змінює типи — ризик для
опублікованого фреймворку); `vitest-axe` (мертвий); окреме стиснення (sirv уже віддає
gzip+brotli); Storybook (без окремого рішення про каталог компонентів); Rust-порт React
Compiler (`compiler: true` — експериментальний); `t3-env` (контракт env уже стережеться).

## Лишаємо своє (обґрунтовано)

`server.mjs` + `server-runtime.mjs` (пріоритет env, `immutable` для `/assets`, `signal` для
скасування SSR); читання `.env` через `node:util.parseEnv`; `formatPrice` (символ валюти
різний у Node і браузері → гідраційний мисматч); i18n (`translator.ts`, три рівні
каталогів; вада — немає форм множини); реєстри тем/плагінів (контракти платформи); TTL-кеш
теми (серверний кеш між запитами зі скиданням з адмінки); PG-харнес (поведінкова матриця
RLS); реліз-скрипти; тест паритету версій; debounce у двох місцях.
