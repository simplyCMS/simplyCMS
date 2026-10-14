# Змінні оточення й запуск

Два контури env і продакшн-запуск. Команди — `docs/development/TOOLING.md`.

## 1. Змінні оточення

🔴 **Обовʼязкових ключів магазину — рівно ТРИ.** Опційні йдуть групами драйверів (нижче). Copy `.env.example` to `.env.local`; клієнту видно лише
ті, що з префіксом `VITE_`:

- `DATABASE_URL` — **серверний**: пряме підключення до Postgres, з нього живе пул `simplycms/db`.
  Логін роллю `app_runtime` (вона без прямих грантів, тож забутий `SET LOCAL ROLE` падає, а не
  мовчки обходить RLS). Той самий URL — джерело тулінгу (`db:pull`/`db:diff`).
  🔴 Пароль `app_runtime` у цьому URL — лише друкований ASCII (пробіл і `0x21–0x7E`; спецсимволи
  URL percent-кодуються): накат (`simplycms/migrate`) ставить його ролі як верифікатор SCRAM-SHA-256,
  порахований на клієнті (відкритий пароль на сервер не йде — інакше він ліг би в лог Postgres).
  Для інших символів libpq і node-postgres нормалізують пароль по-різному (SASLprep), тому такий
  пароль накат відкидає з поясненням, не друкуючи значення
- `BETTER_AUTH_SECRET` — **серверний**: підпис сесій Better Auth (`simplycms/auth`). `VITE_`-префікса
  бути не може — секрет у клієнтському бандлі не секрет. Опційний сусід — `BETTER_AUTH_URL` (без
  нього базовий URL береться із самого запиту — у dev це очікуваний WARN; у проді рекомендований: з
  рядковим baseURL Better Auth довіряє рівно цьому origin і відкидає інші з 403 `INVALID_ORIGIN`).
  Контракт стереже `tests/env-contract.test.ts`
- 🔴 `pg` — не змінна, а **залежність магазину** (К3-Е7): драйвер БД оголошено peer-ом ядра, а
  `package.json` магазину декларує його прямою залежністю тієї ж точної версії
  (`tests/pg-peer-parity.test.ts`). Без цього Vite вклеює транзитивний `pg` у серверний бандл, і
  магазин не стартує (`UPSTREAM:START-IP-1`); `simplycms doctor` (№13) стежить за декларацією.
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
- Поза обовʼязковими — dev-ключ `PG_HARNESS_URL`: готовий Postgres для `pnpm test:schema` (без
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
Запікається при `vite build`, не є частиною контракту з трьох ключів. Те саме значення задає мову листів: `pnpm owner:invite` читає `VITE_LOCALE` (невалідне — попередження й `uk`), а сервер отримує локаль від host-а (`declareStoreLocale` у `src/server.ts`).

🔴 `VITE_SITE_URL` — ORIGIN сайту: шлях і кінцевий слеш ігноруються. Від нього будуються і посилання в листах (`siteUrl` з `simplycms/env`), і база Better Auth (`BETTER_AUTH_URL` — лише явний override; без обох ключів `createAuth` падає, бо інакше BA брав би базу із запиту).

### Групи драйверів

🔴 Опційні ключі драйверів сховища й пошти йдуть **групами за правилом «все або нічого»**: група
або задана повністю, або не задана зовсім. Часткова група — помилка старту (`DriverEnvError`), що
називає відсутні ключі й не містить жодного значення; мовчазного фолбеку на `local-fs`/`log` немає.
Порожній рядок (`KEY=`, так зберігає Dokploy) вважається незаданим ключем. Правило вміщує одна чиста
функція `resolveDriverEnv(env)` в `simplycms/env` (server-only): оточення їй передає викликач
(`scripts/start.mjs`, серверний бандл на верхньому рівні `src/server.ts`, фабрики драйверів, `doctor`,
`status`), друкує теж він. `server.mjs` ядра не імпортує: помилку з `code: 'SIMPLYCMS_DRIVER_ENV'` він ловить
під час імпорту бандла й виходить з кодом 1 до listen. Попередження «пошта не налаштована» друкує лише
бандл, один раз, у прод-рантаймі (предикат `isProductionRuntime(env)` з `simplycms/env`). Власнику `NODE_ENV` задавати не треба: `server.mjs` безумовно ставить `NODE_ENV=production` перед імпортом бандла (інше значення ігнорується з одним рядком у лозі), тож прод-режим не залежить від оточення платформи деплою.

| Група | Ключі | Драйвер, якщо задана повністю | Якщо не задана |
|---|---|---|---|
| S3 | `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY` | сховище `s3` (`S3_ENDPOINT` без хвостових `/`) | `local-fs`, корінь — `MEDIA_ROOT` |
| SMTP | `SMTP_URL`, `MAIL_FROM` | пошта `smtp` | пошта `log` |

`MEDIA_ROOT` разом з повною групою S3 не помилка: драйвер `s3`, а `warnings` резолвера несе рівно
одне попередження, що `MEDIA_ROOT` проігноровано. Також опційний `MIGRATION_DATABASE_URL` —
зʼєднання власника БД, яке бачать лише `simplycms db:apply` і `scripts/start.mjs`. Ключі груп закоментовані в обох `env.example`; парність їх множин і
контракт активних ключів стереже `tests/env-contract.test.ts`.

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
- `pnpm start` = `node server.mjs` — лише локальний запуск зібраного бандла, **не для проду**
  (без накату міграцій і без `execve`). У проді стартова команда платформи — рівно
  `node scripts/start.mjs` (шим під `simplycms update`, логіка — `simplycms/prod-start`; скрипта `start:prod` немає, `pnpm` у контейнері не потрібен): спершу накат міграцій (`simplycms/migrate`) під
  `MIGRATION_DATABASE_URL` (пароль власника схеми; не задано — накат пропущено), далі
  `process.execve` підміняє процес на `server.mjs` БЕЗ цієї змінної (потрібен Node ≥ 24).
  🔴 `start.mjs` читає лише `process.env` і `.env*` не читає (у проді env дає Dokploy); локальний
  накат — `pnpm simplycms db:apply`, який `.env.local` читає. `server.mjs` теж не підтягує
  `MIGRATION_DATABASE_URL` з `.env*`. Часткова група `S3_*`/`SMTP_*` валить `start.mjs` до
  накату, а `server.mjs` — до слухання порту (`simplycms/env`). Порт — `PORT` (за замовчуванням `3000`), інтерфейс — `HOST`
  (за замовчуванням `0.0.0.0`).

🔴 **Власний екземпляр Postgres на магазин (вимога платформи).** Кожен магазин має ВЛАСНИЙ
екземпляр Postgres, а не лише власну базу в спільному кластері. Ролі `app_runtime` і `app_admin`
кластерні: два магазини в одному кластері ділять їх — синк пароля `app_runtime` одним магазином
(накат на старті) ламає вхід іншому, а `SET LOCAL ROLE app_admin` бачить чужу базу. Тому один
екземпляр на магазин, а в Dokploy — окремий сервіс Postgres на проєкт. Порушення бачить
`simplycms doctor --online`: рядок `shared-cluster` попереджає, якщо в кластері є інші бази, до
яких `app_runtime` має `CONNECT` (службові `postgres`, `template0`, `template1` не рахуються).
Перевірка чесна, коли `doctor` підключений як `app_runtime` (саме це робить `DATABASE_URL`): критерій
«чужий журнал» тримається на `CONNECT` цієї ролі. З іншою роллю в URL (власник, суперкористувач) перелік
все одно рахує бази, доступні `app_runtime`, але не відображає того, що бачить сама ця роль.
Заглушки секретів з прикладів (`your-password`, `your-32-byte-random-secret` тощо) `doctor` вважає
помилкою: `env.example` постачає порожні значення з підказкою, як їх згенерувати.

🔴 **Стеля тіла запиту (К3-Е6д-2, Е8-Р20).** Node-раннер (`server.mjs`) обмежує тіло ВСІХ запитів
незалежно від шляху: `Content-Length` понад стелю → 413 до виклику хендлера (без читання тіла, зʼєднання
живе), а chunked-потік іде через лічильник байтів — при переповненні зʼєднання знищується. Стеля
за замовчуванням — 1 МіБ; 26 МіБ (`MAX_REQUEST_BODY_BYTES`, `domain/media.ts`: 5 фото відгуку по 5 МБ +
1 МБ службових) — лише для `multipart/form-data` на точний префікс server functions
(`/_serverFn/` або база з `basepath`/`serverFns.base`; раннер бере її з експорту `SERVER_FN_BASE` бандла, бо Start інлайнить її при збірці, а не кладе в `process.env`; бандл без експорту — exit 1, `simplycms update --write`). Закодований шлях (`/%5FserverFn/…`) отримує малу стелю.
Другий рубіж — request-міддлвара `bodyLimitMiddleware` (за `handlerType === 'serverFn'`, який дає
Start): POST на server function із `Content-Length` понад стелю → 413, а без `Content-Length` — 411
для всього, що не JSON, і для всього, що Start читає як форму (`application/json; x=multipart/form-data`
теж). Чистий chunked JSON обмежує лічильник раннера (`UPSTREAM:START-BODY-1`). Проксі перед
магазином (nginx `client_max_body_size`, Traefik `maxRequestBodyBytes`) має пропускати принаймні цю
стелю і НЕ перетворювати multipart на chunked без `Content-Length`, інакше завантаження файлів
отримає 411. Інший рантайм (не `server.mjs`) лишається без лічильника — переглянути. 413 віддається до
читання тіла: браузер, що ще вантажить понад стелю, може побачити обрив зʼєднання замість 413
(штатний UI відсікає завеликі файли до відправки).

🔴 **Origin запиту — лише `VITE_SITE_URL` (Е8-Р18б).** `server.mjs` будує `request.url` з origin
`VITE_SITE_URL` + шлях і query запиту; `Host`, `X-Forwarded-Host`, `X-Forwarded-Proto` для URL
ігноруються (їх підробляє клієнт, а origin звідти бере CSRF-перевірка Start і Better Auth).
Прапорця «довіряти проксі» немає. Без валідного `VITE_SITE_URL` (абсолютний `http(s)`-URL)
раннер завершується з кодом 1 до слухання порту, у повідомленні — лише імʼя ключа. Request-target
мусить починатися рівно з одного `/`: `//evil/x` і `/\evil` → 400 (інакше Start відповів би 308 на
чужий хост); absolute-form (`http://h/p?q`) зводиться до шляху й query.

**Deploy:** на прод кладуться `dist/`, `server.mjs`, `package.json` + production-`node_modules`
(потрібен рівно один рантайм-пакет — `sirv`, він у `dependencies`). `VITE_*` для КЛІЄНТСЬКОГО
бандла запікаються на етапі `vite build`, тож збірку робить той самий env, що й прод.

🔴 **Контракт серверного env:** серверний контур читає **лише** `process.env` і лише в рантаймі
(усередині фабрик/хендлерів, не на модуль-рівні). `server.mjs` перед динамічним імпортом хендлера
наповнює `process.env` із `.env.local`/`.env` — лише відсутні ключі, тож реальний env процесу завжди
виграє (`process.env` > `.env.local` > `.env`); у dev те саме робить `loadEnv` у `vite.config.ts`.
Наслідок: ротація `DATABASE_URL`/`BETTER_AUTH_SECRET` = перезапуск процесу, БЕЗ перезбірки; для
клієнтського `VITE_SITE_URL` потрібна перезбірка.
