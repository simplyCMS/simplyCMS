# Змінні оточення й запуск

Два контури env і продакшн-запуск. Команди — `docs/development/TOOLING.md`.

## 1. Змінні оточення

🔴 **Контракт магазину — рівно ТРИ ключі.** Copy `.env.example` to `.env.local`; клієнту видно лише
ті, що з префіксом `VITE_`:

- `DATABASE_URL` — **серверний**: пряме підключення до Postgres, з нього живе пул `simplycms/db`.
  Логін роллю `app_runtime` (вона без прямих грантів, тож забутий `SET LOCAL ROLE` падає, а не
  мовчки обходить RLS). Той самий URL — джерело тулінгу (`db:pull`/`db:diff`)
- `BETTER_AUTH_SECRET` — **серверний**: підпис сесій Better Auth (`simplycms/auth`). `VITE_`-префікса
  бути не може — секрет у клієнтському бандлі не секрет. Опційний сусід — `BETTER_AUTH_URL` (без
  нього базовий URL береться із самого запиту — у dev це очікуваний WARN; у проді рекомендований: з
  рядковим baseURL Better Auth довіряє рівно цьому origin і відкидає інші з 403 `INVALID_ORIGIN`).
  Контракт стереже `tests/env-contract.test.ts`
- `VITE_SITE_URL` — публічний URL сайту (sitemap.xml, robots.txt, `getStorefrontRoot` → `siteUrl`
  для canonical і JSON-LD вітрини; невалідна адреса там стає порожньою з одним `console.warn`);
  запікається при `vite build`,
  тож зміна вимагає перезбірки

- 🔴 `MEDIA_ROOT` — опційний серверний ключ, а не четвертий у контракті: корінь драйвера
  `local-fs`, дефолт `./.data/media` відносно робочої теки процесу. У проді його задають на
  змонтований том, бо дефолт лежить усередині теки деплою й після нового деплою сховище було б
  порожнім. У `.env.example` і в шаблоні магазину ключ лежить **закоментованим** (як
  `BETTER_AUTH_URL`) — `tests/env-contract.test.ts` рахує активні рядки, розкоментований
  `MEDIA_ROOT` зробив би гейт червоним.
- Поза контрактом магазину — dev-ключ `PG_HARNESS_URL`: готовий Postgres для `pnpm test:schema` (без
  нього харнес підіймає ефемерний кластер сам) і для `pnpm db:demo` (альтернатива — прапорець
  `--url`; `DATABASE_URL` цим двом не джерело, бо обидва СТВОРЮЮТЬ базу в кластері).
- Інших ключів, зокрема `VITE_SUPABASE_*`, магазин не потребує й ядро їх не читає: клієнтського
  шару БД немає (знесено в К3-Е7), адмінка працює на `admin-server`.

🔴 **Контурів env два, джерела в них різні.** Клієнтський бандл читає `import.meta.env` — значення
запікаються при `vite build`. Серверний код (SSR, server fns, middleware, SEO) читає **лише**
`process.env` і лише в рантаймі; `.env`/`.env.local` — не джерело, а спосіб його наповнення (див.
§ «Запуск у проді»). `VITE_`-префікс означає «видно клієнту», а не «лише клієнт»: той самий
`VITE_SITE_URL` сервер бере з `process.env` (`seo/robots`, `seo/sitemap`, `getStorefrontRoot`). Дуального резолву немає —
відсутній ключ гучно падає. Контракт стережеться машинно, і саме так, бо інакше не можна: у vitest
`import.meta.env` — Proxy над `process.env` (один обʼєкт), тож ТЕСТ довести джерело env не здатен.
Доводять: eslint `no-restricted-syntax` на `import.meta.env` у п'яти серверних модулях (`SERVER_ENV_FILES` в `eslint.config.mjs`; див. `docs/development/TOOLING.md` § «Лінт»,
негативний контроль — `tests/eslint-server-env.test.ts`) і Gate C пілота (`SERVER_PAYLOAD` будується з `SERVER_ONLY` —
`simplycms/contracts/server-only` — плюс серверні залежності; контроль — `tests/pilot-gate-c.test.ts`).

🔴 `VITE_LOCALE` — опційний клієнтський перемикач локалі збірки (`simplycms.config.ts`:
`locale: import.meta.env.VITE_LOCALE ?? 'uk-UA'`; е2е-обгортка приймає `uk-UA` або `en-US`).
Запікається при `vite build`, не є частиною контракту з трьох ключів.

## 2. Запуск у проді

`pnpm build` віддає **два** каталоги: `dist/client/` (статика з хешованими іменами) і
`dist/server/server.js` — **fetch-handler** (`{ fetch(Request) → Response }`), а не готовий
HTTP-сервер. Теки `.output/` немає.

- `src/server.ts` — server entry (`server: { entry: './server.ts' }` у `vite.config.ts`). 🔴 Шлях
  резолвиться від `srcDirectory` (`src/`), **не** від кореня: `'./src/server.ts'` мовчки не
  знайдеться і плагін відкотиться на дефолтний entry. Тут же — точка перехоплення запиту перед
  делегацією в роутер.
- `server.mjs` (корінь) — Node-runner: `sirv(dist/client)` для статики (`/assets/*` →
  `max-age=31536000, immutable`), решта — `IncomingMessage → Request → fetch-handler →
  ServerResponse` зі стрімінгом в обидва боки (`Readable.toWeb` / `Readable.fromWeb`), тому
  SSR-стрімінг Start не ламається.
- `pnpm start` = `node server.mjs`; порт — `PORT` (за замовчуванням `3000`), інтерфейс — `HOST`
  (за замовчуванням `0.0.0.0`).

🔴 **Стеля тіла запиту (К3-Е6д-2).** Request-міддлвара `bodyLimitMiddleware` відхиляє POST на
`/_serverFn/` із `Content-Length` понад `MAX_REQUEST_BODY_BYTES` (`domain/media.ts`, ≈ 26 МБ: 5 фото
відгуку по 5 МБ + 1 МБ службових байтів) відповіддю 413, а POST без `Content-Length` — 411 для всього, що не JSON, і для всього, що Start читає як форму
(`application/json; x=multipart/form-data` теж; chunked чистий JSON — відкрите вікно: Start буферизує `request.json()` повністю, ризик свідомо прийнято архітектором).
Перевірка йде за заголовком, тож спирається на Node-раннер (`server.mjs`), що обмежує тіло заявленою
довжиною (`UPSTREAM:START-BODY-1`). Проксі перед магазином (nginx `client_max_body_size`, Traefik
`maxRequestBodyBytes`) має пропускати принаймні цю стелю і НЕ перетворювати тіло на chunked без
`Content-Length`, інакше завантаження файлів отримає 411. Інший рантайм (не `server.mjs`) — переглянути. 413 віддається до читання тіла: стеля захищає від
прямих викликів повз UI, а браузер, що ще вантажить понад стелю, може побачити обрив зʼєднання
замість 413 (штатний UI відсікає завеликі файли до відправки).

**Deploy:** на прод кладуться `dist/`, `server.mjs`, `package.json` + production-`node_modules`
(потрібен рівно один рантайм-пакет — `sirv`, він у `dependencies`). `VITE_*` для КЛІЄНТСЬКОГО
бандла запікаються на етапі `vite build`, тож збірку робить той самий env, що й прод.

🔴 **Контракт серверного env:** серверний контур читає **лише** `process.env` і лише в рантаймі
(усередині фабрик/хендлерів, не на модуль-рівні). `server.mjs` перед динамічним імпортом хендлера
наповнює `process.env` із `.env.local`/`.env` — лише відсутні ключі, тож реальний env процесу завжди
виграє (`process.env` > `.env.local` > `.env`); у dev те саме робить `loadEnv` у `vite.config.ts`.
Наслідок: ротація `DATABASE_URL`/`BETTER_AUTH_SECRET` = перезапуск процесу, БЕЗ перезбірки; для
клієнтського `VITE_SITE_URL` потрібна перезбірка.
