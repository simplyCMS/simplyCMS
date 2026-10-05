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
- `VITE_SITE_URL` — публічний URL сайту (sitemap.xml, robots.txt); запікається при `vite build`,
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
- `VITE_SUPABASE_*` магазину не потрібні ні вітрині, ні входу, ні `/api/health`.
  `resolveSupabaseKeys` і фабрики клієнтів лишились у `simplycms/supabase` як шар **адмінки**:
  магазин, якому потрібна робоча легасі-адмінка, тримає ці ключі у власному env — контрактом ядра
  вони не є.

🔴 **Контурів env два, джерела в них різні.** Клієнтський бандл читає `import.meta.env` — значення
запікаються при `vite build`. Серверний код (SSR, server fns, middleware, SEO) читає **лише**
`process.env` і лише в рантаймі; `.env`/`.env.local` — не джерело, а спосіб його наповнення (див.
§ «Запуск у проді»). `VITE_`-префікс означає «видно клієнту», а не «лише клієнт»: той самий
`VITE_SITE_URL` сервер бере з `process.env` (`seo/robots`, `seo/sitemap`). Дуального резолву немає —
відсутній ключ гучно падає. Контракт стережеться машинно, і саме так, бо інакше не можна: у vitest
`import.meta.env` — Proxy над `process.env` (один обʼєкт), тож ТЕСТ довести джерело env не здатен.
Доводять: eslint `no-restricted-syntax` на `import.meta.env` у шести серверних модулях (див. `docs/development/TOOLING.md` § «Лінт»)
і Gate C пілота (`server-client` + `anon-client` у `SERVER_PAYLOAD`).

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

**Deploy:** на прод кладуться `dist/`, `server.mjs`, `package.json` + production-`node_modules`
(потрібен рівно один рантайм-пакет — `sirv`, він у `dependencies`). `VITE_*` для КЛІЄНТСЬКОГО
бандла запікаються на етапі `vite build`, тож збірку робить той самий env, що й прод.

🔴 **Контракт серверного env:** серверний контур читає **лише** `process.env` і лише в рантаймі
(усередині фабрик/хендлерів, не на модуль-рівні). `server.mjs` перед динамічним імпортом хендлера
наповнює `process.env` із `.env.local`/`.env` — лише відсутні ключі, тож реальний env процесу завжди
виграє (`process.env` > `.env.local` > `.env`); у dev те саме робить `loadEnv` у `vite.config.ts`.
Наслідок: ротація `DATABASE_URL`/`BETTER_AUTH_SECRET` = перезапуск процесу, БЕЗ перезбірки; для
клієнтського `VITE_SITE_URL` потрібна перезбірка.
