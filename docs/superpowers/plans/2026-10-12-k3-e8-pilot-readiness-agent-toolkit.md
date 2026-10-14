# К3-Е8 (А+Б): готовність до пілоту й агентний супровід магазину — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Примітка 2026-10-14:** ціль релізу змінено на `0.15.0` (мінорний, тег `latest`), заморожування baseline
> і `1.0.0-rc.1` — після хвилі мультимовності; див. [спеку релізу 0.15.0](../specs/2026-10-14-release-0.15.0-design.md).
> Згадки `1.0.0-rc.1` нижче — історичний текст плану.

**Goal:** Магазин, створений з npm, розгортається на Dokploy зі своєю БД, бакетом S3, поштою через SMTP і накатом міграцій на старті. Агент у магазині з першої сесії бачить стан і наступний крок і веде власника від порожньої теки до живого магазину. Обидві частини йдуть одним релізом — першим пререлізом `1.0.0-rc.1` (npm-тег `next`). Е8 (зовнішній агент розгортає пілот саме з RC) — після релізу, цей план його не робить; знайдене в Е8 закривається в `rc.2…`, а `1.0.0` — окремим рішенням після живого пілоту.

**Architecture:** Хвиля А0 вводить чистий резолвер груп env (`simplycms/env`) і Node 24. Хвиля А1 замінює психологію «накоти psql-циклом» на журнал із контрольними сумами в ядрі (`simplycms/migrate`): одна реалізація для проду, харнесу, `db:demo`, CLI, `doctor` і `status`. Перед заморожуванням baseline у нього вносяться дешеві борги схеми. Хвиля А2 — прод-старт (`scripts/start.mjs` + `process.execve`), ідентифікатор збірки, стиснення статики, 413 без закриття з'єднання. А3 додає драйвер `s3` за наявним контрактом. А4 додає порт пошти `simplycms/mail` з outbox `mail_outbox` (перша append-only міграція `0005`). Хвиля Б1 (не залежить від А): перейменування скіла, керований блок інструкцій, каркас `status`, шим хука. Б2 (після А): онлайн-перевірки `status`, `smoke`, тексти скілів онбордингу, оновлення й діагностики, мінімальний скаффолдер. Хвиля А6 (після А5, до Ф) закриває погоджені власником знахідки аудиту 2026-10-12: маскування помилок і заголовки безпеки, канонічний шлях товару, ціни лише для виду глядача, «помилка ≠ порожньо», прод-рецепт і власний Postgres на магазин (Р23–Р29); Р18–Р22 і Р30 доповнюють хвилю А4 (Task 11b, А4-R, 12b) і Task 18.

**Tech Stack:** TypeScript 6 strict, TanStack Start (Vite 7), Drizzle + `pg` 8.23.1 (peer), PostgreSQL 17, Better Auth, Vitest (юніт / `vitest.schema.config.ts` / `vitest.packaging.config.ts`), tsdown, pnpm 11, Node 24 (`process.execve`), `aws4fetch` 1.0.20, `nodemailer` 10.1.0, Garage `dxflrs/garage:v2.4.1`, Mailpit (`axllent/mailpit`), CLI `@simplycms/cli` і `create-simplycms-store` (Node ESM).

**Spec:**
- А — `docs/superpowers/specs/2026-10-12-pilot-readiness-design.md`;
- Б — `docs/superpowers/specs/2026-10-12-shop-agent-toolkit-design.md`.

Розвилки Е8-Р1…Р14 ухвалив архітектор `dashboard-design-spec` 2026-10-12. Вони **записані тут**, Task 25 переносить їх у спеки.

## Розбіжності зі спеками (факти розвідки, HEAD `fbee0605`)

| # | Спека припускала | Факт |
|---|---|---|
| а | А §5: «`pnpm db:diff` генерує новий файл, а не переписує `0001_init.sql`» — як нова вимога | Уже так: `scripts/db-diff.mjs:47-54` (`nextCanonPrefix`) дає `0005_<name>.sql`. Потрібен лише тест заморожування (Task 3) |
| б | А §5: компаратор «спільний для doctor і db:diff» розширюється журналом | Компаратор (`packages/cli/src/db-diff.mjs:92-172`) порівнює теку магазину з канонами за іменем і вмістом. Журналу БД немає ніде — це нова функціональність (Task 3) |
| в | А §6: «перевірити `server-runtime.mjs`» щодо 413 | 413/411 віддає Start-middleware ядра (`packages/simplycms/src/runtime/body-limit.ts:43-48`, підключена в `template/src/start.ts:71`). `Connection: close` не ставить ніхто; тесту через справжній сервер немає (Task 7) |
| г | А §6: «`sirv` віддає `.br`/`.gz`, якщо збірка їх поклала» | `server.mjs:46-56` має `gzip:true, brotli:true`, але прекомпресії немає ніде. Гіпотеза: сьогодні стиснення нульове — підтверджується виміром (Task 7) |
| д | А §8: «`pilot-full` з `S3_*` на Garage і `SMTP_URL` на Mailpit» | `scripts/release/pilot-full.mjs` = `harness:up` (лише Postgres, один `docker run`) → `db:demo` → `pnpm pilot`. Garage і Mailpit не описані ніде; env скретча — рівно три ключі (`scripts/pilot-pack/env.mjs`) |
| е | А §3: «`SendAuthEmail` переходить на порт» | У проді канал не інжектується взагалі: `getAuth()` = `createAuth()` без deps (`auth/instance.ts:126-129`), тож скидання пароля ЗАВЖДИ йде в `stubSendAuthEmail` зі `storeName='SimplyCMS'`. Тип `InviteEmail` має обов'язковий `html` і не має `replyTo`; `SendInviteEmail` дублює `SendAuthEmail` (`auth/invite-email.ts:13-21`) |
| є | А §4: помилки S3 видно | `serveMedia` перетворює ВИНЯТОК `driver.open` на 404 (`storage/serve.ts:151-155`): збій мережі S3 = «немає файлу» без логу. Е8-Р14 |
| ж | А §5: плагінні файли `<timestamp>_plg_*` | `simplycms create plugin` кладе `0001_plg_<name>_init.sql` (`packages/cli/template-plugin/migrations/0001___PLUGIN_TABLE_PREFIX__init.sql`). За іменем він стає між `0001_init` і `0002_grants`, а той робить `revoke all on all tables … from public`. Е8-Р4 |
| з | А §6: «магазин на Node 24» | `engines.node >=22.12.0` скрізь, CI `lts/*`. `process.execve` є з 23.11. Е8-Р1 |
| и | Б §3.7: Gate TOOL на запакованому магазині бачить файли агента | Скретч пілота — копія `template/` + оверлей (`scripts/pilot-pack/scaffold.mjs:68-84`), а не `bin` скаффолдера. Е8-Р5: файли агента живуть статично в `template/` |
| і | Б §3.1: `update --check` для CI | `update --check` виконує `pnpm view` і `pnpm add` (`packages/cli/src/update.mjs:103-118`). Е8-Р12 |
| ї | Е8-Р11 (розвилка): «Nodemailer — CJS, клас START-IP-1» | `nodemailer@10.1.0` (2026-10-10) — dual: `exports` має `import` (`dist/esm`) і `require`, типи власні (`dist/cjs/nodemailer.d.ts`). Гіпотеза peer лишається, але рішення фіксує вимір Gate SB (Task 9) |
| й | `server.mjs` лише читає env | `server.mjs:29-35` НАПОВНЮЄ `process.env` з `.env.local`/`.env`. Після `execve` без `MIGRATION_DATABASE_URL` сервер повернув би її з `.env.local`. Закриває Task 5 |

## Рішення (Е8-Р1…Р14, архітектор 2026-10-12)

- **Е8-Р1.** `engines.node >=24` у всіх п'яти пакетах (`simplycms`, `@simplycms/cli`, `@simplycms/theme-solarstore`, `@simplycms/plugin-faq`, `create-simplycms-store`), у `template/package.json.tpl` і в оверлеї пілота. CI — `node-version: 24`. `start.mjs` без `process.execve` падає з поясненням, фолбеку немає.
- **Е8-Р2.** Одна реалізація накату — `simplycms/migrate`: прод (`start.mjs`), `simplycms db:apply`, харнес `test:schema`, `db:demo`. Не-міграційний SQL (demo-seed, фікстури, sanitize-probe пілота) накочується як раніше, поза журналом. Журнал — `public.simplycms_migrations`, у декларації грантів `app_admin: select`. Fail-closed для `app_runtime` перевіряє той самий `grants-parity`. `doctor --online` і `status` читають журнал з `DATABASE_URL` через `SET ROLE app_admin` у read-only транзакції (членство `app_runtime → app_admin with set true` уже є: `0000_prelude.sql:93-94`).
- **Е8-Р3.** У baseline до заморожування:
  - Е6г-9 — `CHECK (email = lower(email))` на `users`, з тестом КОЖНОГО шляху запису: BA signUp з `Mixed@Case`, owner-invite, admin-invite, `updateCustomerContacts`;
  - К2-Е0-1 — `stock_status NOT NULL` у `products` і `product_modifications`;
  - Е6г-13 — індекс `orders(created_at)`; Е6г-5 — функціональний індекс keyset покупців;
  - Е6г-6 — колонка `source` (`'manual'|'rule'`, NOT NULL) у `user_category_history`; `byRule` читає її, а не `rule_id is not null`.

  Е6г-12 (повторний бан) — код, не схема: лишається в своєму списку боргів.
- **Е8-Р4.** Шаблон плагіна отримує timestamp-ім'я під час скаффолду (`<YYYYMMDDHHmmss>_plg_<name>_init.sql`) + тест. Окремий тест: жодне ім'я плагінної міграції не сортується перед `0002_grants.sql`.
- **Е8-Р5.** `AGENTS.md`, `CLAUDE.md`, `.claude/settings.json`, `.claude/hooks/session-start.mjs` лежать статично в `template/`. Керований блок у шаблонному `AGENTS.md` генерує `pnpm template:sync` з єдиного джерела вступу в ядрі під тестом парності. Ті самі джерело й функція рендеру працюють у `simplycms update`. Що `npm pack` не ріже `.claude/`, доводиться виміром.
- **Е8-Р6.** `scripts/start.mjs` — файл лише шаблону (без синку), з власним тестом. Gate B пілота стартує через нього. Асерт `/proc/<pid>/environ` — Linux; на інших ОС skip із причиною.
- **Е8-Р7.** `resolveDriverEnv(env)` — чиста функція в новому server-only субшляху `simplycms/env` (не в `runtime`: там client-safe речі). Точки виклику: серверний бандл на верхньому рівні хост-модуля `src/server.ts` (Е8-Р7′), `start.mjs`, фабрики драйверів, `doctor`/`status`. Помилка називає саме відсутні ключі й не містить значень.
- **Е8-Р7′ (архітектор, 2026-10-12, з Т5).** `server.mjs` лишається без залежностей від ядра: у корені монорепо `node_modules/simplycms` немає, і статичний імпорт `simplycms/env` ламав `live:smoke`. Перевірку груп env кличе хост `src/server.ts` на верхньому рівні; помилка несе `code: 'SIMPLYCMS_DRIVER_ENV'`, `server.mjs` ловить помилку динамічного імпорту бандла: для цього коду друкує лише `message`, для будь-якої іншої — повністю зі стеком; в обох випадках exit 1 до `listen`. Попередження «пошта не налаштована» друкує лише бандл, один раз, лише при `NODE_ENV === 'production'`; `start.mjs` `warnings` ігнорує.
- **Е8-Р8.** Локаль листів реєструє хост: `declareStoreLocale(normalizeLocale(config.locale))` у `src/server.ts`, тим самим каналом, що `declareBuiltThemes`. Незадекларована → дефолт ядра + одне попередження, не падіння.
- **Е8-Р9.** Право картки хвостів пошти — `settings.manage`.
- **Е8-Р10.** Повтор пошти — як `media_erasures`: доставка після COMMIT, добір ≤5 хвостів при кожній наступній доставці, кнопка «Повторити», попередження в `status`/`doctor --online`. Таймера немає. Невдалі рядки живуть до успіху або ручного видалення. Картка показує вік і тип листа, але НЕ тіло: посилання скидання — секрет.
- **Е8-Р11.** Гіпотеза: `nodemailer` — peer з точним піном + пряма залежність шаблону й оверлею + `SERVER_ONLY_DEPS` + перевірка doctor поруч із №13. Рішення фіксує вимір Gate SB. Якщо вимір каже інакше — до архітектора.
- **Е8-Р12.** `simplycms update --check` — чиста перевірка без мережі й install.
- **Е8-Р13.** `status` і `doctor --online` ходять у БД через ядро магазину (`importFromStore` → `simplycms/migrate`). Шим хука кличе CLI магазину. Немає `node_modules/@simplycms/cli` → «УВАГА: стан невідомий» + `pnpm install`, код 0.
- **Е8-Р14.** Виняток драйвера в `serveMedia` → 503 + один `console.error` з ключем, без секретів; `null` → 404. Тест для обох драйверів, запис у `storage.md`.
- **Дрібне (архітектор погодив).**
  - Стейл-чанк — client-safe модуль ядра, виклик з кореневого `src/client.tsx` → `template:sync`.
  - Прекомпресія — власний Vite-плагін на `zlib`, лише якщо вимір підтвердить нуль.
  - 413/411 — інтеграційний тест через справжній `server.mjs`.
  - Garage (порт 4192) і Mailpit — у `harness:up`, у CI — `docker run`-кроками.
  - Контрактний набір драйверів — у контурі `test:schema`.
  - Лист гостю ставиться в чергу всередині `run` замовлення.
- **Рішення автора плану (у межах «лишено виконавцю»).**
  - Build-time хелпери (`resolveBuildId`, `precompressAssets`) — новий субшлях `simplycms/vite` (Node, збірка), внесений у `SERVER_ONLY`, бо клієнт його імпортувати не має.
  - Ідентифікатор збірки йде в код через `define` глобала `__SIMPLYCMS_BUILD_ID__` з guard `typeof … === 'string' ? … : 'dev'` (зразок klasnakasa). Чи доходить `define` до коду ядра в `node_modules`, доводить Gate B, а не припущення.
  - Е8-О8 (архітектор): єдиний контракт кодів виходу для `status` і КОЖНОГО `--check` (`db:apply --check`, `update --check`): `0` — гаразд, `3` — є що робити або розбіжність, `1` — помилка. `doctor` лишає свій контракт (`1` на `error`, `--strict` для `warn`).
- **Рішення власника (2026-10-12): лінія 1.0, чесний semver, спершу RC.**
  - Злам сумісності коду магазину, тем чи плагінів → нова мажорна версія; нове без зламу → minor; виправлення → patch. «Без зворотної сумісності» означає «не тримаємо старого API й шимів», а злам чесно піднімає мажорну + BREAKING у `CHANGELOG` + кроки в `simplycms-update`.
  - Перший реліз — `1.0.0-rc.1` під npm-тегом `next`; Е8 розгортає пілот з RC; `1.0.0` — після живого пілоту.
  - Звідси Task 14 (доказ оновлюваності, `test:schema` у релізі), Task 15 (політика версій) і Task 16 (пререлізний цикл).
- **Е8-С1 (архітектор, за аудитом Codex).** У `NODE_ENV=production` драйвер `log` друкує лише «Кому / Тема / тип листа», без тіла й посилань; поза продом — повний лист (dev-канал). Спека А §3 вирівнюється в амендменті (Task 25).
- **Е8-Р17 (архітектор, 2026-10-12, з Т9).** Після Р16 сигнал `NODE_ENV` разовому `doctor`/`status` недоступний: режим = явний `--production` || `isProductionRuntime(process.env)`; режим — першим рядком звіту; коди виходу не змінюються; `status --hook` — завжди розробка; скіли деплою й онбордингу та `simplycms smoke` кличуть `doctor --online --production`.
- **Е8-С2.** `owner:invite` друкує посилання лише коли драйвер `log` поза продом або з явним `--print-link`. Зі SMTP — «лист надіслано на <email>». У проді без SMTP і без `--print-link` — код 1 з поясненням «налаштуй `SMTP_URL`/`MAIL_FROM` або свідомо `--print-link`». Скіл онбордингу ставить SMTP ДО кроку запрошення й `--print-link` не вживає.

### Рішення після аудиту (Р18–Р30, 2026-10-12)

Архітектор `dashboard-design-spec` за паралельним аудитом безпеки й рефакторингу (звіти S1–S4, R1–R3; вердикти Opus). Р23–Р30 власник погодив у rc.1. Task 25 переносить їх у спеки разом з Е8-Р1…Р17.

- **Р18.** База посилань і URL запиту лише з конфігу: (а) BA `baseURL` = `BETTER_AUTH_URL ?? VITE_SITE_URL` завжди, (в) один хелпер посилань у листах, (г) `owner-invite.mjs` без фолбеку `localhost` → Task 11 (доповнення оркестратора); (б) раннер будує URL з `VITE_SITE_URL`, `//…` → 400 → Task А4-R.
- **Р19.** Роль `admin` — лише після прийняття запрошення; `revokeSessionsOnPasswordReset: true` + явне видалення сесій в accept → Task 11b.
- **Р20.** Стеля тіла в раннері на всі запити (1 МіБ; 26 МіБ лише multipart на `/_serverFn/`), предикат middleware — `handlerType` → Task А4-R.
- **Р21.** `simplycms update` після `pnpm add` передає керування новому CLI (`--after-install`) → Task 18.
- **Р22.** Корінь `local-fs` лише з `resolveDriverEnv(env).media` (`MEDIA_ROOT=""` → дефолт) → Task А4-R.
- **Р23.** У проді непередбачені помилки не течуть клієнту (ідентифікатор + лог), доменні проходять → Task А6.1.
- **Р24.** Банер головної — `loadBanners({ placement: 'home' })` з розкладом → Task А6.4.
- **Р25.** Один `productPath` для картки, sitemap, адмінки, canonical і JSON-LD; зарезервований сегмент для товару без розділу → Task А6.2.
- **Р26.** Збій запиту ≠ «порожньо» на чотирьох сторінках вітрини й у `useDiscountCard`; доменне «не знайдено» → Task А6.4.
- **Р27.** Базові заголовки безпеки на всіх відповідях → Task А6.1.
- **Р28.** Прод — лише `node scripts/start.mjs`; власний Postgres на магазин (+ `doctor --online`); порожні заглушки в `env.example` → Task А6.5 (вимога (б) у скілах — Task 22). Доповнення (S4-16): без абсолютних симлінків `.claude/skills/tanstack-*` у git-індексі, без приватної адреси Garage у спеці А → Task А6.5.
- **Р29.** Публічні лоадери віддають ціни лише для виду глядача; персоналізоване — `private, no-store` → Task А6.3.
- **Р30.** Підтвердження пошти при реєстрації зі SMTP; `email_domain` лише для підтвердженої → Task 12b (живий доказ — Task 13).
- **Дрібні.** К1 (`.env` в `owner-invite.mjs` через `parseEnv`) → Task 11b; К4(а) (`test-contours.md:71` «6 команд») → Task 19; Д2 (порожній email покупця → без листа `order_customer`) → Task 12; Д5 (сервер перевіряє slug товару й модифікації) → Task А6.2.
- **НЕ для виконавця.** Захист публікації в CI (provenance, environment, Trusted Publishing) роблять власник з архітектором перед PR. YAML публікації не чіпати, крім рядка `--tag` у Task 16.

## Global Constraints

- Відповіді, коментарі, доки й тексти скілів — українською; коментар пояснює **чому**.
- Жодних трейлерів `Co-Authored-By`/`Generated with`. Після **кожного** коміту субагента: `git log --format=%B fbee0605..HEAD | grep -ciE "co-authored|generated with"` = `0`.
- Комітити в `claude/k3-e8-live-npm` можна. Пуш, PR і реліз `1.0.0-rc.1` — лише за словом власника.
- **БЛ (базовий ланцюг)** = `pnpm install --frozen-lockfile → format:check → lint → build → typecheck → typecheck:showcase → test → test:schema → build:packages → typecheck:template → test:packaging`. Крок «Прогнати» перед комітом задачі (і будь-який крок, що називає себе фінальним для задачі) означає **«БЛ + додатково X»**, ніколи вибірку. Проміжні TDD-кроки («→ FAIL», «→ PASS» одного тесту) і прогони мутацій ганяють вибірковий тест — це перевірка тесту, а не гейт задачі. Урок Е7: вибірковий перелік мовчки підмінив ланцюг, і typecheck був червоний на трьох комітах поспіль, а рецензенти цього не бачили.
- Звіт виконавця про зелений гейт — не доказ. Гейти перепрогонить той, хто приймає хвилю.
- Кожен новий гейт чи тест має **негативний контроль прогоном**. У звіті задачі — рядок «мутація → червоний → відкат → зелений» з назвою тесту. Мутація, записана в кроці, — мінімум; виконавець може додати свої.
- Коди виходу `status` і кожного `--check`: `0` гаразд, `3` є що робити / розбіжність, `1` помилка (Е8-О8).
- Норма `pnpm lint` = 0 errors / 7 warnings. Селектори й опції error-зон не послаблювати.
- Після будь-якої правки `package.json`: `pnpm install`, далі `pnpm install --frozen-lockfile`.
- Копії `template/{src,db/migrations,themes/default,plugins/hello-world,server.mjs,server-runtime.mjs}` і `packages/cli/host/**` руками не правляться. Правиться джерело (кореневі `src/*`, `server*.mjs`, `packages/simplycms/migrations/`), потім `pnpm template:sync`. `template/scripts/*`, `template/README.md`, `template/env.example`, `template/package.json.tpl`, а також нові `template/{AGENTS.md,CLAUDE.md,.claude/**}` — файли шаблону. Керований блок `AGENTS.md` генерує синк.
- 🔴 **Заморожування.** Після коміту Task 3 файли `packages/simplycms/migrations/0000…0004` не правляться. Нова схема — лише нові файли `0005_*` і далі; кожен несе свої гранти й RLS у собі.
- ~150 рядків на модуль. У гейті кожної задачі: `wc -l` нових і змінених файлів коду; файл понад 150 — поділити або обґрунтувати одним рядком у звіті. Урок Е4: межу не повторили в плані, і виконавці написали 9 файлів понад неї.
- Новий server-only субшлях (`env`, `migrate`, `mail`, `vite`) проходить повний чекліст торкань: dev-`exports` і `publishConfig.exports` у `packages/simplycms/package.json`; `SERVER_ONLY` у `contracts/server-only.ts`; `eslint.tier-zones.mjs` (зона + upward-списки споживачів); `tests/tier-boundary/zones.ts` з негативним контролем; `SENTINELS` у `tests/dist-server-boundary.test.ts`; `packages/README.md`; `docs/architecture/repository-layout.md`. Еталон — `git show 074168bf --stat` (`simplycms/site`).
- Код платформи не знає імен провайдерів (Resend, Garage, Dokploy) поза винятками `UPSTREAM:` і поза текою скіла онбордингу.
- Секрет (пароль, ключ, токен, посилання скидання) не потрапляє ні в лог, ні в текст помилки, ні у вивід CLI. Тест, що перевіряє помилку, асертить відсутність значення.
- Задача, що чіпає `test-harness/pg` чи міграції, ганяє `pnpm test:schema`. Вибірковий фільтр — без `--` (`pnpm test:schema migrate`). Харнес — `pnpm harness:up` / `pnpm harness:down`.
- `CHANGELOG.md` (крім `[Unreleased]`) і `docs/superpowers/{plans,research}/**` не чіпати. Спеки А і Б правляться лише в Task 25.

## Review Focus

1. **Власник запускає `node scripts/start.mjs` локально, а `MIGRATION_DATABASE_URL` лежить у `.env.local`.** Очікування: процес сервера змінної не має — `server.mjs` її з файлу не повертає. Тест: Task 5, кейс «`.env.local` з `MIGRATION_DATABASE_URL`».
2. **У Dokploy задано чотири з п'яти `S3_*` (забули `S3_REGION`).** Очікування: контейнер не стартує, помилка називає `S3_REGION`, значень інших ключів у тексті немає. Ні мовчазного `local-fs`, ні падіння на першому завантаженні. Тест: Task 1 (резолвер) і Task 5 (`server.mjs` виходить ненульовим кодом до імпорту хендлера).
3. **Покупець реєструється як `Ivan@Example.COM`, а адмін змінює контакт на `Olena@Mail.UA`.** Очікування: обидва записи лягають у нижньому регістрі; `CHECK` не перетворюється на 500. Тест: Task 2, чотири шляхи запису.
4. **SMTP недоступний у момент оформлення замовлення.** Очікування: замовлення створене; рядки листів лишаються з `attempts=1` і помилкою; картка адмінки їх показує без тіла; «Повторити» після відновлення SMTP доставляє й видаляє рядки. Тест: Task 10 і Task 12.
5. **Новий контейнер стартує на базі, де дві репліки одночасно накочують `0005`, або файл міграції падає посередині.** Очікування: advisory-лок серіалізує накат; файл, що впав, відкочується цілком, журнал його не має, процес виходить ненульовим кодом, а після виправлення файлу повторний старт його накочує. Тест: Task 3, детермінований лок (тримати лок окремим з'єднанням → накат `stillPending` → release) і кейс «SQL-помилка в другому файлі».
6. **Магазин на 1.0 з даними отримує в наступній версії нові міграції `0006`/`0007`.** Очікування: `db:apply` (або старт) накочує обидві, замовлення, товари, покупці й медіа цілі; правка вже накатаного `0005` → `MigrationChecksumError`, контейнер не стартує, дані не зачеплено. Тест: Task 14.

---

## Хвиля А0 — основа

### Task 1: Node 24 і резолвер груп env `simplycms/env`

**Files:**
- Create: `packages/simplycms/src/env/{index.ts,resolve.ts}`, `packages/simplycms/src/env/__tests__/resolve.test.ts`
- Modify: `packages/simplycms/package.json` (exports ×2, `engines`), `packages/{cli,simplycms-theme-solarstore,simplycms-plugin-faq,create-simplycms-store}/package.json` (`engines`), `packages/create-simplycms-store/template/package.json.tpl`, `tests/pilot/store-template/package.json`, `.github/workflows/{workflow.yml,publish-packages.yml}` (`node-version: 24`), реєстри субшляху за чеклістом Global Constraints
- Modify: `tests/env-contract.test.ts`, `.env.example`, `packages/create-simplycms-store/template/env.example`, `docs/development/ENVIRONMENT.md` §1, `AGENTS.md` (інваріант env), інші носії «рівно три»: `README.md:101`, `template/README.md:33`, `packages/create-simplycms-store/src/steps.mjs:115`, `scripts/pilot-pack/env.mjs:4`, `docs/architecture/test-contours.md:969`

**Interfaces:**
- Produces (`simplycms/env`):
  ```ts
  export const S3_KEYS = ['S3_ENDPOINT','S3_REGION','S3_BUCKET','S3_ACCESS_KEY','S3_SECRET_KEY'] as const;
  export const SMTP_KEYS = ['SMTP_URL','MAIL_FROM'] as const;
  export type MediaEnv = { driver: 'local-fs'; root: string | null }
    | { driver: 's3'; endpoint: string; region: string; bucket: string; accessKey: string; secretKey: string };
  export type MailEnv = { driver: 'log' } | { driver: 'smtp'; url: string; from: string };
  export type DriverEnv = { media: MediaEnv; mail: MailEnv; warnings: readonly string[] }; // друкує викликач, функція чиста
  export class DriverEnvError extends Error { readonly group: 's3' | 'smtp'; readonly missing: readonly string[] }
  export function resolveDriverEnv(env: Readonly<Record<string, string | undefined>>): DriverEnv;
  export function describeDriverEnv(d: DriverEnv): string; // «медіа: s3 (бакет X), пошта: log» — без секретів
  ```
  Порожній рядок вважається незаданим ключем: Dokploy зберігає `KEY=`. `S3_ENDPOINT` обрізає хвостові `/`.

- [ ] **Step 1: `resolve.test.ts`.** Кейси:
  - жодного ключа → `{ media: {driver:'local-fs', root:null}, mail: {driver:'log'} }`; `MEDIA_ROOT='/data'` → `root:'/data'`;
  - усі п'ять `S3_*` → `driver:'s3'`, `endpoint` без хвостового `/`;
  - для кожного з п'яти ключів окремо: решта чотири задані → `DriverEnvError`, `group==='s3'`, `missing` = `[той ключ]`, `message` містить ім'я ключа і НЕ містить жодного значення (значення фікстур — унікальні маркери на кшталт `SECRET-7f3a`);
  - `S3_REGION=''` разом з іншими чотирма → `missing:['S3_REGION']`;
  - `SMTP_URL` без `MAIL_FROM` → `missing:['MAIL_FROM']`; `MAIL_FROM` без `SMTP_URL` → `missing:['SMTP_URL']`; обидва → `driver:'smtp'`;
  - `SMTP_URL='smtps://u:p4ss@h:465'` у тексті `describeDriverEnv` відсутній (ні `p4ss`, ні `u:`);
  - усі `S3_*` + `MEDIA_ROOT` → `driver:'s3'` і рівно одне попередження в `warnings`, що називає `MEDIA_ROOT` як проігнорований (Е8-Б2).
- [ ] **Step 2: Прогнати** `pnpm vitest run packages/simplycms/src/env` → FAIL (модуля немає).
- [ ] **Step 3: Реалізувати** `resolveDriverEnv`/`describeDriverEnv` у `resolve.ts`, субшлях за чеклістом, `SENTINELS.env` — рядок з тексту `DriverEnvError`.
- [ ] **Step 4: Node 24.** `engines.node: ">=24"` у п'яти пакетах, шаблоні й оверлеї; CI `node-version: 24`. `pnpm install` → `pnpm install --frozen-lockfile`.
- [ ] **Step 5: Контракт env у документах.**
  - `tests/env-contract.test.ts`: `OPTIONAL` += `S3_ENDPOINT…S3_SECRET_KEY`, `SMTP_URL`, `MAIL_FROM`, `MIGRATION_DATABASE_URL`. Новий кейс: шаблонний `template/env.example` має ту саму множину активних ключів і закоментованих опційних, що кореневий `.env.example`. Друга множина читається з `S3_KEYS`/`SMTP_KEYS` модуля (імпорт, не копія).
  - Обидва `env.example`: закоментовані групи «Сховище S3 (все або нічого)», «Пошта SMTP (все або нічого)», «Накат міграцій на старті (`MIGRATION_DATABASE_URL`, бачить лише `scripts/start.mjs`)».
  - `AGENTS.md`, інваріант: «Обов'язкових env-ключів рівно **три**: `DATABASE_URL`, `BETTER_AUTH_SECRET`, `VITE_SITE_URL`. Опційні — групами драйверів за правилом «все або нічого» (`simplycms/env`)». Решта носіїв — тим самим формулюванням. Перевірка: `git grep -n "рівно .*три\|рівно ТРИ" -- ':!CHANGELOG.md' ':!docs/superpowers/**'` → кожен рядок або оновлено, або це історичний розділ із позначкою.
  - `ENVIRONMENT.md` §1 — підрозділ «Групи драйверів» з таблицею груп і посиланням на `resolveDriverEnv`.
- [ ] **Step 6: Прогнати** БЛ + `pnpm vitest run packages/simplycms/src/env tests/env-contract.test.ts`. Мутації:
  - у `resolve.ts` повертати `local-fs` при частковій групі `S3_*` → FAIL «чотири з п'яти»; відкат;
  - вставити значення в `message` помилки → FAIL «без значень»; відкат;
  - розкоментувати `# S3_BUCKET=` у `.env.example` → FAIL «активні ключі — рівно контракт»; відкат.
- [ ] **Step 7: Commit** `feat(k3-e8): Node 24 і резолвер груп env simplycms/env`.

---

## Хвиля А1 — міграції на живій базі

### Task 2: Борги схеми в baseline і timestamp-імена плагінних міграцій

Останні правки baseline на місці перед заморожуванням (Task 3). Правиться `schema.ts`, `0001_init.sql`, `drizzle/0000_init.sql` і `drizzle/meta/0000_snapshot.json` синхронно — виняток baseline (`docs/architecture/data-layer.md:218-222`), а не `pnpm db:diff`.

**Files:**
- Modify: `packages/simplycms/src/schema/{auth.ts,schema.ts}`, `packages/simplycms/migrations/0001_init.sql`, `packages/simplycms/drizzle/{0000_init.sql,meta/0000_snapshot.json}`, `packages/simplycms/src/commerce/customer-categories.ts:51` (+ інші вставки в історію: `git grep -n "userCategoryHistory" packages/simplycms/src`), `packages/simplycms/src/admin-server/impl/customers/card.ts:82`
- Modify: `packages/cli/src/create-scaffold.mjs:38-46`, `packages/cli/template-plugin/migrations/0001___PLUGIN_TABLE_PREFIX__init.sql` (→ `__MIGRATION_TS_____PLUGIN_TABLE_PREFIX__init.sql` або підстановка імені при копіюванні — на вибір виконавця), `docs/architecture/cli.md:171`
- Test: `packages/simplycms/test-harness/pg/__tests__/email-lowercase.test.ts` (новий), `baseline.test.ts`, `tests/cli-create-plugin.test.ts` (або наявний тест скаффолду плагіна), `tests/plugin-migration-order.test.ts` (новий)
- `pnpm template:sync` (копії міграцій у шаблоні)

**Interfaces:**
- Produces: колонка `user_category_history.source` (`text not null`, `check (source in ('manual','rule'))`); `byRule = (h.source = 'rule')`. Ім'я плагінної міграції зі скаффолду матчить `/^\d{14}_plg_[a-z0-9_]+\.sql$/`.

- [ ] **Step 1: Тест email (`email-lowercase.test.ts`, контур `test:schema`).** Чотири кейси, кожен асертить рядок у `users.email` у нижньому регістрі:
  - BA `signUpEmail` з `Mixed@Case.UA` (memory-адаптер не годиться — справжній drizzle-адаптер на тимчасовій БД);
  - `issueOwnerInvite` з `Owner@Shop.UA`;
  - адмін-запрошення (той самий `issueOwnerInvite` через `auth/invite-store.ts` — звірити, чи є окремий шлях; якщо є, окремий кейс);
  - `updateCustomerContacts` з `Olena@Mail.UA`.

  П'ятий кейс: прямий `insert into users (… email …) values (… 'Bad@X.UA' …)` → `23514` (`check_violation`).
- [ ] **Step 2: Прогнати** `pnpm test:schema email-lowercase` → FAIL п'ятого кейсу (CHECK ще немає); перші чотири показують, які шляхи вже кладуть lower. Шлях, що кладе як є, — лагодити в коді (нормалізація на межі запису), а не послаблювати тест.
- [ ] **Step 3: Внести в baseline.**
  - `users`: `check('users_email_lowercase', sql\`${t.email} = lower(${t.email})\`)`;
  - `products.stock_status`, `product_modifications.stock_status`: `.notNull()` (`schema.ts:401,435`);
  - індекс `orders_created_at_idx` на `orders(created_at)`;
  - індекс keyset покупців `users_created_ms_id_idx` на `(date_trunc('milliseconds', created_at) desc, id desc)` — точний вираз звірити із запитом списку покупців (`git grep -n "date_trunc('milliseconds'" packages/simplycms/src`): індекс без збігу виразу планувальник не візьме;
  - `user_category_history.source`; усі вставки пишуть `'manual'` або `'rule'`; `card.ts:82` читає `source`.

  Синхронно `0001_init.sql`, `drizzle/0000_init.sql`, `0000_snapshot.json`; лічильники в `baseline.test.ts` (індекси/check) оновити.
- [ ] **Step 4: Прогнати** `pnpm test:schema` → PASS. Негативні контролі:
  - прибрати нормалізацію lower у `updateCustomerContacts` → кейс червоніє `23514`; відкат;
  - у `card.ts` повернути `rule_id is not null` і видалити правило в тесті історії → кейс `byRule` червоніє; відкат. Якщо тесту історії з видаленням правила немає — додати (`packages/simplycms/test-harness/pg/__tests__/` поруч із тестами категорій).
- [ ] **Step 5: Timestamp-імена плагінів (Е8-Р4).** Скаффолд плагіна дає `<YYYYMMDDHHmmss>_plg_<prefix>_init.sql` (UTC на момент скаффолду). Тести:
  - скаффолд у tmp → ім'я матчить `/^\d{14}_plg_[a-z0-9_]+_init\.sql$/`;
  - `tests/plugin-migration-order.test.ts`: для кожного файлу `*_plg_*.sql` у `packages/simplycms-plugin-faq/migrations`, `packages/create-simplycms-store/template/plugins/*/migrations` і в результаті скаффолду: `[name, '0002_grants.sql'].sort()[0] === '0002_grants.sql'`.

  Мутація: повернути `0001_` у шаблоні плагіна → обидва тести FAIL; відкат. Канон `cli.md:171` — одне формулювання.
- [ ] **Step 6: Прогнати** `pnpm template:sync`, БЛ + `pnpm db:showcase` на ЧИСТІЙ БД харнесу (сід створює покупців ядрами, і БЛ цього шляху в рантаймі не покриває — Е8-О7). Вивід — у звіт; `23514` у ньому → лагодити шлях запису сіду, не CHECK.
- [ ] **Step 7: Commit** `feat(k3-e8): борги схеми в baseline перед заморожуванням, timestamp-імена плагінних міграцій`.

### Task 3: `simplycms/migrate` — журнал, накат, заморожування

**Files:**
- Create: `packages/simplycms/src/migrate/{index.ts,files.ts,journal.ts,apply.ts,runtime-password.ts,errors.ts}`
- Create: `packages/simplycms/test-harness/pg/__tests__/migrate-{apply,journal,lock,password}.test.ts`, `packages/simplycms/src/migrate/__tests__/files.test.ts`, `tests/migrations-frozen.test.ts`
- Create: `packages/create-simplycms-store/template/.gitattributes` (якщо `npm pack` ріже dot-файл — схема `RENAMES`, як `gitignore`)
- Modify: `packages/simplycms/test-harness/pg/apply.mjs` (канон — через `applyMigrations`; `applySqlFiles` лишається для не-міграційного SQL), `baseline.test.ts:52-60`, `grants-parity.test.ts`, `fixtures/grants.ts`, `scripts/demo-db.mjs`, реєстри субшляху

**Interfaces:**
- Produces (`simplycms/migrate`):
  ```ts
  export type MigrationFile = { name: string; path: string; checksum: string }; // sha256 hex після нормалізації CRLF→LF (Е8-О4)
  export function listMigrationFiles(dir: string): MigrationFile[];          // *.sql без підтек, сорт за іменем
  export type ApplyOptions = { connectionString: string; dir: string; runtimeUrl?: string; dryRun?: boolean; log?: (line: string) => void };
  export type ApplyReport = { applied: string[]; pending: string[]; runtimePasswordSynced: boolean };
  export function applyMigrations(o: ApplyOptions): Promise<ApplyReport>;
  export type JournalRow = { name: string; checksum: string; appliedAt: Date };
  export function readJournal(runtimeConnectionString: string): Promise<JournalRow[] | null>; // null = журналу немає
  export function pendingMigrations(rows: JournalRow[], files: MigrationFile[]): { pending: string[]; changed: string[] };
  export class MigrationChecksumError extends Error { readonly names: readonly string[] }
  export class UnjournaledDatabaseError extends Error {}
  export class MigrationTransactionControlError extends Error { readonly file: string; readonly reason: 'concurrently' | 'begin' | 'commit' }
  export const MIGRATION_LOCK_KEY: bigint; // константа pg_advisory_lock
  ```
- Consumes: `pg` (peer). Таблиця журналу: `public.simplycms_migrations (name text primary key, checksum text not null, applied_at timestamptz not null default now())`, `grant select … to app_admin`. Якщо гейт вимагає RLS на кожній таблиці `public`, — увімкнути з політикою `select` для `app_admin`.

- [ ] **Step 1: Тести харнесу (контур `test:schema`).**
  - `migrate-apply`: чиста БД → `applyMigrations` → `applied` = усі файли канону, кількість рядків журналу = `listMigrationFiles(CANON_DIR).length` (виводиться, а не літерал: Task 10 додасть `0005`) і суми збігаються; повторний виклик → `applied: []`; `dryRun` на чистій БД → `pending` = усі, у БД НЕ з'явилось жодної таблиці, включно з журналом (`to_regclass('public.simplycms_migrations') is null`); змінити байт у копії файлу в tmp-теці → `MigrationChecksumError` з іменем файлу, жоден файл не накочено (у т. ч. новий `0005_x.sql`, доданий поруч); файл `20260101000000_plg_x_init.sql`, доданий ПІСЛЯ накату `0005_y.sql`, накочується наступним викликом (немонотонність); SQL-помилка в другому з двох нових файлів → перший у журналі, другого немає, його DDL відкочено, виняток містить ім'я файлу;
  - `migrate-journal`: БД із таблицями канону, але без журналу (накат `applySqlFiles`) → `UnjournaledDatabaseError` з підказкою «перестворіть базу (`pnpm db:demo` локально); адопція бази без журналу не підтримується», нічого не змінено; `readJournal` під `app_runtime` (`withUser(url,'app_runtime')`) читає рядки, а прямий `select` без `set role` → `permission denied`;
  - `migrate-files` (юніт `files.test.ts`): файл із `\r\n` і той самий з `\n` → одна сума; файл з `create index concurrently` → `MigrationTransactionControlError` (`reason:'concurrently'`); верхньорівневі `begin;` чи `commit;` (поза тілом `$$…$$` функцій і поза коментарями) → помилка з відповідним `reason`; `begin` усередині `do $$ … $$` чи `create function … $$ begin … end $$` — НЕ помилка (функції канону `0004_functions.sql` мусять проходити). Перевірка — у `listMigrationFiles`, до будь-якого накату (Е8-О3);
  - `migrate-lock` (детерміновано, без годинника): окреме з'єднання тримає `pg_advisory_lock(MIGRATION_LOCK_KEY)` → запуск `applyMigrations` → опитування `pg_locks` до появи рядка `locktype='advisory' and granted=false` з ключем `MIGRATION_LOCK_KEY` (таймаут 5 с = FAIL) — це доказ, що накат чекає саме на наш лок, а не повільний → у журналі ще немає рядків → release → накат завершується, журнал повний;
  - `migrate-password` (Е8-О2): харнес і CI Schema працюють на `POSTGRES_HOST_AUTH_METHOD=trust` (`scripts/harness-up.mjs:64`, `workflow.yml:160`), тож «логін з паролем» пройде з будь-яким паролем — це не доказ. Доказ — верифікатор SCRAM: прочитати `pg_authid.rolpassword` для `app_runtime` (харнес під суперюзером), розібрати `SCRAM-SHA-256$<iter>:<salt>$<StoredKey>:<ServerKey>` і обчислити StoredKey з `N3w-P@ss` (`pbkdf2Sync(pwd, salt, iter, 32, 'sha256')` → HMAC `'Client Key'` → sha256) — збіг із збереженим. `ALTER ROLE` кластерний: тест зберігає `rolpassword` до кейсу й відновлює той самий верифікатор у `finally` (`alter role app_runtime password '<верифікатор>'`), інакше паралельні прогони на не-trust кластері зламаються. `runtimeUrl = postgres://app_runtime:N3w-P%40ss@…` → StoredKey збігається; `runtimeUrl` з іншим користувачем → `runtimePasswordSynced:false`, пароль `app_runtime` не змінено; лог (зібраний `log`) не містить пароля.
- [ ] **Step 2: Прогнати** `pnpm test:schema migrate` → FAIL (модуля немає).
- [ ] **Step 3: Реалізувати.**
  - `.gitattributes` шаблону: `*.sql text eol=lf`. `docs/architecture/data-layer.md` — рядок: файл міграції виконується в одній транзакції накату; `concurrently` і власні `begin/commit` відкидаються, індекс на великій таблиці — окреме рішення, а не тихий провал.
  - Порядок `applyMigrations`: connect → `pg_advisory_lock` → `to_regclass` журналу: немає журналу, але є `public.products` → `UnjournaledDatabaseError` (нічого не створено) → звірка сум (усі змінені → `MigrationChecksumError`, ДО будь-якого накату) → `dryRun` повертає звіт тут, нічого не створюючи → `create table if not exists` журналу → кожен ненакатаний файл у порядку імен: `begin; <sql>; insert into simplycms_migrations; commit` → `grant select on simplycms_migrations to app_admin` ПІСЛЯ накату (на чистому кластері роль створює `0000_prelude.sql`, тож грант до накату впав би; ідемпотентний, виконується щоразу) → синк пароля → unlock у `finally`.
  - Пароль: `alter role app_runtime password ${client.escapeLiteral(pwd)}` (ALTER ROLE не приймає параметрів), лише якщо `new URL(runtimeUrl).username === 'app_runtime'`; пароль декодується з URL.
  - `readJournal`: `begin read only; set local role app_admin; select …; commit`. Немає таблиці (`42P01`) → `null`.
- [ ] **Step 4: Харнес і `db:demo` на одну реалізацію (Е8-Р2).** `baseline.test.ts`, `grants-parity.test.ts` і решта місць, що накочують КАНОН (`git grep -n "canonFiles\|applySqlFiles" packages/simplycms/test-harness scripts`), — через `applyMigrations`. Не-міграційний SQL — через `applySqlFiles`. `scripts/demo-db.mjs`: канон — `applyMigrations`, `demo-seed.sql` — як раніше. `fixtures/grants.ts`: `simplycms_migrations: { app_admin: ['SELECT'] }`. `baseline.test.ts:126`: `43 → 44` з коментарем «Е8: журнал `simplycms_migrations` (створює `applyMigrations`, не канон)» і ім'я в переліку очікуваних таблиць.
- [ ] **Step 5: Заморожування.** `tests/migrations-frozen.test.ts`: `FROZEN = { '0000_prelude.sql': '<sha256>', … '0004_functions.sql': '<sha256>' }` — суми фіксуються ПІСЛЯ Task 2; кожен файл існує й має свою суму; копії `template/db/migrations/0000…0004` — ті самі суми. `baseline.test.ts:52-60`: замість «рівно п'ять» — «перші п'ять — заморожені імена; решта матчить `/^\d{4}_[a-z0-9_]+\.sql$/` і сортується після `0004`». Коментар у `migrations/README.md`: правило заморожування й посилання на тест.
- [ ] **Step 6: Прогнати** БЛ. Мутації:
  - пробіл у кінець `0002_grants.sql` → FAIL `migrations-frozen`; відкат;
  - прибрати звірку сум перед накатом → FAIL кейсу «змінений файл + новий 0005»; відкат;
  - прибрати `pg_advisory_lock` → FAIL `migrate-lock`; відкат;
  - прибрати `set local role app_admin` у `readJournal` → FAIL «читає під app_runtime»; відкат;
  - синк пароля ставить `pwd + 'x'` → FAIL `migrate-password` (StoredKey не збігається); відкат;
  - прибрати нормалізацію CRLF → FAIL `migrate-files`; відкат;
  - прибрати грант журналу з `fixtures/grants.ts` → FAIL `grants-parity`; відкат.
- [ ] **Step 7: Commit** `feat(k3-e8): журнал міграцій simplycms/migrate, заморожування baseline`.

### Task 4: `simplycms db:apply`, `doctor --online`, прибирання psql-циклу

**Files:**
- Create: `packages/cli/src/db-apply.mjs`, `packages/cli/src/store-core.mjs` (`importFromStore`, перенесений з `theme-conformance-env.mjs:17-21` і переіспользований), `packages/cli/src/doctor-db-checks.mjs`
- Modify: `packages/cli/src/{index.mjs (COMMANDS, HELP),doctor.mjs,doctor-checks.mjs}`, `tests/cli-doctor.test.ts`, новий `tests/cli-db-apply.test.ts`
- Modify (тексти накату): `packages/create-simplycms-store/template/README.md:38-51`, `packages/create-simplycms-store/src/steps.mjs:116-134`, `packages/cli/src/db-diff.mjs:364-371`, `packages/cli/src/add-steps.mjs:~32`, `docs/architecture/{cli.md:175-179,278,data-layer.md:229,plugins.md}`, `packages/cli/README.md`, README шаблонів плагінів; `docs/tasks/platform-roadmap.md:1329-1357` (0.4.1-6…9 — позначити закритими з посиланням на цей план)

**Interfaces:**
- Consumes: `applyMigrations`, `readJournal`, `listMigrationFiles`, `pendingMigrations` (Task 3) через `importFromStore(storeRoot, 'simplycms/migrate')`.
- Produces: `simplycms db:apply [--dry-run|--check]`. Коди виходу: `0` — все накочено; `3` — `--check` і є ненакатані; `1` — помилка. Підключення лише `MIGRATION_DATABASE_URL` (env процесу > `.env.local` > `.env`, через `readStoreEnv`); `runtimeUrl` = `DATABASE_URL`, якщо заданий. `doctor --online`: рядки `db-reachable` і `migrations-journal` замість skip `db-online`; без `--online` skip лишається з новим текстом «увімкни `--online`».

- [ ] **Step 1: `tests/cli-db-apply.test.ts`** (ядро підміняється фейком через ін'єкцію в `run`):
  - без `MIGRATION_DATABASE_URL`, але з `DATABASE_URL` → exit 1, текст називає `MIGRATION_DATABASE_URL`, фейк не викликано (ніколи не падати назад на `DATABASE_URL`);
  - `--check` з `pending:['0005_x.sql']` → exit 3, у виводі ім'я файлу; `--dry-run` → фейк отримує `dryRun:true`;
  - помилка фейку з `postgres://owner:s3cr3t@h/db` у `message` → вивід не містить `s3cr3t`. CLI друкує `name`, `code` і `message`, пропущений через `redactUrls` (`scheme://user:***@host`); режиму «повний текст» немає. Мутація: друкувати сирий `message` → FAIL.
- [ ] **Step 2: `tests/cli-doctor.test.ts`:** без `--online` → рядок `db-online` зі статусом `skip` і текстом «`--online`»; з `--online` і фейком `pending:['0005_x.sql']` → `migrations-journal` = `warn` з іменем; журналу немає (`null`) → `error` «база без журналу»; БД недоступна → `db-reachable` = `error`, решта онлайн-рядків `skip` із причиною.
- [ ] **Step 3: Прогнати** → FAIL; **Step 4: Реалізувати.** `doctor --online` під'єднується з `DATABASE_URL` (а не `MIGRATION_DATABASE_URL`), таймаут з'єднання 3 с.
- [ ] **Step 5: Тексти накату.** Друкований шлях у всіх носіях — `pnpm simplycms db:apply` з `MIGRATION_DATABASE_URL` власника схеми. Перевірка: `git grep -nE "for f in .*\.sql|psql -f" -- ':!CHANGELOG.md' ':!docs/superpowers/**' ':!docs/tasks/**'` → порожньо або лише історичні розділи з позначкою.
- [ ] **Step 6: Прогнати** БЛ + живий прогін на харнесі: `pnpm harness:up`, скаффолд магазину в tmp (`--no-git`), `MIGRATION_DATABASE_URL=<harness>/e8_apply pnpm simplycms db:apply` → накат; повторний → «нічого накочувати»; `--check` → exit 0. Вивід — у звіт задачі. Мутація: у `db-apply.mjs` брати `DATABASE_URL`, коли немає `MIGRATION_DATABASE_URL` → FAIL першого кейсу; відкат.
- [ ] **Step 7: Commit** `feat(k3-e8): simplycms db:apply і doctor --online; накат лише командою`.

---

## Хвиля А2 — старт у проді

### Task 5: `scripts/start.mjs` з `process.execve`

**Files:**
- Create: `packages/create-simplycms-store/template/scripts/{start.mjs,start-core.mjs}`, `tests/start-core.test.ts`, `packages/simplycms/test-harness/pg/__tests__/start-migrate.test.ts`
- Modify: `server.mjs` (корінь; далі `pnpm template:sync`), `template/package.json.tpl` (`"start"` лишається `node server.mjs` для локального запуску; новий `"start:prod": "node scripts/start.mjs"`), `scripts/pilot-pack/build.mjs:79` (`startStore` → `node scripts/start.mjs` з `MIGRATION_DATABASE_URL`), `scripts/pilot-pack/gate-b.mjs`

**Interfaces:**
- Produces (`start-core.mjs`):
  ```js
  /** @returns {Promise<never|void>} — у проді не повертається: execve замінює процес */
  export async function runStart({ env, cwd, migrate, resolveDriverEnv, execve, log }) {}
  export const STRIPPED_ENV = ['MIGRATION_DATABASE_URL'];
  ```
  `start.mjs` читає лише `process.env` — `.env*` не читає (Е8-Б1): у проді env дає Dokploy, а локальний накат — `pnpm simplycms db:apply`, який `.env.local` читає. Це ж — рядком у `ENVIRONMENT.md` §2.
  Порядок: `resolveDriverEnv(env)` (часткова група → вихід 1 до накату; `warnings` ігнорує — їх друкує бандл, Е8-Р7′) → якщо задано `MIGRATION_DATABASE_URL` → `migrate({ connectionString, dir: join(cwd,'db/migrations'), runtimeUrl: env.DATABASE_URL, log })`; помилка → вихід 1 → `execve(process.execPath, [process.execPath, join(cwd,'server.mjs')], envWithout(STRIPPED_ENV))`. Немає `process.execve` → вихід 1 з текстом «потрібен Node ≥ 24 (process.execve); стартова команда — `node scripts/start.mjs`».
- `server.mjs`: при наповненні з `.env.local`/`.env` пропускає ключі `STRIPPED_ENV` (дублікат списку в `server.mjs` з коментарем-посиланням на `start-core.mjs` + тест парності двох списків); ядра не імпортує (Е8-Р7′): перевірку груп env робить хост `src/server.ts` на верхньому рівні бандла, а `server.mjs` ловить помилку `await import('./dist/server/server.js')` — `code === 'SIMPLYCMS_DRIVER_ENV'` → `console.error(message)` без стеку, інша помилка → повністю зі стеком; обидві → `process.exit(1)` до `listen`. Попередження «пошта не налаштована: листи лише в лозі сервера» друкує бандл, один раз і лише при `NODE_ENV === 'production'`.

- [ ] **Step 1: `tests/start-core.test.ts`** (фейки): часткова група → `migrate` і `execve` не викликані, код 1; є `MIGRATION_DATABASE_URL` → `migrate` викликано з `runtimeUrl === env.DATABASE_URL`, далі `execve` з env без `MIGRATION_DATABASE_URL`, решта ключів на місці; немає змінної → `migrate` не викликано, `execve` викликано; `migrate` кидає → `execve` не викликано, код 1, пароль із `MIGRATION_DATABASE_URL` у виводі відсутній; `execve === undefined` → код 1, текст «Node ≥ 24».
- [ ] **Step 2: Кейс `server.mjs`** (у `tests/server-smoke.test.mjs` або новий): tmp-магазин з `.env.local`, що містить `MIGRATION_DATABASE_URL=postgres://owner:s3cr3t@x/db` → дочірній `node server.mjs` з фейковим `dist/server/server.js` (хендлер віддає `JSON.stringify(Object.keys(process.env))`) → у відповіді ключа немає. Другий кейс: `S3_BUCKET` у env без решти → процес виходить ненульовим кодом до прослуховування порту, stderr містить `S3_ENDPOINT` і не містить значення `S3_BUCKET`.
- [ ] **Step 3: `start-migrate.test.ts`** (`test:schema`): чиста БД → `runStart` зі справжнім `applyMigrations` і фейковим `execve` → журнал повний, `execve` отримав env без змінної.
- [ ] **Step 4: Прогнати** → FAIL; **Step 5: Реалізувати.**
- [ ] **Step 6: Gate B на `start.mjs` (Е8-Р6).** `startStore` запускає `node scripts/start.mjs` з `MIGRATION_DATABASE_URL = PILOT_DATABASE_URL`. Після `/api/health` на Linux: читає `/proc/<child.pid>/environ` (PID той самий — execve замінює образ процесу), розбиває за `\0`, асертить відсутність `MIGRATION_DATABASE_URL=`; `/proc/<pid>/cmdline` містить `server.mjs`. Не Linux → `skip` з причиною у звіті гейту. Лог старту містить рядок «нічого накочувати» (БД уже накочена `db:demo` через `applyMigrations`).
- [ ] **Step 7: Прогнати** `pnpm template:sync`, БЛ + `pnpm pilot` (повний, з харнесом: `pnpm harness:up && pnpm db:demo --name e8_pilot`, `PILOT_DATABASE_URL`). Мутації: прибрати фільтр `STRIPPED_ENV` у `server.mjs` → FAIL кейсу `.env.local`; відкат. Замінити в `start-core` `execve` на `spawn` (батько живий) → Gate B FAIL на `cmdline`/`environ`; відкат.
- [ ] **Step 8: Commit** `feat(k3-e8): прод-старт scripts/start.mjs — накат і execve без пароля власника`.

### Task 6: Ідентифікатор збірки, `/api/health`, застарілі чанки

**Files:**
- Create: `packages/simplycms/src/vite/{index.ts,build-id.ts}` (субшлях `simplycms/vite`, чекліст), `packages/simplycms/src/runtime/stale-chunk.ts` (+ тест), `packages/simplycms/src/runtime/build-id.ts`
- Modify: `vite.config.ts` (корінь), `packages/create-simplycms-store/template/vite.config.ts`, `tests/pilot/store-template/vite.config.ts` (паритет `tests/create-store-template-parity.test.ts:88-108`), `packages/simplycms/routes/storefront/api/health.tsx`, `src/client.tsx` (→ `template:sync`), `scripts/pilot-pack/gate-b.mjs:157-165` (асерт `/api/health`)

**Interfaces:**
- Produces: `resolveBuildId(env, { command, cwd }): string` — каскад `BUILD_ID` → `SOURCE_COMMIT` (перші 12) → `git rev-parse --short HEAD` (лише `command==='build'`) → `t<base36 часу>`; у dev → `'dev'`; мемоїзується в модулі й записується в `process.env.BUILD_ID`, щоб SSR- і клієнтський проходи мали один id. Плагін `simplycmsBuildInfo()` додає `define: { __SIMPLYCMS_BUILD_ID__: JSON.stringify(id) }`. `BUILD_ID` у рантаймі ядра: `export const BUILD_ID = typeof __SIMPLYCMS_BUILD_ID__ === 'string' ? __SIMPLYCMS_BUILD_ID__ : 'dev'` (`runtime/build-id.ts`, `declare const` у тому ж файлі).
- `/api/health` додає поле `build: BUILD_ID`; у файлі роуту лишається єдиний export `Route` (інваріант Gate C, коментар `health.tsx:13-19`).
- Стейл-чанк (`simplycms/runtime`, client-safe): `isStaleChunkError(e: unknown): boolean` (префікси Chromium/Firefox/Safari/Vite CSS з `klasnakasa/apps/web/src/lib/stale-chunk.ts:20-33`), `reloadOnceForStaleChunk(e, deps?): boolean` (ключ `simplycms:chunk-reload:<build>:<message>` у `sessionStorage`, офлайн → `false`, виняток сховища → `false`, модульний прапорець «вже перезавантажуємо»), `installStaleChunkGuard(win: Window): void` (`vite:preloadError` → `preventDefault`, якщо перезавантаження почалось). `src/client.tsx` кличе `installStaleChunkGuard(window)` до гідрації.

- [ ] **Step 1: Тести.** `build-id`: шість гілок каскаду (з фейковим `execSync`), мемоїзація. `stale-chunk`: перший виклик → `reload` один раз і `true`; другий у тому ж документі → `true` без другого `reload`; та сама помилка після «перезавантаження» (новий модуль, той самий `sessionStorage`) → `false`; інший `build` → знову `true`; `online()===false` → `false`; `setItem` кидає → `false`; не-чанкова помилка → `false`.
- [ ] **Step 2: Прогнати** → FAIL; **Step 3: Реалізувати**, `pnpm template:sync`.
- [ ] **Step 4: Gate B.** Пілот збирається з `BUILD_ID=e8-<random>`; асерт `/api/health` → `build === той рядок`. Це доказ, що `define` доходить до коду ядра в `node_modules`, а не припущення. Якщо не доходить — до автора плану: альтернатива (запис id у файл поруч із `dist/server`) — рішення архітектора.
- [ ] **Step 5: Прогнати** БЛ + `pnpm pilot`. Мутації: прибрати `define` у шаблонному `vite.config.ts` (і в оверлеї) → Gate B FAIL (`build === 'dev'`); відкат. Прибрати `sessionStorage`-сторож → FAIL кейсу «та сама помилка після перезавантаження»; відкат.
- [ ] **Step 6: Commit** `feat(k3-e8): ідентифікатор збірки в /api/health, сторож застарілих чанків`.

### Task 7: Стиснення статики і 413/411 без закриття з'єднання

**Files:**
- Create: `packages/simplycms/src/vite/precompress.ts` (+ тест) — лише якщо вимір Step 1 підтвердить нуль; `tests/server-body-limit.test.mjs`
- Modify: шаблонний і оверлейний `vite.config.ts`, `scripts/pilot-pack/gate-b.mjs` (асерт стиснення), `docs/architecture/test-contours.md` §3 (B)

**Interfaces:**
- Produces: `precompressAssets({ minBytes = 1024, exts = ['.js','.css','.svg','.json','.txt','.xml','.html'] }): Plugin` — у `closeBundle` клієнтського оточення пише `<file>.br` (`zlib.brotliCompressSync`, quality 11) і `<file>.gz` (`gzipSync`, level 9) поруч з асетом, лише коли стиснене менше оригіналу.

- [ ] **Step 1: Вимір.** Зібраний пілот (`pnpm pilot --keep`), запущений `server.mjs`: `curl -sI -H 'Accept-Encoding: br' <origin>/assets/<entry>.js | grep -i content-encoding`. Записати результат у звіт. Порожньо → Step 2; `br` → прекомпресія не потрібна, Step 2 пропустити з причиною в звіті й у `test-contours.md`.
- [ ] **Step 2: Плагін.** Тест: tmp-тека з файлом 4 КБ і 100 Б → поруч з'являються `.br`/`.gz` лише для першого, і розпаковуються в ті самі байти. Підключити в шаблоні й оверлеї.
- [ ] **Step 3: Gate B.** Асерт: `GET /assets/<entry>.js` з `Accept-Encoding: br` → `content-encoding: br`; без заголовка → без `content-encoding`.
- [ ] **Step 4: 413/411 через справжній `server.mjs`.** `tests/server-body-limit.test.mjs`: tmp-магазин із фейковим хендлером, що повертає `checkBodyLimit(request)` (імпорт з ядра) або 200; сирий сокет (`node:net`) шле `POST /_serverFn/x` з `Content-Length: 10485760` і перші 64 КБ тіла → відповідь 413, заголовок `connection` не `close`; та сама схема для chunked без `Content-Length` з `content-type: multipart/form-data` → 411. Результат виміру (ставить Node `Connection: close` сам чи ні) — у звіт. Якщо ставить — `sendWebResponse` у `server-runtime.mjs` явно `res.shouldKeepAlive = true` для 411/413 з коментарем `UPSTREAM:` і записом у реєстр `upstream-workarounds.md`; рішення про форму — до архітектора.
- [ ] **Step 5: Прогнати** БЛ + `pnpm pilot`. Мутації: прибрати плагін з оверлею → Gate B FAIL на `content-encoding`; відкат. Додати `connection: close` у `reject()` (`body-limit.ts:43-48`) → `server-body-limit` FAIL; відкат.
- [ ] **Step 6: Commit** `feat(k3-e8): прекомпресія статики за виміром, 413/411 без закриття з'єднання`.

---

## Хвиля А3 — сховище S3

### Task 8: Драйвер `s3`, вибір за env, контрактний набір, Garage у стенді

**Files:**
- Create: `packages/simplycms/src/storage/{s3.ts,select.ts}`, `packages/simplycms/test-harness/storage/{contract.ts,local-fs.contract.test.ts,s3.contract.test.ts}`, `docker/garage/garage.dev.toml`
- Modify: `packages/simplycms/src/storage/{local-fs.ts:121-132 (getMediaDriver → select.ts),serve.ts:151-155,index.ts}`, `packages/simplycms/package.json` (`dependencies.aws4fetch: "1.0.20"`), `scripts/{harness-up.mjs,harness-env.mjs}`, `.github/workflows/workflow.yml` (job Schema), `vitest.schema.config.ts` (include `test-harness/storage/**`), `docs/architecture/{storage.md,upstream-workarounds.md}`, `packages/simplycms/src/storage/__tests__/serve.test.ts`

**Interfaces:**
- Produces: `s3Driver(cfg: Extract<MediaEnv,{driver:'s3'}>): MediaStorageDriver` — `aws4fetch` `AwsClient({ accessKeyId, secretAccessKey, region, service:'s3' })`, path-style `${endpoint}/${bucket}/${key.split('/').map(encodeURIComponent).join('/')}`, лінивий клієнт. `put`: `HEAD` → `200` → `MediaKeyCollisionError` (best-effort: коментар про гонку й `UPSTREAM:GARAGE-INM-1`), далі `PUT`. `delete`: `!ok && status !== 404` → помилка. `open`: `404` → `null`; `size` з `content-length`; без нього — `null` недопустимий контрактом (`MediaObject.size: number`), тож `HEAD` перед `GET` або читання `content-length` з `GET` з помилкою «S3 не віддав розмір» — на вибір виконавця з тестом. Помилки — `S3 <METHOD> не вдався: <status>`, без тіла відповіді й ключів доступу.
- `getMediaDriver()` (той самий експорт, тепер у `select.ts`): `resolveDriverEnv(process.env).media` → `s3Driver` або `localFsDriver(root)`, мемоїзація на процес.
- `runDriverContract(name: string, make: () => Promise<{ driver: MediaStorageDriver; cleanup(): Promise<void> }>): void` — спільний набір: колізія ключа → `MediaKeyCollisionError` без перезапису; `delete` відсутнього — успіх; `open` відсутнього → `null`; `put`→`open` — ті самі байти, `size` = довжина, два виклики `stream()` дають два повних стріми. Ключі — `mediaKey('image/png')` (унікальні між прогонами: Garage стенду живе між ними).
- `harness:up` додає контейнери `simplycms-harness-garage` (`dxflrs/garage:v2.4.1`, `-p 4192:3900`, `/garage server --single-node --default-bucket`, `GARAGE_DEFAULT_{ACCESS_KEY,SECRET_KEY,BUCKET}`, конфіг із `docker/garage/garage.dev.toml`, готовність — `docker logs … | grep 'S3 API server listening'` до 60 с) і `simplycms-harness-mailpit` (`axllent/mailpit:<пін>`, `-p 54325:1025 -p 54326:8025`, готовність — `GET /api/v1/info`). `.env.harness` += `S3_*`, `HARNESS_SMTP_URL=smtp://localhost:54325`, `HARNESS_MAILPIT_URL=http://localhost:54326`. Порт 4190 заборонено (`UPSTREAM:FETCH-BAD-PORT-1`).

- [ ] **Step 1: Контрактний набір і `local-fs.contract.test.ts`.** Перенести 4 спільні кейси з `local-fs.test.ts` у `contract.ts`; local-fs-специфіку (шпигун `writeFile`, `.tmp-*`, traversal) лишити в `local-fs.test.ts`. Прогнати → PASS для local-fs.
- [ ] **Step 2: `s3.contract.test.ts`** → FAIL (драйвера немає). Без `S3_*` у `.env.harness` тест падає з текстом «запусти `pnpm harness:up`», а не skip: контур `test:schema` і так вимагає стенд.
- [ ] **Step 3: Реалізувати** `s3.ts`, `select.ts`; `harness:up`/`harness:down` з Garage і Mailpit; CI Schema — `docker run`-кроки Garage і Mailpit до тестів, env job-у з тими ж ключами.
- [ ] **Step 4: 503 замість 404 (Е8-Р14).** `serve.test.ts`: драйвер, чий `open` кидає `new Error('S3 GET не вдався: 500')` → 503, `console.error` викликано один раз з ключем, без `S3_SECRET_KEY`-маркера; `open → null` → 404 без `console.error`.
- [ ] **Step 5: Реєстр і канон.** `upstream-workarounds.md`: `GARAGE-INM-1` (`If-None-Match: *` ігнорується → перевірка `HEAD` перед `PUT`, best-effort; тригер перегляду — бамп Garage) і `FETCH-BAD-PORT-1` (4190 у WHATWG bad ports). Маркери `UPSTREAM:` у коді й у `harness-up.mjs`. `storage.md`: вступ (два драйвери), новий розділ «Вибір драйвера» (групи env, «все або нічого», `getMediaDriver`), «Межі» (best-effort колізія в S3, 503 проти 404), «Правила» (`S3_*` не читати на модуль-рівні), контрактний набір.
- [ ] **Step 5а: Gate SB (Е8-О6).** `aws4fetch` — нова `dependency` ядра, тож вклеїться в серверний бандл, а Gate SB червоніє на кожному новому пакеті. `pnpm pilot:pack` → вимір у звіт; запис у `scripts/pilot-pack/server-bundle-allowlist.mjs` з перевіреною причиною (ESM-only, без CJS-входу — звірити `package.json` пакета). Мутація: прибрати запис → Gate SB FAIL; відкат.
- [ ] **Step 6: Прогнати** `pnpm harness:up`, БЛ + `pnpm pilot:pack`. Мутації: прибрати `HEAD` перед `PUT` → `s3.contract` FAIL на колізії; відкат. `open` повертає `null` на 500 → FAIL «503»; відкат. У `select.ts` повернути `localFsDriver()` безумовно → новий юніт `select.test.ts` («усі `S3_*` → драйвер s3», за типом/маркером) FAIL; відкат.
- [ ] **Step 7: Commit** `feat(k3-e8): драйвер s3 на aws4fetch, вибір за env, контрактний набір проти Garage`.

---

## Хвиля А4 — пошта

### Task 9: Порт `simplycms/mail`, драйвери `smtp` і `log`

**Files:**
- Create: `packages/simplycms/src/mail/{index.ts,types.ts,transport.ts,smtp.ts,log.ts}`, `packages/simplycms/src/mail/__tests__/transport.test.ts`, `packages/simplycms/test-harness/mail/smtp.contract.test.ts`, `packages/cli/src/doctor-mail-check.mjs`
- Modify: `packages/simplycms/package.json` (`peerDependencies.nodemailer: "10.1.0"`, `devDependencies`), кореневий `package.json` (хост `src/` монорепо — Е8-Б3), `template/package.json.tpl`, `tests/pilot/store-template/package.json`, `contracts/server-only.ts` (`SERVER_ONLY` += `mail`; `SERVER_ONLY_DEPS` += `{ name: 'nodemailer' }`), `packages/cli/src/doctor-checks.mjs` (№14 поруч із №13), `tests/pg-peer-parity.test.ts` (узагальнити на `nodemailer` або сусідній тест), реєстри субшляху

**Interfaces:**
- Produces:
  ```ts
  export type MailMessage = { readonly to: string; readonly subject: string; readonly text: string; readonly html?: string; readonly replyTo?: string };
  export type MailTransport = { readonly driver: 'smtp' | 'log'; send(m: MailMessage): Promise<void> };
  export function getMailTransport(): MailTransport;     // resolveDriverEnv(process.env).mail, мемоїзація
  export function smtpTransport(cfg: { url: string; from: string }): MailTransport;
  export function logTransport(log?: (line: string) => void): MailTransport;
  ```
  `log` поза продом друкує `Кому`, `Тема` і `text` (поведінка `stubSendAuthEmail`, `auth/send-email.ts:21-26`) — dev-канал, посилання там свідомо. У `NODE_ENV=production` — лише `Кому`, `Тема` і тип листа, без тіла й посилань (Е8-С1). Тип листа передається полем `MailMessage.kind?` або параметром `send` — на вибір виконавця, з тестом. `smtp` — `nodemailer.createTransport(url)`, `sendMail({ from, to, subject, text, html, replyTo })`; помилка — `SMTP: <code>` без URL і пароля.

- [ ] **Step 1: Юніт `transport.test.ts`:** `logTransport` поза продом друкує три поля; у `NODE_ENV=production` вивід не містить ні `text`, ні `html`, ні URL з тіла (маркер `https://shop.test/auth/set-password?token=T0K3N`); `getMailTransport()` без env → `driver:'log'`; з `SMTP_URL`+`MAIL_FROM` → `driver:'smtp'`; `smtpTransport` на недоступний порт → помилка без пароля з URL.
- [ ] **Step 2: `smtp.contract.test.ts`** (контур `test:schema`, Mailpit із Task 8): `send({to,subject,text,html,replyTo})` → `GET HARNESS_MAILPIT_URL/api/v1/messages` має лист з тими полями й `From` = `MAIL_FROM`. Перед кейсом — `DELETE /api/v1/messages`.
- [ ] **Step 3: Прогнати** → FAIL; **Step 4: Реалізувати**; `pnpm install` → `--frozen-lockfile`.
- [ ] **Step 5: Вимір Gate SB (Е8-Р11).** `pnpm pilot:pack` → у звіт: чи `nodemailer` у `bundle-stats.ssr.json`. Очікування гіпотези: не вклеєний (пряма залежність магазину). Вклеєний → до архітектора, не додавати в allowlist самому. Doctor №14 `mail-driver`: `nodemailer` у залежностях магазину в межах peer ядра (за зразком `checkPgDriver`).
- [ ] **Step 5а: Режим «прод» (А §3, §5; Е8-Р17).** Режим `doctor` (а згодом `status`, Task 19) = прапорець `--production` || `isProductionRuntime(process.env)` з `simplycms/env` (через `importFromStore`; власної перевірки `NODE_ENV` у CLI немає). Перший рядок звіту — «режим: production» або «режим: розробка (для перевірки проду — `--production`)». У production `mail.driver==='log'` → `error` «пошта не налаштована: у проді листи губляться в лозі»; у розробці — `warn`. Коди виходу не змінюються; `status --hook` прапорця не отримує. Тест у `cli-doctor.test.ts`: log + `--production` → error, exit 1; без прапорця → warn, exit 0; `NODE_ENV=production` без прапорця → error. Мутація: ігнорувати прапорець → FAIL; відкат.
- [ ] **Step 6: Прогнати** `pnpm harness:up`, БЛ + `pnpm pilot:pack`. Мутації: прод-режим `logTransport` друкує `text` → FAIL «прод без тіла»; відкат. `smtpTransport` не передає `replyTo` (або `from` = `to`) → `smtp.contract` FAIL; `getMailTransport()` повертає `log` при заданих `SMTP_URL`+`MAIL_FROM` → `transport.test` FAIL; відкат обох. Прибрати `nodemailer` з `template/package.json.tpl` → doctor-тест №14 FAIL і паритет-тест FAIL; відкат. Додати `import 'simplycms/mail'` у клієнтський модуль → лінт `no-server-only-in-client` FAIL; відкат.
- [ ] **Step 7: Commit** `feat(k3-e8): порт пошти simplycms/mail — smtp і log`.

### Task 10: Outbox `mail_outbox` — перша append-only міграція

**Files:**
- Create: `packages/simplycms/src/schema/mail.ts` (+ реекспорт у `schema/index.ts`), `packages/simplycms/migrations/0005_mail_outbox.sql` (через `pnpm db:diff mail_outbox`, далі ручне доповнення грантів і RLS), `packages/simplycms/src/mail/outbox.ts`, `packages/simplycms/test-harness/pg/__tests__/mail-outbox.test.ts`
- Modify: `contracts/entities.ts` (`mailOutbox: 'mail_outbox'`), `fixtures/grants.ts`, `baseline.test.ts` (лічильники таблиць/політик: канон тепер 6 файлів), `drizzle/meta/*` (як згенерує `db:diff`)

**Interfaces:**
- Produces: таблиця `mail_outbox` — `id uuid PK` (без default), `kind text not null` (`'password_reset'|'owner_invite'|'order_customer'|'order_owner'`), `message jsonb not null` (`MailMessage`), `requested_at timestamptz default now() not null`, `attempts integer default 0 not null`, `last_error text`; RLS `for all to app_admin`; гранти `select, insert, update, delete` лише `app_admin`.
  ```ts
  export function enqueueMail(db: ActorDb, items: readonly { kind: MailKind; message: MailMessage }[]): Promise<string[]>; // у транзакції викликача
  export function scheduleMail(items: …): Promise<string[]>;                // власна asService-транзакція; збій запису КИДАЄ — лист, що не потрапив у чергу, інакше зник би без сліду
  export function deliverMail(ids: readonly string[], transport?: MailTransport): Promise<void>; // після COMMIT, не кидає, + добір ≤5 хвостів старших 1 хв
  export function retryMail(limit?: number, transport?: MailTransport): Promise<{ sent: number; failed: number }>;
  export type MailOutboxRow = { id: string; kind: MailKind; requestedAt: Date; attempts: number; lastError: string | null }; // БЕЗ message
  export function listMailOutbox(db: ActorDb): Promise<MailOutboxRow[]>;
  export const MAIL_RETRY_BATCH = 5;
  ```
  Трикрокова схема без локу на час мережі — дзеркало `processTail` (`storage/erasures.ts:139-171`): `for update skip locked` + бронь `requested_at=now()` → `transport.send` поза транзакцією → успіх: `delete`; збій: `attempts+1`, `last_error` = `redactUrls(error.message)` обрізаний до 500 символів, без полів `message` листа. На відміну від `scheduleMediaErasures`, `scheduleMail` кидає: для стирання збій постановки — це хвіст прибирання, а для пошти — втрачений лист.

- [ ] **Step 1: `mail-outbox.test.ts`** (фейковий транспорт): успіх → рядка немає; збій → `attempts=1`, `last_error` без тексту листа; транспорт кидає `new Error('connect smtp://u:P4SS@h:587 failed')` → `last_error` не містить `P4SS`; `scheduleMail` при недоступній таблиці (тестовий тригер, що кидає) → відхиляє проміс; `deliverMail` після ROLLBACK транзакції-власниці → нічого не надіслано (`blockCommitOn` з `fixtures/commit-block`); добір: два старі хвости + новий лист → надіслано три; `listMailOutbox` → рядки без поля `message` (асерт `Object.keys`); під `app_user` `select from mail_outbox` → `permission denied`.
- [ ] **Step 2: Прогнати** → FAIL; **Step 3:** схема → `pnpm db:diff mail_outbox` → файл `0005_mail_outbox.sql`; дописати в нього RLS, політику, гранти (ручна частина — окремим блоком із заголовком «ручне: гранти й RLS», правило `data-layer.md:216-217`); `outbox.ts`; `pnpm template:sync`.
- [ ] **Step 4: Прогнати** БЛ. Мутації: не видаляти рядок після успіху → FAIL «успіх → рядка немає»; відкат. Додати `message` у `listMailOutbox` → FAIL; відкат. Правка `0001_init.sql` замість нового файлу → `migrations-frozen` FAIL (перевірити, що заморожування реально стереже цей шлях); відкат.
- [ ] **Step 5: Commit** `feat(k3-e8): outbox пошти mail_outbox — перша append-only міграція 0005`.

### Task 11: Листи auth на порту, локаль, i18n

**Files:**
- Modify: `packages/simplycms/src/auth/{send-email.ts,invite-email.ts,instance.ts:59-92,invite.ts:81-120}`, `packages/simplycms/src/site/` (`declareStoreLocale`, `getStoreLocale` поруч із `declareBuiltThemes`), `src/server.ts` (→ `template:sync`), `packages/simplycms/src/auth/index.ts:60-70` (прибрати реекспорти `stubSendAuthEmail`, `SendAuthEmail`, `SendInviteEmail`, `InviteEmail`; додати нові), `packages/create-simplycms-store/template/scripts/{owner-invite.mjs,owner-invite-core.mjs}` (обгортка розбирає `--print-link` і передає в ядро), `packages/create-simplycms-store/template/README.md:53-75` і `tests/create-store-invite-setup.test.ts:28-31` (README більше не обіцяє «лише консоль»: описує три гілки Е8-С2; асерт `/консоль/` замінюється асертами на `SMTP_URL` і `--print-link`), `packages/simplycms/src/i18n/catalogs/{uk,en}/mail.ts` + обидва `index.ts`, `tests/i18n-coverage/scan.ts:62` (`SCANNED_ROOTS` += `packages/simplycms/src/mail`, `packages/simplycms/src/auth`)
- Create: `packages/simplycms/src/mail/render/{auth.ts,layout.ts}` (+ тести)

**Interfaces:**
- Produces: `renderPasswordResetMail({ to, url, storeName, t }): MailMessage`, `renderOwnerInviteMail({ to, url, storeName, ttlMs, t }): MailMessage` — чисті функції; `t = createTranslator(getStoreLocale())`; `storeName` = `profile.name || 'SimplyCMS'` з `readStoreProfile`. `declareStoreLocale(locale: Locale): void`; `getStoreLocale(): Locale` — незадеклароване → `'uk'` + одне `console.warn` на процес.
- Тип `SendAuthEmail` і `SendInviteEmail` зникають; `InviteEmail` → `MailMessage`. `sendResetPassword` (Е8-О1): guard → `await scheduleMail([{kind:'password_reset', message}])` (швидкий запис у БД) → `void deliverMail(ids).catch(logWithoutSecrets)` — БЕЗ `await`. BA кличе колбек лише для наявного email, і затримка SMTP у відповіді дає перебір користувачів за часом; BA прямо радить не чекати відправки. `issueOwnerInvite` приймає `schedule?: typeof scheduleMail` (дефолт — справжній) замість `sendEmail`. `owner:invite` ставить лист у чергу й доставляє через порт. Посилання у виводі — лише за Е8-С2: драйвер `log` поза продом або прапорець `--print-link`; зі SMTP — «лист надіслано на <email>»; прод без SMTP і без `--print-link` — код 1 з поясненням.

- [ ] **Step 1: Тести.** Рендер: обидві функції з `t` для `uk` і `en` дають тему й текст з `storeName` і `url`, HTML екранує `<` у `storeName`. `instance.test`/харнес: `requestPasswordReset` → у `mail_outbox` з'явився і зник рядок `password_reset`, фейковий транспорт отримав лист з `storeName` профілю. `owner-invite-core`, три гілки Е8-С2: (1) SMTP → вивід «лист надіслано на …» без посилання й токена; (2) `log` поза продом → вивід має посилання; (3) `NODE_ENV=production` + `log` без `--print-link` → код 1, текст називає `SMTP_URL`, `MAIL_FROM` і `--print-link`, посилання немає; з `--print-link` → посилання є. Мутація: друкувати посилання в гілці SMTP → FAIL (1). CLI-обгортка (`owner-invite.mjs`, дочірній процес із фейковим ядром через ін'єкцію або з `simplycms/auth` харнесу): `--print-link` доходить до ядра — без прапорця в прод-гілці код 1, з ним — посилання. Мутація: обгортка не передає прапорець → FAIL; відкат. `getStoreLocale()` без декларації → `'uk'` і рівно одне попередження за два виклики. Таймінг (Е8-О1): фейковий транспорт спить 2 с → `requestPasswordReset` повертається раніше, ніж транспорт завершився (асерт за промісом-маркером транспорту, не за годинником); рядок у `mail_outbox` уже є на момент повернення.
- [ ] **Step 2: Прогнати** → FAIL; **Step 3: Реалізувати**, ключі `mail.*` в обох каталогах (тести парності `tests/i18n-catalog-parity.test.ts` і `catalog-integrity.test.ts`), `pnpm template:sync`.
- [ ] **Step 4: Прогнати** БЛ. Мутації: додати `await` перед `deliverMail` у `sendResetPassword` → FAIL таймінгу; відкат. Кириличний літерал у `render/auth.ts` → `i18n-coverage` FAIL (доводить, що `SCANNED_ROOTS` справді покриває `mail`); відкат. `instance.ts` знову на `stubSendAuthEmail` → харнес-тест скидання FAIL; відкат.
- [ ] **Step 5: Commit** `feat(k3-e8): листи скидання і запрошення через порт пошти, локаль хоста, i18n`.

### Task 11b: Інвайт видає роль лише після прийняття, скидання гасить сесії (Р19, К1)

Аудит (S2-01/S2-02, підтверджено наживо): хто завгодно реєструється на пошту власника (`POST /api/auth/sign-up/email`, підтвердження не вимагається), а `owner:invite` знаходить цей акаунт (`issueOwnerInvite` → `findUserIdByEmail`) і одразу вставляє йому роль `admin` (`invite-store.ts:55-60`). Ролі читаються з БД на кожен запит (`auth/session.ts:31-60`, `readUserRoles` → `readSessionSubject`), тож живі сесії зловмисника стають адмінськими негайно. Прийняття запрошення (`accept-invite.ts:68-72`, штатний `resetPassword` Better Auth) сесій не гасить: `revokeSessionsOnPasswordReset` вимкнено, а BA 1.7.7 видаляє сесії лише за цією опцією (`better-auth/dist/api/routes/password.mjs:169`: `internalAdapter.deleteUserSessions(userId)`). Р19 діє незалежно від Р30 (Task 12b). Будуй поверх закоміченого Task 11: `invite.ts`, `owner-invite-core.mjs`, `owner-invite.mjs` він переписує.

**Files:**
- Modify: `packages/simplycms/src/auth/invite-store.ts` (`issueAdminInvite:41-71` — без вставки ролі `:55-60`; новий метод видачі ролі), `packages/simplycms/src/auth/invite.ts` (`OwnerInviteStore:21-41` — докблок «двох окремих кроків немає свідомо» тепер хибний, переписати з причиною Р19; `issueOwnerInvite` — ознака наявного непідтвердженого акаунта в результаті), `packages/simplycms/src/auth/accept-invite.ts:47-81`, `packages/simplycms/src/auth/instance.ts` (`emailAndPassword`), `packages/simplycms/src/storefront-routes/pages/AuthSetPassword.tsx:50-51` (коментар), `packages/create-simplycms-store/template/scripts/owner-invite-core.mjs` (тексти ~`:91-95` «роль admin закріплена» / «роль admin на місці» стають хибними; попередження), `packages/create-simplycms-store/template/scripts/owner-invite.mjs:11-29` (К1), `docs/superpowers/specs/2026-08-03-create-store-owner-bootstrap-design.md` §4.2 (рядки 211-225; це не спеки А/Б, тож правило «спеки лише в Task 25» на неї не поширюється — правка прямо названа в Р19)
- Test: `packages/simplycms/test-harness/pg/__tests__/owner-invite-flow.test.ts` (нові кейси; наявний `:144` «роль admin дає лише запрошення…» перевірити на нову семантику), `tests/owner-invite.test.ts` (кейси `:104` «новий email: користувач, роль admin…» і `:130` «одна роль» — ролі після випуску більше немає; нове попередження), новий `tests/owner-invite-env.test.ts` (К1)
- `template/scripts/*` — файли шаблону без синку (Global Constraints), `pnpm template:sync` для них не потрібен.

**Interfaces:**
- Consumes: BA 1.7.7 `emailAndPassword.revokeSessionsOnPasswordReset` і `context.internalAdapter.deleteUserSessions(userId)` (звір у `node_modules/better-auth/dist`, не з пам'яті); `ADMIN_ROLES_LOCK`, `advisoryXactLock` (як у `issueAdminInvite:46`).
- Produces:
  - `issueAdminInvite` — лише токен, під тим самим `ADMIN_ROLES_LOCK` і перевіркою бану (`'banned'` → нічого не записано). Роль не вставляє.
  - Новий метод сховища (назва на вибір виконавця, напр. `grantAdminRole({ userId }): Promise<'granted' | 'banned'>`) — `advisoryXactLock(ADMIN_ROLES_LOCK)` першим запитом, `FOR SHARE` на `users`, перевірка `bannedAt`, `insert … on conflict do nothing` у `user_roles`. Це той самий інваріант Е6г-4/Е6г-19, що зараз у `issueAdminInvite`, — переїжджає разом із вставкою ролі.
  - `acceptOwnerInvite`: `verifyOwnerInvite` → обмінний токен → `resetPassword` (BA гасить сесії за опцією) → явне `deleteUserSessions(verified.userId)` (страховка, якщо опцію колись вимкнуть) → `emailVerified: true` → видача ролі. Роль — лише після `response.ok`.
  - `createAuth`: `emailAndPassword.revokeSessionsOnPasswordReset: true`. Закриває обидва шляхи: прийняття запрошення йде через той самий BA `resetPassword`.
  - `OwnerInviteResult` += ознака «акаунт існував і `email_verified = false`» (назва на вибір виконавця). CLI для неї друкує дослівно: `Увага: акаунт уже існує й не підтверджений — роль буде видано лише після прийняття запрошення з цієї скриньки.` Це не відмова: код виходу як у звичайної гілки. Тексти «роль admin закріплена» / «роль admin на місці» замінити формулюванням, що не стверджує, ніби роль уже видано.
  - К1: `owner-invite.mjs` читає `.env.local`, потім `.env` через `node:util` `parseEnv` (або `process.loadEnvFile` з пропуском `ENOENT`) — паритет із `server.mjs:29-36`: реальний env процесу перемагає файли, `.env.local` перемагає `.env`, пишуться лише відсутні ключі. Власний цикл `owner-invite.mjs:19-25` лишає лапки (`DATABASE_URL="postgres://…"` → пул не підключиться), коментар у кінці рядка і префікс `export` у ключі.
- Рішення (рішення архітектора 2026-10-12, `rulings-plan-forks.md`): користувача забанили між випуском і прийняттям запрошення → `acceptOwnerInvite` повертає наявну причину `'not-found'`, нової причини не вводимо. Пароль на цей момент уже змінено, ролі немає, вхід спиняє хук бану сесії (`createSessionBanHook`).

- [ ] **Step 1: Тести.** Харнес `owner-invite-flow.test.ts`:
  - (1) пошту зайнято: самореєстрація `X` штатним BA signUp → сесія S1; `issueOwnerInvite(X)` → `readSessionSubject(S1).roles` без `admin`, у `user_roles` для цього `userId` немає `admin`;
  - (2) після (1) `acceptOwnerInvite` з токеном → `getSession(S1)` = `null`; новий вхід з новим паролем → сесія з `admin`;
  - (3) звичайне скидання: вхід → сесія S2 → `requestPasswordReset` + BA `resetPassword` → `getSession(S2)` = `null`;
  - (4) мутаційний контроль для (1): повернути вставку ролі в `issueAdminInvite` → (1) FAIL;
  - (5) мутаційний контроль для (2)/(3): прибрати `revokeSessionsOnPasswordReset` → (3) FAIL; прибрати опцію І явне `deleteUserSessions` в accept → (2) FAIL. Прибрати лише явне видалення → (2) лишається зеленим: це очікувано, бо BA гасить сесії сам, а явне видалення — страховка.
  - (6) BA відхиляє пароль (`password-rejected`, напр. закороткий) → ролі `admin` немає, токен запрошення спожито.
  - (7) бан між випуском і прийняттям → `{ ok: false, reason: 'not-found' }`, ролі `admin` немає.

  CLI (`tests/owner-invite.test.ts`): наявний непідтверджений акаунт → у виводі рядок попередження дослівно (див. Interfaces), код 0; новий email і наявний підтверджений → попередження немає; після випуску ролі `admin` у `user_roles` немає (кейси `:104`, `:130` переписати). К1 (`tests/owner-invite-env.test.ts`): `.env.local` з `DATABASE_URL="postgres://u:p@h:5432/db"`, `VITE_SITE_URL=http://localhost:3000 # коментар`, `export OWNER_EMAIL=me@example.com` → у `process.env` скрипта значення без лапок, без коментаря, ключ `OWNER_EMAIL` без `export`; реальний env процесу перемагає файл; `.env.local` перемагає `.env`. Спосіб спостереження — дочірній процес зі стабом ядра або винесений завантажувач у `template/scripts/`, на вибір виконавця, без реальної БД.
- [ ] **Step 2: Прогнати** `pnpm test:schema owner-invite-flow`, `pnpm test owner-invite` → FAIL.
- [ ] **Step 3: Реалізувати.** Коментар `AuthSetPassword.tsx:50-51` («BA гасить усі сесії користувача») посилається на опцію `revokeSessionsOnPasswordReset` у `createAuth` і на Р19: до цієї задачі він був хибним, бо опцію було вимкнено. Спека бутстрапу §4.2: пункт «роль призначена до першого кліку; отримати її може лише контролер поштової скриньки» замінити чинною моделлю. Роль видається лише після прийняття запрошення (одноразове посилання + встановлення пароля). Прийняття і будь-яке скидання пароля гасять усі сесії користувача. Самореєстрований непідтверджений акаунт на ту саму пошту ролі від випуску не отримує, CLI попереджає. Позначка «Амендмент 2026-10-12 (Р19)» з причиною: перехід на BA без підтвердження пошти зробив попередню модель хибною.
- [ ] **Step 4: Прогнати** БЛ + `pnpm test:schema`. Мутації (рядок у звіті на кожну): (4) і (5) зі Step 1; CLI не друкує попередження для непідтвердженого → FAIL кейсу попередження в `owner-invite.test.ts`; відкат. Повернути ручний цикл читання `.env` в `owner-invite.mjs` → FAIL `owner-invite-env` (кейс «лапки»); відкат. Видача ролі в accept ДО `resetPassword` → FAIL (6); відкат.
- [ ] **Step 5: Commit** `fix(k3-e8): роль власника лише після прийняття запрошення, скидання пароля гасить сесії (Р19, К1)`.

### Task А4-R: Раннер — origin з конфігу, стеля тіла, MEDIA_ROOT лише з резолвера (Р18б, Р20, Р22)

Fix-раунд після Task 11b і до Task 12/13. Три дефекти, кожен підтверджено наживо.
- **Р18(б), S3-01/S3-04.** `toRequestUrl` (`server-runtime.mjs:26-34`) будує URL запиту з `X-Forwarded-Proto`/`X-Forwarded-Host`/`Host`. Підроблений заголовок дає чужий origin у `request.url`. Звідти його бере Better Auth без `BETTER_AUTH_URL` (закрито Р18(а) у Task 11). Звідти ж його бере CSRF-перевірка Start: `createCsrfMiddleware` порівнює `Origin` з `new URL(request.url).origin` (`@tanstack/start-client-core/dist/esm/createCsrfMiddleware.js:23-26`, підключено в `src/start.ts:71`). Окремо `GET //evil//x` дає 308 на `evil` (`getNormalizedURL` → `Response.redirect(url, 308)`, `start-server-core@1.169.39/dist/esm/createStartHandler.js:281-284`).
- **Р20, S3-02 + S2-06.** Стеля тіла живе лише в `bodyLimitMiddleware`, а предикат `body-limit.ts:73` дивиться на сирий `pathname` `request.url`. Start визначає server function за нормалізованим URL (`createStartHandler.js:281,286`), тому `/%5FserverFn/<id>` обходить 413: +100 МБ RSS на голому Node. `/api/auth/*` стелі не має взагалі: better-call читає тіло до middleware. Chunked JSON — відкрите вікно START-BODY-1 (`docs/architecture/upstream-workarounds.md:145-…`).
- **Р22.** `mediaRoot()` (`storage/env.ts:17-19`) читає `process.env.MEDIA_ROOT` сирим і обходить правило «порожнє = не задано» резолвера (`env/resolve.ts:71-75`, `read`). `MEDIA_ROOT=""` (Dokploy зберігає порожній `KEY=`) → `resolve(cwd, '')` = корінь застосунку → `put` пише `<app>/db/<uuid>.webp` у теку деплою, і з контейнера дані губляться. Сире читання є у двох місцях: `storage/select.ts:12` (`… : mediaRoot()`) і дефолт параметра `localFsDriver(root = mediaRoot())` (`storage/local-fs.ts:52`). Експорт `mediaRoot` — `storage/index.ts:6`.

**Files:**
- Modify: `server-runtime.mjs` (корінь; `toRequestUrl:26-34`, `toWebRequest:45-58`), `server.mjs` (корінь; 400 на поганий request-target і 413 за `Content-Length` до виклику хендлера; передача origin сайту в раннер) → `pnpm template:sync` (копії `packages/create-simplycms-store/template/{server.mjs,server-runtime.mjs}` і `packages/cli/host/{server.mjs,server-runtime.mjs}` руками не правляться); `packages/simplycms/src/runtime/body-limit.ts:71-90` (предикат `:73`); `packages/simplycms/src/storage/{env.ts,select.ts,local-fs.ts,index.ts}`; `docs/architecture/upstream-workarounds.md` (запис START-BODY-1, `:145-…`); `docs/development/ENVIRONMENT.md` (абзац «Стеля тіла запиту», ~`:106-112`); `docs/architecture/storage.md` (правило кореня `local-fs`, якщо описане); `tests/upstream-tripwires.test.ts:81-100` (розтяжки START-BODY-1 — під новий предикат)
- Test: `tests/server-runtime.test.mjs`, `tests/server-body-limit.test.mjs`, `tests/server-smoke.test.mjs` (+ `tests/server-smoke/sandbox.mjs`, якщо стабу треба віддзеркалити `request.url`), `packages/simplycms/src/runtime/__tests__/{body-limit.test.ts,csrf.test.ts}`, `packages/simplycms/src/storage/__tests__/select.test.ts`, харнес-тест Р18(в) з Task 11 (кейс через справжній раннер)

**Interfaces:**
- Р18(б), URL запиту в раннері: `new URL(VITE_SITE_URL).origin` + шлях (+ query). `Host`, `X-Forwarded-Host`, `X-Forwarded-Proto` для URL ігноруються зовсім. Прапорця `TRUST_PROXY` НЕ вводимо. Request-target мусить починатися рівно з одного `/`: `//…` і `/\…` → 400 без виклику хендлера. Absolute-form (`http://h/p?q`) → береться лише шлях і query. Origin з конфігу потрібен і для CSRF-перевірки Start (див. факти вище). `server-runtime.mjs` лишається самодостатнім (лише `node:*`): origin приходить параметром від `server.mjs`, який читає `process.env.VITE_SITE_URL` після наповнення env.
- Рішення (рішення архітектора 2026-10-12, `rulings-plan-forks.md`): `server.mjs` без `VITE_SITE_URL` → exit 1 до `listen`, повідомлення називає ключ. Значення мусить парситись як абсолютний URL з протоколом `http:` або `https:`, інакше теж exit 1: порожній чи відносний origin ламає Р18(б). Повідомлення значення не друкує.
- Р20, лічильник у раннері на ВСІ запити з тілом незалежно від шляху:
  - `Content-Length` понад стелю класу → 413 без читання тіла (поведінка Task 7 — зʼєднання живе — лишається; кейси `tests/server-body-limit.test.mjs:95-130` зелені);
  - chunked — лічильник байтів у `TransformStream` між `Readable.toWeb(req)` і `Request`; при переповненні знищити з'єднання (`destroy`), хендлер повного тіла не отримує;
  - стеля за замовчуванням **1 МіБ** (1 048 576 байт); **26 МіБ** (27 262 976 = `MAX_REQUEST_BODY_BYTES`, `packages/simplycms/src/domain/media.ts:131-135`: 5 × 5 МіБ фото відгуку + 1 МіБ службових) — лише для `multipart/form-data` на ТОЧНИЙ сирий префікс serverFn (`TSS_SERVER_FN_BASE`, дефолт `/_serverFn/`; див. рішення нижче). Закодований шлях (`/%5FserverFn/…`) отримує малу стелю: помилка в безпечний бік. Раннер ядро не імпортує, тому 26 МіБ — літерал у `server-runtime.mjs`, а тест парності асертить рівність `MAX_REQUEST_BODY_BYTES` (зразок — парність `STRIPPED_ENV` у `tests/start-core.test.ts`).
  - Рішення (рішення архітектора 2026-10-12, `rulings-plan-forks.md`): префікс serverFn раннер бере з `process.env.TSS_SERVER_FN_BASE` (дефолт `/_serverFn/`). 🔴 Start виставляє цю змінну в `process.env` САМ під час імпорту бандла, тому раннер читає її ПІСЛЯ `await import('./dist/server/server.js')` у `server.mjs`, не на верхньому рівні модуля. Стеля 26 МіБ — для multipart на ТОЧНИЙ сирий префікс з цієї змінної.
- Р20, middleware ядра. Предикат `body-limit.ts:73` (`pathname.startsWith(serverFnBase())`) → `handlerType === 'serverFn'`. Факт звірки (Start 1.169.39, `node_modules/.pnpm/@tanstack+start-server-core@1.169.39/…/dist/esm/createStartHandler.js`): `:328` `const handlerType = isServerFnRequest ? "serverFn" : "router"`, `:404-409` `executeMiddleware(…, { request, pathname: url.pathname, handlerType, context })`, тобто request-middleware поле отримує. Виконавець перепідтверджує на своєму `node_modules` і перевіряє, що тип контексту `createMiddleware().server` його експонує. Немає поля → STOP, розвилка до оркестратора, без обхідного шляху.
- Реєстр `docs/architecture/upstream-workarounds.md`, START-BODY-1: вікно chunked JSON закрите лічильником раннера. Оновити поля «Наш обхід» (раннер + `handlerType`), «Межі гарантії» (абзац «Відкрите вікно» прибрати), «Межа спирання на рантайм», «Перевірено на версії» (дата й версія звірки). Те саме в абзаці `ENVIRONMENT.md` про стелю.
- Р22: `selectMediaDriver` бере корінь `local-fs` ЛИШЕ з `resolveDriverEnv(env).media.root` (`null` → `DEFAULT_MEDIA_ROOT`). Сирого читання `MEDIA_ROOT` поза `env/resolve.ts` немає. Дефолт параметра `localFsDriver` і публічний `mediaRoot` або йдуть через резолвер, або прибираються (рішення виконавця, критерій — grep нижче).

- [ ] **Step 1: Тести.**
  - `server-runtime.test.mjs` (Р18б): `Host: evil.example` + `X-Forwarded-Host: evil.example` + `X-Forwarded-Proto: https`, origin сайту `https://shop.test` → `request.url` = `https://shop.test/<шлях>`; `//evil.example/x` → 400; `/\evil.example` → 400; absolute-form `http://evil.example/p?q=1` → `https://shop.test/p?q=1`.
  - `server-smoke.test.mjs`: `GET //evil//x` через справжній `server.mjs` → 400, а не 308 з `Location` на `evil` (S3-04); без `VITE_SITE_URL` → exit ≠ 0 до слухання порту, у stderr ім'я ключа; `VITE_SITE_URL=/relative` і `VITE_SITE_URL=ftp://x` → exit ≠ 0; стаб віддзеркалює `request.url` → origin = `VITE_SITE_URL` при підробленому `X-Forwarded-Host`.
  - `csrf.test.ts`: запит з `request.url` на origin сайту (як його тепер будує раннер), `Origin: https://evil.example`, без `Sec-Fetch-Site` → відмова 403.
  - Харнес Р18(в) з Task 11: кейс через раннер — `X-Forwarded-Host: evil.example` + request-target `//evil/…` → посилання в листі на `VITE_SITE_URL`.
  - `server-body-limit.test.mjs` (Р20, сирим сокетом, стаб рахує виклики хендлера): `POST /%5FserverFn/x` multipart з `Content-Length` 2 МіБ → 413, хендлер не викликано; `POST /api/auth/sign-up/email` JSON 2 МіБ → 413; `POST /_serverFn/x` multipart 20 МіБ → до хендлера; 27 МіБ → 413; `POST /_serverFn/x` `application/json` 2 МіБ → 413 (не multipart — мала стеля); chunked 2 МіБ на `/api/auth/x` → з'єднання знищено, хендлер не отримав повного тіла; chunked 512 КіБ → проходить; паритет 26 МіБ ↔ `MAX_REQUEST_BODY_BYTES`; стаб-бандл, що під час імпорту ставить `process.env.TSS_SERVER_FN_BASE='/_custom/fn/'` (нестандартний `serverFns.base`) → multipart 20 МіБ на `/_custom/fn/x` проходить, а на `/_serverFn/x` → 413 (мала стеля).
  - `body-limit.test.ts`: контекст з `handlerType: 'serverFn'` і шляхом `/%5FserverFn/x`, `Content-Length` понад стелю → 413; `handlerType: 'router'` → `null`.
  - `select.test.ts` (Р22): `MEDIA_ROOT=''` і `MEDIA_ROOT='   '` → корінь `resolve(cwd, '.data/media')`, а не `cwd`; `getMediaDriver()` з `process.env.MEDIA_ROOT=''` → те саме.
- [ ] **Step 2: Прогнати** вибіркові тести → FAIL.
- [ ] **Step 3: Реалізувати**, `pnpm template:sync`.
- [ ] **Step 4: Прогнати** БЛ + `git grep -n "MEDIA_ROOT" -- packages/simplycms/src ':!**/__tests__/**'` → лише `env/resolve.ts` і коментарі (вивід — у звіт) + `git grep -n "x-forwarded-host\|x-forwarded-proto" -- server-runtime.mjs server.mjs` → порожньо. Мутації (рядок у звіті на кожну): повернути `X-Forwarded-Host` у `toRequestUrl` → FAIL `server-runtime` (Р18б) і харнес Р18(в) через раннер; відкат. Пропустити `//…` до хендлера → FAIL S3-04 у `server-smoke`; відкат. Повернути предикат за `pathname` у `body-limit.ts` → FAIL `body-limit.test` (`%5F`); відкат. Прибрати лічильник chunked у раннері → FAIL «chunked 2 МіБ → з'єднання знищено»; відкат. Обирати клас стелі за декодованим шляхом → FAIL «`/%5FserverFn/` multipart 2 МіБ → 413»; відкат. 26 МіБ для будь-якого шляху → FAIL «`/api/auth` 2 МіБ → 413»; відкат. Читати `TSS_SERVER_FN_BASE` на верхньому рівні `server.mjs` (до імпорту бандла) → FAIL кейсу нестандартного `serverFns.base`; відкат. Прибрати перевірку протоколу `VITE_SITE_URL` → FAIL кейсу `ftp://x`; відкат. Повернути сире читання `process.env.MEDIA_ROOT` у `select.ts` → FAIL `select.test` (`''`); відкат.
- [ ] **Step 5: Commit** `fix(k3-e8): раннер — origin з VITE_SITE_URL, стеля тіла на всі запити, MEDIA_ROOT лише з резолвера (Р18б, Р20, Р22)`.

### Task 12: Листи замовлення і картка хвостів пошти в адмінці

**Files:**
- Modify: `packages/simplycms/src/storefront/loaders/place-order.ts:41-80`, `packages/simplycms/src/mail/render/order.ts` (новий, + тест), `admin-server/index.ts` (`listMailOutbox`, `retryMailOutbox`), `admin-server/impl/mail/outbox.ts` (новий), `admin/features/settings/{MailOutboxCard.tsx,useMailOutbox.ts}` (нові), `SettingsPage.tsx`, `i18n/catalogs/{uk,en}/admin/settings.ts`, `tests/i18n-coverage` (за потреби), `eslint.tier-zones.mjs` (`mail` у upward-списках `storefront` і `admin-server`)
- Test: `packages/simplycms/test-harness/pg/__tests__/order-mail.test.ts`, `admin/features/settings/__tests__/MailOutboxCard.test.tsx`

**Interfaces:**
- Consumes: `enqueueMail`, `deliverMail`, `listMailOutbox`, `retryMail` (Task 10); `readStoreProfile` (`simplycms/site`).
- Produces: `renderOrderCustomerMail({ order, storeName, t })`, `renderOrderOwnerMail({ order, storeName, adminUrl, t })`. У `placeOrderFor`: всередині `run`, після `createOrder`, `operator(odb => enqueueMail(odb, items))` (ескалація `app_user → app_admin`, як `eraseMediaRows`); лист власнику — лише якщо `profile.contacts.email` непорожній; лист покупцю (`order_customer`) — лише якщо `input.email` непорожній (Д2: чекаут законно приймає замовлення лише з телефоном, `email: ''`; без листа, без рядка в outbox, без помилки `placeOrder`); після COMMIT для ОБОХ гілок (гість і покупець) — `deliverMail(ids)`; збій доставки не ламає відповідь замовлення. Серверні функції: `runAdmin('settings.manage', …)`; `retryMailOutbox` → `retryMail()`.

- [ ] **Step 1: `order-mail.test.ts`:** гість оформлює → два листи (`order_customer` на `input.email`, `order_owner` на email профілю) доставлено фейком, рядків немає; профіль без email → один лист; транспорт кидає → замовлення є, два рядки з `attempts=1`; ROLLBACK замовлення (помилка резерву) → листів і рядків немає; атомарність: тестовий тригер `before insert on mail_outbox` кидає виняток → замовлення НЕМАЄ (лист і замовлення комітяться разом або ніяк); `deliverMail` підмінено на no-op → обидва рядки є в таблиці одразу після COMMIT; Д2: замовлення з телефоном і `email: ''` → замовлення створено, листа `order_customer` немає ні в транспорті, ні в `mail_outbox` (лист власнику — за звичайним правилом).
- [ ] **Step 2: `MailOutboxCard.test.tsx`:** рядки з віком і типом, без тіла; «Повторити» кличе мутацію й інвалідує ключ `entityKey(ENTITY.mailOutbox)`; порожній стан. Серверний тест: користувач без `settings.manage` → відмова.
- [ ] **Step 3: Прогнати** → FAIL; **Step 4: Реалізувати.**
- [ ] **Step 5: Прогнати** БЛ. Мутації: `scheduleMail` після COMMIT замість `enqueueMail` усередині `run` → кейс ROLLBACK лишається зеленим, а кейс атомарності FAIL (замовлення є, листа немає — саме тому він є); відкат. Прибрати перевірку порожнього email власника → FAIL «один лист»; відкат. Прибрати перевірку порожнього email покупця → FAIL кейсу Д2 (`order_customer` на `''` у транспорті чи `mail_outbox`); відкат. Картка рендерить поле `message`, якщо воно прийде (додати його в `listMailOutbox`) → FAIL `MailOutboxCard`/серверного тесту «без тіла»; відкат. `runAdmin('settings.manage', …)` → `runAdmin('orders.read', …)` (або інше право, яке має тестовий не-власник) → FAIL «без `settings.manage` → відмова»; відкат.
- [ ] **Step 6: Commit** `feat(k3-e8): листи замовлення покупцю й власнику, хвости пошти в налаштуваннях`.

### Task 12b: Підтвердження пошти при реєстрації (Р30)

Аудит S2-03 / S1-05 / S1-03: реєстрація покупця не вимагає підтвердження пошти (`createAuth`, `instance.ts`, у `emailAndPassword` немає `requireEmailVerification`). BA 1.7.7 без нього одразу створює сесію (`better-auth/dist/api/routes/sign-up.mjs:155,241-262`). Звідси клас pre-hijack: чужу пошту займають до справжнього власника. Друга наслідкова діра — автоправило категорії `email_domain`: воно довіряє непідтвердженій пошті (`commerce/customer-stats.ts:86`) і порівнює домен підрядком (`domain/user-categories/conditions.ts:56-57`: `contains` → `includes`, тож `evilcorp.com` і `corp.com.attacker.net` збігаються з `corp.com`). Р19 (Task 11b) діє незалежно від цієї задачі.

**Files:**
- Modify: `packages/simplycms/src/auth/instance.ts` (`emailAndPassword.requireEmailVerification`; `emailVerification.sendVerificationEmail`), `packages/simplycms/src/mail/outbox.ts:17-18` (`MailKind` += `'email_verification'`; колонка `mail_outbox.kind` — `text` без CHECK, тож міграції не треба), `packages/simplycms/src/mail/render/auth.ts` (+ `renderEmailVerificationMail`), `packages/simplycms/src/i18n/catalogs/{uk,en}/mail.ts` і `auth.*` вітрини, `packages/simplycms/src/storefront-routes/pages/Auth.tsx:192-209` (після реєстрації з увімкненим підтвердженням `signUp` повертає `token: null`: показати «перевірте пошту», а не навігувати як залогіненого; вхід непідтвердженого → зрозуміле повідомлення на код BA `EMAIL_NOT_VERIFIED`), `packages/simplycms/src/commerce/customer-stats.ts:86`, `packages/simplycms/src/domain/user-categories/conditions.ts:45-61,74-75`, `packages/cli/src/doctor-mail-check.mjs` (або сусідній модуль перевірок режиму, Task 9 Step 5а)
- Test: харнес (`auth-integration.test.ts` або новий `packages/simplycms/test-harness/pg/__tests__/email-verification.test.ts`), `packages/simplycms/src/domain/user-categories/__tests__/conditions.test.ts`, харнес `category-rules-customer-stats.test.ts`, `tests/cli-doctor.test.ts`, новий тест сторінки `Auth` у `packages/simplycms/src/storefront-routes/pages/__tests__/` (наявного немає)

**Interfaces:**
- Consumes: `resolveDriverEnv(process.env).mail.driver` (Task 1), `scheduleMail`/`deliverMail` (Task 10), `renderPasswordResetMail` як зразок рендера (Task 11), база посилань BA з env (Р18(а), Task 11).
- Produces:
  - `requireEmailVerification` = `true`, коли драйвер пошти `smtp`; з драйвером `log` (dev) — `false`, реєстрація як зараз. Значення обчислюється в `createAuth` у рантаймі. `AuthDeps` дає перевизначення для тестів.
  - `emailVerification.sendVerificationEmail({ user, url })` — той самий шлях, що `sendResetPassword` (Е8-О1): `scheduleMail([{ kind: 'email_verification', message }])` → `void deliverMail(ids).catch(…)` без `await`. Посилання будує BA від `baseURL` з env (`${baseURL}/verify-email?token=…`), тобто за Р18. Власного посилання з запиту немає.
  - `email_domain`: правило категорії враховує лише підтверджену пошту. Для непідтвердженої `emailDomain` = `null`, і умова не виконується (`compareText` уже повертає `false` на `null`). Оператор `contains` для `email_domain` — точний збіг домену або суфікс `.<домен>`. Для `utm_*` `contains` лишається підрядком.
  - `doctor --production` (режим за Е8-Р17): драйвер пошти не `smtp` → додатковий `warn` «у проді реєстрація без підтвердження пошти: налаштуй `SMTP_URL`/`MAIL_FROM` (Р30)». Номер перевірки — №16 `checkEmailVerification` (№15 — `checkMailConfigured`).
- Рішення (рішення архітектора 2026-10-12, `rulings-plan-forks.md`): `emailVerification.sendOnSignIn: true` — непідтверджений акаунт (покупці, яким адмін змінив пошту, `admin-server/impl/customers/contacts.ts:68`; акаунти, створені до SMTP) отримує лист підтвердження на спробу входу (`sign-in.mjs:339-350`). 🔴 Прийняття запрошення власника (Р19) і скидання пароля через лист доводять контроль над скринькою, тож обидва ставлять `emailVerified = true`. Accept уже це робить (`accept-invite.ts:76-78`; Task 11b порядок зберігає — залежність: Task 12b після 11b). Для скидання пароля — новий запис у потоці `resetPassword` BA (хук/обгортка, звірити API BA 1.7.7 у `node_modules`).

- [ ] **Step 1: Тести.**
  - Харнес, драйвер `smtp` (фейковий транспорт): `signUp` → відповідь без сесії (`token: null`), у транспорті лист `email_verification`; посилання починається з origin `VITE_SITE_URL` + `/api/auth/verify-email?token=` навіть із запитом `X-Forwarded-Host: evil.example`; `signIn` до переходу → 403 `EMAIL_NOT_VERIFIED`; `GET` посилання → `users.email_verified = true`; `signIn` після → сесія є.
  - Харнес, драйвер `log`: `signUp` створює сесію, як і раніше (dev не змінено).
  - `sendOnSignIn`: непідтверджений акаунт зі SMTP → `signIn` → 403 і новий лист `email_verification` у транспорті.
  - Свіжий магазин зі SMTP → `owner:invite` → accept → вхід успішний без окремого листа підтвердження (`email_verified = true`). Непідтверджений покупець → `requestPasswordReset` → `resetPassword` за посиланням → `email_verified = true`, вхід успішний.
  - `conditions`: `email_domain contains corp.com` → `corp.com` ✓, `mail.corp.com` ✓, `evilcorp.com` ✗, `corp.com.attacker.net` ✗; `utm_source contains x` — підрядок, як раніше.
  - Статистика покупця: непідтверджений `x@bigcorp.com` + правило `email_domain = bigcorp.com` → категорію не змінено; після підтвердження → змінено.
  - `cli-doctor`: `--production` + драйвер `log` → рядок `warn` з «підтвердження пошти»; `smtp` → немає; режим розробки → немає.
  - `Auth`: `signUp` повертає `{ token: null }` → показано «перевірте пошту», навігації як залогіненого немає; помилка `EMAIL_NOT_VERIFIED` на вході → окреме повідомлення, не загальне «невірний пароль».
- [ ] **Step 2: Прогнати** → FAIL; **Step 3: Реалізувати**, ключі i18n в обох каталогах (тести парності), `pnpm template:sync`, якщо зачеплено синхронізовані файли.
- [ ] **Step 4: Прогнати** БЛ + `pnpm test:schema`. Мутації (рядок у звіті на кожну): `requireEmailVerification: false` при `smtp` → FAIL «`signIn` до переходу → 403»; відкат. `email_domain` ігнорує підтвердження → FAIL кейсу статистики; відкат. `contains` для `email_domain` знову підрядком → FAIL `evilcorp.com`; відкат. Посилання з `request.url` замість бази з env (прибрати `baseURL` з конфігу BA) → FAIL кейсу `X-Forwarded-Host`; відкат. Doctor не попереджає → FAIL `cli-doctor`; відкат. Не ставити `emailVerified` при accept → FAIL «`owner:invite` → accept → вхід»; відкат. Не ставити `emailVerified` при скиданні пароля → FAIL кейсу скидання; відкат. `sendOnSignIn: false` → FAIL «новий лист на вхід»; відкат.
- [ ] **Step 5: Commit** `feat(k3-e8): підтвердження пошти при реєстрації зі SMTP, email_domain лише для підтвердженої пошти (Р30)`.

### Task 13: Живі контури: `live:smoke` з Mailpit і `pilot-full` з Garage + Mailpit

**Files:**
- Create: `scripts/pilot-pack/{gate-media.mjs,gate-mail.mjs}`, `tests/pilot-gate-media.test.ts` (юніт на чисту частину: розбір виводу дочірнього процесу)
- Modify: `scripts/live-smoke.mjs` (+ новий `scripts/live-smoke/mail.mjs`; крок підтвердження реєстрації — Р30), `scripts/pilot-pack/{env.mjs,scaffold.mjs,run.mjs}`, `scripts/release/pilot-full.mjs:28-48`, `tests/release-gates.test.ts:29-30`, `docs/architecture/{test-contours.md,release-process.md:186}`

**Interfaces:**
- Consumes: `.env.harness` (`S3_*`, `HARNESS_SMTP_URL`, `HARNESS_MAILPIT_URL`) з Task 8.
- Produces: `env.mjs` пише в `.env` скретча три обов'язкові ключі + групи `S3_*`, `SMTP_URL`, `MAIL_FROM=pilot@simplycms.test`, якщо вони задані в оточенні прогону; `pilot-full` задає їх з `.env.harness`. Новий `scripts/pilot-pack/gate-media.mjs` (повний режим, після Gate B): дочірній `node --input-type=module` з `cwd` = скретч і env скретча імпортує `simplycms/storage` з `node_modules` скретча → `getMediaDriver().put(mediaKey('image/png'), bytes)` → `open` дає ті самі байти → підписаний `HEAD` у Garage з процесу гейту бачить об'єкт → `delete`. Це доказ, що ЗАПАКОВАНЕ ядро вибирає `s3` за env, а не лише монорепо.

- [ ] **Step 1: `live-smoke/mail.mjs`:** `scripts/live-smoke.mjs:89-94` (явний `env` сервера) отримує `SMTP_URL = HARNESS_SMTP_URL` і `MAIL_FROM` — без них SMTP-каналу в прогоні немає. Посилання й токени у вивід не друкуються (лише «лист знайдено, форма відкривається»). Після воронки чекауту — Mailpit має лист замовлення покупцю на адресу воронки; `requestPasswordReset` на ту саму адресу → лист із посиланням `/auth/set-password?token=…`; перехід за посиланням → форма відкривається. Р30 (Task 12b): реєстрація нового покупця на вітрині → вхід до підтвердження відмовлено → Mailpit має лист підтвердження на цю адресу → перехід за посиланням → пошта підтверджена → вхід цим акаунтом успішний (посилання у вивід не друкується). Чистка Mailpit на старті.
- [ ] **Step 2: `pilot-full`** з групами env; `gate-media` у `run.mjs` після B (лише повний режим; у `--pack-only` — skip із причиною). Так само `gate-mail` (`scripts/pilot-pack/gate-mail.mjs`): дочірній процес у скретчі імпортує `simplycms/mail` з `node_modules` скретча → `getMailTransport().send(...)` з унікальною темою → Mailpit API має лист із цією темою і `From = MAIL_FROM` — доказ SMTP-драйвера в ЗАПАКОВАНОМУ магазині (А §8).
- [ ] **Step 3: Прогнати** БЛ + `pnpm harness:up && pnpm live:smoke` + `node scripts/release/pilot-full.mjs`. Вивід обох — у звіт. Мутації: `MAIL_FROM` прибрати з `env.mjs` → старт скретча падає з `MAIL_FROM` (доказ, що Task 5 працює в запакованому магазині); відкат. `S3_BUCKET` на неіснуючий → `gate-media` FAIL; відкат. Прибрати `SMTP_URL` з env `live:smoke` → крок листів FAIL (не skip); відкат. Вимкнути `requireEmailVerification` при `smtp` → крок підтвердження реєстрації FAIL (листа немає, вхід до підтвердження пускає); відкат. Прибрати `SMTP_URL` з `env.mjs` → `gate-mail` FAIL (лист пішов у лог, а не в Mailpit); відкат. Прибрати `S3_*` з `env.mjs` → `gate-media` FAIL на підписаному `HEAD` (драйвер мовчки поклав файл у `local-fs` — саме той клас, проти якого гейт); відкат.
- [ ] **Step 4: Commit** `test(k3-e8): live:smoke з Mailpit, pilot-full з Garage і SMTP`.

---

## Хвиля А5 — обіцянка 1.0

### Task 14: Доказ оновлюваності 1.0 і `test:schema` у релізних гейтах

Рішення власника «реліз 1.0.0» означає обіцянку: магазин із даними переживає наступну версію платформи. Ця задача доводить обіцянку тестом і робить `test:schema` обов'язковим у релізі (Е8-В2, В3).

**Files:**
- Create: `packages/simplycms/test-harness/pg/__tests__/upgrade-1x.test.ts`, `scripts/release/schema-full.mjs`
- Modify: `scripts/release/gates.mjs` (гейт `schema` після `test:packaging`, перед `pilot`), `tests/release-gates.test.ts:29-30` (склад і порядок), `docs/architecture/release-process.md:186-213` (знято абзац «`test:schema` у реліз НЕ входить»; новий: з 1.0 він обов'язковий, Docker на машині релізу — вимога)

**Interfaces:**
- Consumes: `applyMigrations`, `listMigrationFiles`, `MigrationChecksumError` (Task 3); `runStart` (Task 5); канон `0000…0005` (Task 10).
- Produces: `schema-full.mjs` = `pnpm harness:up` (ідемпотентно; Postgres, Garage, Mailpit) → `pnpm test:schema`. Гейт `{ name: 'schema', cmd: 'node scripts/release/schema-full.mjs' }`.

- [ ] **Step 1: `upgrade-1x.test.ts`.** Підготовка: тимчасова БД → `applyMigrations` канону (`0000…0005`) → `demo-seed.sql` через `applySqlFiles` → ще одне замовлення через `placeOrderFor` і рядок медіа через `writeMedia` з фейковим драйвером. Знімок лічильників `orders`, `order_items`, `products`, `users`, `media_objects` (точні імена таблиць — зі схеми). Кейси:
  - tmp-тека = копія канону + `0006_e8_probe_column.sql` (`alter table products add column e8_probe text`) + `0007_e8_probe_backfill.sql` (`update products set e8_probe = slug`) → `applyMigrations` → `applied` = обидва, журнал має сім рядків, лічильники незмінні, `e8_probe` заповнено в кожному рядку;
  - повторний виклик → `applied: []`;
  - копія `0005_mail_outbox.sql` у tmp з дописаним коментарем → `applyMigrations` кидає `MigrationChecksumError` з `0005_mail_outbox.sql`; журнал і лічильники незмінні;
  - той самий змінений `0005` через `runStart` (фейковий `execve`) → код 1, `execve` не викликано — «контейнер не стартує».
- [ ] **Step 2: Прогнати** `pnpm test:schema upgrade-1x`. Тест має бути зеленим одразу: червоне означає помилку в Task 3, а не в тесті. Лагодити Task 3-код, не тест.
- [ ] **Step 3: Релізний гейт.** `schema-full.mjs`, запис у `gates.mjs`, `release-gates.test.ts` асертить склад і порядок (`…, test:packaging, schema, pilot`).
- [ ] **Step 4: Прогнати** БЛ. Мутації: у `applyMigrations` звіряти суми лише для `FROZEN`-файлів → FAIL кейсу «змінений `0005`»; відкат. Не писати рядок журналу після накату → FAIL «повторний виклик → `applied: []`» (`column "e8_probe" already exists`); відкат. Прибрати гейт `schema` з `gates.mjs` → FAIL `release-gates`; відкат.
- [ ] **Step 5: Commit** `test(k3-e8): доказ оновлюваності 1.0, test:schema у релізних гейтах`.

### Task 15: Політика версій 1.0 — чесний semver

Діапазони `engines.simplycms` у референс-пакетах відкриті вгору: faq `>=0.3.0` (`packages/simplycms-plugin-faq/src/index.ts:16`), solarstore `>=0.1.0` (`packages/simplycms-theme-solarstore/src/manifest.ts:17`), а `simplycms create plugin|theme` генерує `>=<версія CLI>` (`packages/cli/src/create.mjs:112`). З 1.0 такий діапазон прийме й 2.0 з ламкими змінами (Е8-В4). Текстова політика — рішення власника «чесний semver» (розділ «Рішення»): ця задача записує її в `AGENTS.md` («Принципи»: уточнення «без зворотної сумісності» = без старого API й шимів, злам → мажорна; «Пакети й реліз»: semver і RC під тегом `next`), `docs/architecture/release-process.md` (новий розділ «Версії: semver і пререлізи») і шапку `CHANGELOG.md`. Гілку пререлізу (`1.0.0-rc.N` → `^1.0.0-0`) додає Task 16.

🔴 Діапазон не можна записати `^1.0.0` руками зараз: ядро в монорепо до релізу має версію 0.14.0, і валідатори модулів червоніли б на кожному прогоні. Тому діапазон переписує крок бампу `pnpm release` — той самий механізм, що вже переписує літерал `version` у цих файлах (`scripts/release/manifest-version.mjs`, `MANIFEST_SOURCES`).

**Files:**
- Create: `packages/simplycms/src/contracts/semver/core-range.ts` (+ тест), реекспорт у `contracts/semver/index.ts`
- Modify: `AGENTS.md` («Принципи», «Пакети й реліз»), `docs/architecture/release-process.md`, `CHANGELOG.md` (шапка: «Проєкт дотримується semver з 1.0: злам сумісності коду магазину, тем чи плагінів → мажорна версія»), `scripts/release/manifest-version.mjs` (бамп переписує й `engines: { simplycms: '…' }`), `tests/release-*.test.ts` (наявний тест бампу маніфестів), `packages/cli/src/create.mjs:112`, тести `simplycms create`, `packages/simplycms/src/plugins/validatePluginModule.ts` і валідатор тем — лише тести, якщо логіка вже кличе `satisfies`

**Interfaces:**
- Produces: `coreRangeFor(version: string): string` — `M ≥ 1` → `^M.0.0`; `0.m.p` → `^0.m.0` (caret на 0.x фіксує мінор; `^0.0.0` покрив би лише 0.0.x). Кличуть його і `create.mjs`, і бамп релізу (CLI — через вбудовану копію з тестом паритету, бо CLI не залежить від ядра; або імпорт з `node_modules/simplycms` магазину — на вибір виконавця, з тестом).
- Бамп: `MANIFEST_ENGINES_RE = /^(\s*)engines: \{ simplycms: '([^']+)' \},$/m` — строгий, 0 або 2+ збіги → гучна помилка (той самий клас, що `MANIFEST_VERSION_RE`).

- [ ] **Step 1: Тести.**
  - `coreRangeFor`: `1.0.0` → `^1.0.0`; `1.4.2` → `^1.0.0`; `0.14.0` → `^0.14.0`; невалідний рядок → виняток.
  - `satisfies` (`contracts/semver`): `^1.0.0` приймає `1.0.0` і `1.9.3`; не приймає `2.0.0` і `0.14.0`.
  - Бамп: `bumpManifestVersions('1.0.0')` на фікстурі маніфесту з `engines: { simplycms: '>=0.3.0' }` → `^1.0.0` і `version: '1.0.0'`; маніфест без `engines` → гучна помилка.
  - Валідатори: модуль з `^1.0.0` проти ядра `2.0.0` → відмова (CLI) / попередження (bootstrap) — за наявним контрактом валідатора.
  - `create`: CLI версії `1.0.0` → згенерований модуль має `^1.0.0`; версії `0.14.0` → `^0.14.0`.
- [ ] **Step 2: Прогнати** → FAIL; **Step 3: Реалізувати.**
- [ ] **Step 4: Прогнати** БЛ. Мутації: `coreRangeFor` повертає `>=M.0.0` → FAIL «не приймає 2.0.0»; відкат. Прибрати переписування `engines` з бампу → FAIL тесту бампу; відкат.
- [ ] **Step 5: Commit** `feat(k3-e8): чесний semver — діапазон ядра ^major для референс-пакетів і create, політика в AGENTS.md`.

---

### Task 16: Пререлізний цикл `1.0.0-rc.N`

Рішення власника: перший реліз — `1.0.0-rc.1` під npm-тегом `next`; Е8 розгортає пілот з RC; `1.0.0` — після живого пілоту. Зараз увесь релізний ланцюг знає лише `X.Y.Z`: `VERSION_RE = /^\d+\.\d+\.\d+$/` і `compareVersions` (`scripts/release/bump.mjs:7-20`), `CORE_VERSION_RE` (`bump.mjs:76`), `MANIFEST_VERSION_RE` (`scripts/release/manifest-version.mjs`), `SEMVER_RE` у `contracts/semver` (`packages/simplycms/src/contracts/semver/index.ts:11`). `publish-packages.yml:90` публікує без `--tag`, а `simplycms update` бере `pnpm view @simplycms/cli version` (`packages/cli/src/update.mjs:42`) — це тег `latest`, тож магазин на RC «оновився» б назад до 0.14.

**Files:**
- Modify: `scripts/release/{bump.mjs,manifest-version.mjs}`, `scripts/release.mjs` (перевірка «нова версія > поточної» з пререлізами), `.github/workflows/publish-packages.yml` (ЛИШЕ рядок `--tag` кроку `Publish`; provenance, environment, Trusted Publishing — архітектор з власником перед PR), `packages/simplycms/src/contracts/semver/{index.ts,core-range.ts}`, `packages/cli/src/update.mjs:40-50`, `packages/create-simplycms-store/src/index.mjs:24` (лише тест)
- Create: `scripts/release/dist-tag.mjs` (`distTagFor(version): 'latest' | 'next'`) + тест; `tests/release-prerelease.test.ts`

**Interfaces:**
- Produces:
  - `VERSION_RE = /^\d+\.\d+\.\d+(-rc\.(0|[1-9]\d*))?$/` — лише форма `-rc.N` без провідних нулів (`rc.01` відкидається, як вимагає semver для числових ідентифікаторів) (інших пререлізів лінія не має; ширший regex прийняв би `1.0.0-beta` без правил порядку);
  - `compareVersions(a, b)`: `1.0.0-rc.1 < 1.0.0-rc.2 < 1.0.0 < 1.0.1`; `rc.10 > rc.9` (числове порівняння);
  - `distTagFor(version)`: пререліз → `'next'`, інакше `'latest'`. Workflow: крок `Publish` = рівно `pnpm publish -r --access public --no-git-checks --tag "$(node scripts/release/dist-tag.mjs --print)"` (CLI-режим `dist-tag.mjs` друкує `distTagFor(currentVersion())`); тег git `v1.0.0-rc.1` — без змін механізму;
  - `contracts/semver`: розбір `X.Y.Z-rc.N`; `satisfies` для `^M.0.0-0` = «`>= M.0.0-0` і `< (M+1).0.0-0`» — матчить і RC, і фінальний `M.x`; для `^M.m.p` без `-0` пререлізи НЕ матчаться (стандартна семантика: пререліз — лише за явної згоди діапазону);
  - `coreRangeFor('1.0.0-rc.N')` → `'^1.0.0-0'`; `coreRangeFor('1.0.0')` → `'^1.0.0'` (Task 15). Бамп релізу RC переписує `engines` на `^1.0.0-0`, фінальний `1.0.0` — на `^1.0.0`;
  - `update`: цільова версія без `--to` — якщо поточна версія ядра магазину пререліз, то `max(dist-tags.next, dist-tags.latest)` за `compareVersions` (`pnpm view @simplycms/cli dist-tags --json`), інакше `dist-tags.latest`; цільова < поточної → нічого не ставити, повідомити «новішого релізу немає» (ніколи не даунгрейдити без явного `--to`).
  - `update` не перетинає мажорну межу без явного `--to` (наслідок чесного semver): мажорна цілі > мажорної поточної версії → нічого не ставити, вивести «доступна мажорна версія X — містить зламані зміни, див. розділ BREAKING у CHANGELOG; оновлення — `simplycms update --to X`» і код 3. RC → фінальний тієї ж мажорної (`1.0.0-rc.2 → 1.0.0`) — не перетин межі. `0.x` → `1.x` — перетин.

- [ ] **Step 1: Тести (`tests/release-prerelease.test.ts` і тести `contracts/semver`).**
  - `VERSION_RE`: приймає `1.0.0-rc.1`, `1.0.0`; відкидає `1.0.0-beta.1`, `1.0.0-rc`, `1.0.0-rc.01`;
  - `compareVersions`: ланцюг `0.14.0 < 1.0.0-rc.1 < 1.0.0-rc.2 < 1.0.0-rc.10 < 1.0.0 < 1.0.1`;
  - гард `release.mjs:49-54` (`compareVersions(version, from) <= 0` → відмова) виноситься в експортовану `assertNewerVersion(next, current)` у `bump.mjs`, і `release.mjs` кличе саме її: `('1.0.0-rc.1','0.14.0')` → ок; `('1.0.0-rc.1','1.0.0')` → відмова; `('1.0.0-rc.1','1.0.0-rc.1')` → відмова; `('1.0.0','1.0.0-rc.3')` → ок. Текст підказки формату в `release.mjs:44` називає й форму `X.Y.Z-rc.N`;
  - `bumpTo('1.0.0-rc.1')` на фікстурі: `CORE_VERSION = '1.0.0-rc.1'`, маніфести `version: '1.0.0-rc.1'` і `engines: { simplycms: '^1.0.0-0' }`;
  - `distTagFor`: `1.0.0-rc.1` → `next`, `1.0.0` → `latest`; `node scripts/release/dist-tag.mjs --print` на фікстурі з RC-версією друкує `next`; тест читає `.github/workflows/publish-packages.yml` (YAML-розбором кроків, не регекспом по файлу) і асертить: у workflow рівно один виклик `pnpm publish`, він у кроці `Publish` і містить `--tag "$(node scripts/release/dist-tag.mjs --print)"` — так тест стереже САМ шлях публікації, а не окрему копію виразу;
  - `satisfies`: `^1.0.0-0` приймає `1.0.0-rc.1`, `1.0.0`, `1.7.0`; відкидає `2.0.0-rc.1`, `0.14.0`; `^1.0.0` відкидає `1.0.0-rc.1`;
  - валідатори модулів (тема й плагін): ядро `1.0.0-rc.1` + `engines` `^1.0.0-0` → прийнято (без цього RC відхилив би власні вшиті теми);
  - скаффолдер: `readVersion()` (`create-simplycms-store/src/index.mjs:24`) = власна версія пакета, тож з тегу `next` магазин отримує `__SIMPLYCMS_VERSION__ = 1.0.0-rc.1` — тест на фікстурі `package.json` з RC-версією;
  - `update`: магазин на `1.0.0-rc.1`, фейковий реєстр `{ latest: '0.14.0', next: '1.0.0-rc.2' }` → ціль `1.0.0-rc.2`; `{ latest: '0.14.0', next: '1.0.0-rc.1' }` → «новішого релізу немає», `pnpm add` не викликано; магазин на `0.14.0` → ціль `latest`; межа мажорної: `0.14.0` + `latest: '1.0.0'` без `--to` → код 3, текст називає `1.0.0` і `--to`, `pnpm add` не викликано; з `--to 1.0.0` → ставить; `1.0.0-rc.2` + `latest: '1.0.0'` → ставить.
- [ ] **Step 2: Прогнати** → FAIL; **Step 3: Реалізувати.**
- [ ] **Step 4: Прогнати** БЛ. Мутації: `compareVersions` ігнорує суфікс → FAIL ланцюга (`1.0.0-rc.1` = `1.0.0`) і гарда; відкат. `distTagFor` завжди `latest` → FAIL; відкат. Прибрати `--tag …` з кроку `Publish` у workflow → FAIL тесту workflow; відкат. Повернути в `release.mjs` власне порівняння замість `assertNewerVersion` → тест «`release.mjs` імпортує й кличе `assertNewerVersion`» (AST/імпорт) FAIL; відкат. `update` бере лише `latest` → FAIL «RC не даунгрейдиться»; відкат. Прибрати перевірку мажорної межі → FAIL «0.14.0 → 1.0.0 без `--to`»; відкат. `satisfies('^1.0.0-0', '1.0.0-rc.1')` → `false` → FAIL валідаторів; відкат.
- [ ] **Step 5: Commit** `feat(k3-e8): пререлізний цикл 1.0.0-rc.N — тег next, порядок версій, update без даунгрейду`.

---

### Task 16b: Engines плагінів і теми — warn у bootstrap, error у doctor (Р32)

Рішення архітектора Р32 (2026-10-13) замість обіцянки «строгий фейл — політика реліз-потяга v1.0»: магазин не цеглиться оновленням ядра, а невідповідність видно в `doctor`/`status`. Будує поверх Task 15+16 (`contracts/semver.satisfies` вирівняний з npm-semver, `coreRangeFor`).

**Files:**
- Modify: `packages/simplycms/src/plugins/validatePluginModule.ts:17`, `packages/simplycms/src/themes/validateThemeModule.ts:47-48` (коментарі: рішення Р32 замість обіцянки; поведінка — warn), `packages/cli/src/doctor-fs-checks.mjs` (або сусідній модуль перевірок) — нова перевірка №17 `engines`, `docs/architecture/cli.md` (таблиця перевірок), `docs/architecture/{plugins.md:90,themes.md:636}`, `docs/guides/themes.md:191`, тести doctor
- Носії старої обіцянки (grep «строгий фейл», «реліз-потяга v1.0» по `docs/` крім `docs/superpowers/research` і виконаних планів, `packages/`): кожен оновити на рішення Р32. Спека маркетплейсу Р-М3 (строгий фейл у CI-гейті маркетплейсу) — окреме рішення, лишається.

**Interfaces:**
- Перевірка `doctor` №17 `engines` (офлайнова, файлова): для кожного встановленого плагіна й активної теми `engines.simplycms` проти версії встановленого ядра через `contracts/semver.satisfies` → `error` з назвою пакета, його діапазоном, версією ядра і дією «онови плагін або відкоти ядро»; відсутній `engines` → `warn`, не `error`. Bootstrap — `console.warn` назавжди, без throw. `status --hook` показує цей `error` (перевір шлях doctor→status; якщо не доносить — додай).
- Нумерація: №17 — `engines`; Task 18 `agent-files` → №18. Оновити в усіх носіях (план Task 18, `docs/architecture/cli.md`, тести doctor).

- [ ] **Step 1: Тести.** Плагін з `engines.simplycms` `^2.0.0` при ядрі `1.0.0-rc.1` → doctor `error` (текст містить пакет, діапазон, версію ядра, дію), bootstrap `warn` і магазин стартує; плагін з `^1.0.0-0` → ok; без `engines` → `warn`; тема — ті самі три кейси; `status --hook` містить error.
- [ ] **Step 2: Прогнати** → FAIL; **Step 3: Реалізувати.**
- [ ] **Step 4: Прогнати** БЛ. Мутації: перевірка завжди ok → FAIL; bootstrap кидає на невідповідності → FAIL «магазин стартує»; відкат.
- [ ] **Step 5: Commit** `feat(k3-e8): engines плагінів і теми — warn у bootstrap, error у doctor (Р32)`.

---

## Хвиля А6 — знахідки аудиту

Знахідки аудиту безпеки й рефакторингу 2026-10-12 (звіти S1–S4, R1–R3), які власник погодив у rc.1 (Р23–Р29). Хвиля йде після А4 (потрібні Р18 і `siteUrl` з Task 11, порт пошти) і до хвилі Ф. Від Б не залежить. Порядок усередині — за номерами: А6.1 вводить маскування помилок, а А6.4 додає до родини доменних помилок `NotFound`, яка має проходити крізь це маскування.

### Task А6.1: Серверний вхід — помилки не течуть, заголовки безпеки (Р23, Р27)

Факти (звірено на HEAD плану):
- **Р23 (E1, Opus наживо).** Анонімний serverFn і SSR віддають клієнту текст помилки Postgres: Drizzle `Failed query: select … params: …`, а при падінні БД — `connect ECONNREFUSED host:port`. У лог сервера ці помилки не потрапляють. Відтворення: `getCatalogProducts` (`packages/simplycms/src/storefront-routes/server/catalog.ts:83-88`, валідатор `z.string().min(1)`) з `sectionId: "not-a-uuid"`; SSR `/catalog/a%00b`.
- SSR: кореневий `errorComponent: ErrorBoundary` (`src/routes/__root.tsx:72`, рендер `:189-218`) друкує `error.message`. `getRouter()` (`src/router.tsx:15-27`) не задає `defaultErrorComponent`, тож дочірні роути показують дефолт TanStack «Something went wrong! [Show Error]» з повним текстом.
- Доменні помилки перетинають межу serverFn адаптером `domainErrorAdapter` (`src/start.ts`, `serializationAdapters`) за закритою родиною `DOMAIN_ERROR_NAME` (`packages/simplycms/src/contracts/domain-errors.ts`): `AdminConflictError` (включно з `stateConflict`, `admin-server/impl/errors.ts:56`, 409), `AuthzError` (`auth/authz.ts:117`, 403), `ValidationError`. А6.4 додає до родини `NotFound`.
- Хелпери: `isProductionRuntime(env)` — `packages/simplycms/src/env/resolve.ts:156`; `redactUrls(text)` — `packages/simplycms/src/env/redact.ts:10`.
- **Р27 (S3-03).** Жодного заголовка безпеки немає ні на динаміці (SSR, serverFn, `/media/*` — роут ядра `packages/simplycms/routes/storefront/media/$.tsx`), ні на статиці `sirv` (`server.mjs`, `setHeaders`).

**Files:**
- Modify: `src/server.ts` (fetch-обгортка: заголовки, маскування — якщо точка тут) → `pnpm template:sync`; `src/start.ts` і/або `src/router.tsx` (`defaultErrorComponent`), `src/routes/__root.tsx` (`ErrorBoundary`) → `pnpm template:sync`; `server.mjs` (заголовки для `sirv` і для 400/413/500 самого раннера) → `pnpm template:sync`; новий модуль ядра для маскування й переліку заголовків (місце — за тір-зонами: чиста функція заголовків без секретів може бути client-safe, логування з `redactUrls` — server-only); `docs/architecture/rendering-and-routing.md` (помилки й заголовки — коротко)
- Test: `tests/server-smoke.test.mjs` (+ `tests/server-smoke/sandbox.mjs`: стаб-хендлер обгортається справжньою функцією ядра, як `tests/server-body-limit.test.mjs` імпортує `checkBodyLimit` за шляхом), юніт модуля маскування, тест парності переліку заголовків `server.mjs` ↔ ядро, SSR-кейс через справжній зібраний сервер (крок `live:smoke` або Gate B пілота — юніт не бачить серіалізації помилки в HTML-потік)

**Interfaces:**
- Р23. У проді (`isProductionRuntime(process.env)`) непередбачена помилка доходить до клієнта лише загальним повідомленням + ідентифікатором помилки. Сервер пише повну помилку в лог з тим самим ідентифікатором, текст проходить `redactUrls`. Поза продом — як зараз.
- Канали: (1) відповідь serverFn; (2) SSR — кореневий `ErrorBoundary` і дефолтний `errorComponent` для всіх роутів вітрини. Маскування має статися ДО серіалізації в HTML-потік, а не лише у видимому тексті компонента: тест асертить увесь HTML відповіді.
- Доменні помилки з кодами (уся родина `DOMAIN_ERROR_NAME`, зокрема `NotFound` з А6.4) проходять до клієнта як раніше: `name`, поля, статус. Маскується лише непередбачене. Предикат «доменна» — членство в родині `DOMAIN_ERROR_NAME`, а не перелік класів у модулі маскування: новий член родини проходить автоматично.
- Логіка — у ядрі, хост лише підключає (`src/*` → `template:sync`).
- Рішення (рішення архітектора 2026-10-12, `rulings-plan-forks.md`): якщо Start 1.169 не дає однієї точки перехоплення обох каналів (глобальна function-middleware у `createStart` для serverFn; `defaultErrorComponent` / обгортка `fetch` для SSR) без обходу внутрішнього API — STOP (BLOCKED) з фактами і розвилка архітектору, без латки.
- Р27. На ВСІ відповіді (SSR, serverFn, статика `sirv`, `/media`, власні 400/413/500 раннера) — дослівно:
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `X-Frame-Options: SAMEORIGIN`
  - `Content-Security-Policy: frame-ancestors 'self'` (лише ця директива)
  - `Strict-Transport-Security: max-age=31536000` — лише коли origin сайту (`VITE_SITE_URL`) має протокол `https:`
  - `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- Місце: fetch-обгортка серверного входу `src/server.ts` для динаміки + `server.mjs` для статики. `server.mjs` ядро не імпортує (Е8-Р7′), тому тримає власну копію переліку під тестом парності з ядром (зразок — `STRIPPED_ENV` ↔ `start-core`, `tests/start-core.test.ts`).
- Перевірка скіла: `grep -rniE "iframe|frame-ancestors" packages/simplycms/skills/redesign-from-reference` (після Task 17 — `simplycms-redesign`). На HEAD плану збігів немає. Скіл не має вбудовувати магазин в iframe чужого origin, бо `frame-ancestors 'self'` це зламає. Вивід — у звіт; знайдене вбудовування → до оркестратора.

- [ ] **Step 1: Тести.**
  - Маскування (юніт + харнес): прод, `getCatalogProducts({ sectionId: 'not-a-uuid' })` → у тілі відповіді немає `select`, `params`, `Failed query`, є ідентифікатор; у лозі сервера є той самий ідентифікатор і `Failed query`. Недоступна БД → у відповіді немає `ECONNREFUSED` і `host:port`. Доменні: не-адмін кличе адмінську serverFn → 403, `name: 'AuthzError'` і `operation` на місці; операція з `stateConflict` → 409, `kind: 'state'` і `constraint` на місці. Поза продом — повний текст (dev не змінено).
  - SSR (справжній сервер): `/catalog/a%00b` у проді → у HTML немає `select`/`params`/`Failed query`, у лозі є; дочірній роут не показує «Something went wrong! [Show Error]» з текстом помилки.
  - Заголовки (`server-smoke`): SSR `/`, serverFn `/_serverFn/x` (стаб), статика `/assets/x.js` (`sirv`), `/media/<ключ>` (стаб), 400 раннера → кожен із п'яти заголовків; `Strict-Transport-Security` є при `VITE_SITE_URL=https://…` і відсутній при `http://…`; парність переліку `server.mjs` ↔ ядро.
- [ ] **Step 2: Прогнати** → FAIL; **Step 3: Реалізувати**, `pnpm template:sync`.
- [ ] **Step 4: Прогнати** БЛ + `pnpm test:schema` + `pnpm harness:up && pnpm live:smoke` (якщо SSR-кейс там). Мутації (рядок у звіті на кожну): вимкнути маскування → FAIL «немає `Failed query`»; відкат. Маскувати й доменні → FAIL кейсу 403/409; відкат. Прибрати `X-Content-Type-Options` з копії в `server.mjs` → FAIL каналу статики й парності; відкат. HSTS безумовно → FAIL кейсу `http://`; відкат.
- [ ] **Step 5: Commit** `fix(k3-e8): маскування непередбачених помилок у проді, заголовки безпеки на всіх відповідях (Р23, Р27)`.

### Task А6.2: Один канонічний шлях товару (Р25, Д5)

Факти (Д4, Opus наживо):
- Товар без розділу легальний (FK `on delete set null`), але кожен споживач будує його URL по-своєму. Картка: `section?.slug || ''` (`packages/simplycms/src/catalog-ui/ProductCard.tsx:33,37-38`) → `/catalog//slug` → 404, товар не купити. Sitemap: `'products'` (`src/storefront/seo/sitemap.ts:34`). Адмінка: `'all'` (`src/admin/features/reviews/card/ReviewCardPage.tsx:44-45`).
- canonical береться з URL-параметра (`src/storefront-routes/head/product.ts:52-53`), тому для одного товару існує кілька canonical. JSON-LD — той самий файл (`:56-66`). Роут `packages/simplycms/routes/storefront/_storefront/catalog/$sectionSlug/$productSlug.tsx:19-29` редіректить лише тоді, коли розділ у товару Є.
- Д5: slug розділу сервер перевіряє (`admin-server/impl/sections/resource.ts:26`, `SLUG_RE` з `domain/slug.ts:8`), а slug товару й модифікації — ні (`admin-server/impl/products/resource.ts:28`, `product-modifications/resource.ts:25`: у `refine` лише `images`).

**Files:**
- Create: модуль `productPath` у client-safe домені ядра (`packages/simplycms/src/domain/…`, T0/T1; реекспорт у `simplycms/domain`) + тест
- Modify: `catalog-ui/ProductCard.tsx`, `storefront/seo/sitemap.ts`, `admin/features/reviews/card/ReviewCardPage.tsx`, `storefront-routes/head/product.ts` (canonical і JSON-LD), роут `$sectionSlug/$productSlug.tsx`, `admin-server/impl/{sections,products,product-modifications}/resource.ts` (refine slug), форма розділу в адмінці (відхилення зарезервованого сегмента), i18n повідомлення валідації
- Test: тест `productPath`, `storefront/seo/__tests__/sitemap.test.ts`, тести `ProductCard`/`ReviewCardPage`, `product-jsonld-offers.test.ts`, тест роуту/лоадера товару, харнес або серверні тести `resource` (slug)

**Interfaces:**
- Produces: один хелпер `productPath(product)` (форма входу — `{ slug, sectionSlug | null }`; повертає шлях і/або `{ to, params }` для `Link` — на вибір виконавця, але ОДНА функція) для картки, sitemap, адмінки, canonical і JSON-LD. Товар без розділу отримує один зарезервований сегмент-константу (напр. `NO_SECTION_SLUG`). Валідація slug розділу цей сегмент відхиляє і на сервері, і у формі. Д5: сервер починає перевіряти `SLUG_RE` для slug товару й модифікації (`refine` у `products/resource.ts`, `product-modifications/resource.ts`).
- canonical = origin сайту (`siteUrl` кореневого лоадера, з `VITE_SITE_URL`, Р18) + `productPath`, а не URL запиту.
- Роут: товар без розділу і сегмент ≠ константи → 301 на канонічний; товар з розділом і чужий сегмент → 301 (як зараз).
- Рішення (рішення архітектора 2026-10-12, `rulings-plan-forks.md`): зарезервований сегмент — `all` (уже вживається в адмінці, `ReviewCardPage.tsx:45`). Sitemap `'products'` → `all` (через `productPath`). Валідація slug розділу відхиляє `all` і на клієнті (форма розділу), і на сервері (`admin-server/impl/sections/resource.ts:26`).

- [ ] **Step 1: Тести.** `productPath`: з розділом і без; картка товару без розділу → `Link` на шлях, з якого лоадер роуту знаходить товар (не 404); canonical однаковий для `/catalog/<константа>/<slug>`, для довільного сегмента (після 301) і з sitemap; JSON-LD `url` = canonical; sitemap і адмінка дають рівно `productPath`; роут: товар без розділу + сегмент `foo` → 301 на канонічний; slug розділу `all` → `ValidationError` сервера і помилка форми розділу; sitemap для товару без розділу → `/catalog/all/<slug>`; slug товару `Bad Slug` і slug модифікації `Bad Slug` → `ValidationError` сервера.
- [ ] **Step 2: Прогнати** → FAIL; **Step 3: Реалізувати.**
- [ ] **Step 4: Прогнати** БЛ + `pnpm test:schema` + `git grep -nE "catalog/\\$\\{|section\\?\\.slug \\|\\| ''|'all'\\}/|\\?\\? 'products'" -- packages/simplycms/src ':!**/__tests__/**'` → порожньо (вивід — у звіт). Мутації (рядок у звіті на кожну): картка знову `section?.slug || ''` → FAIL «картка → маршрут знаходить товар»; відкат. Sitemap з власним літералом замість `productPath` → FAIL sitemap-тесту; відкат. canonical з параметра URL → FAIL «canonical однаковий»; відкат. Прибрати `refine` slug з `products/resource.ts` → FAIL `Bad Slug`; відкат.
- [ ] **Step 5: Commit** `fix(k3-e8): один канонічний шлях товару для картки, sitemap, адмінки, canonical і JSON-LD (Р25, Д5)`.

### Task А6.3: Ціни лише для виду глядача, кеш SSR (Р29)

Рішення власника: «гостям відображати всі ціни — помилка». Публічні лоадери вітрини віддають `product_prices` усіх видів цін (S1-02):
- `packages/simplycms/src/storefront/loaders/product-detail.ts:102` — `getProduct`, `storefront-routes/server/products.ts`;
- `storefront/loaders/catalog-products.ts:133` — `getCatalogProducts` (`server/catalog.ts:83`) і `getPropertyOption` (`server/properties.ts`);
- `storefront/loaders/entities/home-product.ts` (`prices`, `:33-37`: «базу за типом ціни покупця … рахує клієнт») — головна, «популярне», «новинки», товари розділів (`home.ts:84-91`);
- `storefront-routes/server/product-list-item.ts` — SSR-список уже зводить ціну до гостьового типу (`:52-79`), звірити;
- JSON-LD `offers` — `storefront-routes/head/product.ts:56-57` (`productOffers`).

**Факти про кеш вітрини (з'ясовано для цього плану; виконавець перепідтверджує на своєму HEAD):**
- «Кеш з поколіннями» Е6б — `createReadCache` (`packages/simplycms/src/site/read-cache.ts:26-58`): процесний кеш із TTL 5 хв, у якому лише два значення, однакові для всіх глядачів, — `storeProfileCache` і `activeThemeCache` (`:60-66`; читачі — `storefront/loaders/store-profile.ts:16`, `storefront/loaders/theme-record.ts:63`). Payload сторінок, товари й ціни через нього НЕ йдуть.
- `QueryClient` народжується на кожен запит у `getRouter()` (`src/router.tsx:15-20`), а Start кличе `getRouter` у межах запиту (`start-server-core/dist/esm/createStartHandler.js`, `startRequestResolver`). Отже серверного кешу TanStack Query, спільного між користувачами, немає.
- Платформа не ставить `Cache-Control` ні на SSR HTML, ні на публічні serverFn вітрини. Публічний кеш (`public, max-age=3600, stale-while-revalidate=86400`) — лише `/sitemap.xml` і `/robots.txt` (`storefront-routes/seo/interceptor.ts:34`). Прецедент персоналізованої відповіді — `getProductReviews` з `setResponseHeader('cache-control', 'private, no-store')` (`core/lib/reviews.ts:37`).
- Висновок: спільний між користувачами кеш — лише зовнішній (CDN/проксі перед магазином, якщо він кешує без `private`). Умова-стоп нижче на HEAD плану не спрацьовує, але її перевіряють заново.

🔴 **Умова-стоп.** Перед реалізацією: `git grep -nE "createReadCache|cache-control|Cache-Control|s-maxage" -- packages/simplycms/src src ':!**/__tests__/**'` і звірка з фактами вище. Якщо кеш SSR вітрини (або будь-який серверний кеш payload-ів сторінок) спільний між користувачами і персоналізацію не розвести без переробки кешу — **ЗУПИНИСЬ (BLOCKED)** і принеси розвилку оркестратору → архітектору. Ризик — витік цін одного покупця іншому. Обхід на кшталт «вимкнути кеш» без рішення не робити.

**Files:**
- Modify: `storefront/loaders/{product-detail.ts,catalog-products.ts,home.ts}`, `storefront/loaders/entities/home-product.ts`, `storefront-routes/server/{products.ts,catalog.ts,properties.ts,home.ts,product-list-item.ts}` (глядач із сесії, заголовок кешу), `storefront-routes/head/product.ts` / `product-offers.ts` (JSON-LD), `commerce/price-types.ts` (якщо потрібен хелпер «види глядача»), `docs/architecture/data-layer.md` (правило: публічні лоадери віддають лише види глядача)
- Test: харнес `storefront-loaders.test.ts` (або новий `storefront-price-visibility.test.ts`), `product-jsonld-offers.test.ts`, тест заголовка кешу serverFn

**Interfaces:**
- Consumes: `loadGuestPriceTypes(db)` (`commerce/price-types.ts:41`, повертає `{ priceTypeId, defaultPriceTypeId }` — тип дефолтної категорії й глобальний дефолтний як відкат), `resolvePriceTypes(db, categoryId)` (`:22-34`), `user_categories.price_type_id` (`schema/schema.ts:141`), `loadPricesByProduct` (`commerce/pricing.ts:28`), `readSessionSubject(getRequest().headers)`.
- Produces: лоадери віддають `product_prices` лише для видів цін глядача. Гість — види `loadGuestPriceTypes`. Покупець — вид його категорії (`user_categories.price_type_id`, тим самим правилом `resolvePriceTypes`) + гостьові як фолбек. Фільтр — на СЕРВЕРІ, до серіалізації. Глядача визначає лише серверна сесія, а категорію покупця читає `withCustomerDb(subject.userId, …)`. Параметра від клієнта немає.
- Кеш: персоналізований payload (залогінений глядач) — `Cache-Control: private, no-store` на відповіді serverFn і на SSR HTML, поза будь-яким спільним кешем. Гостьова відповідь лишається кешованою, як зараз; нового публічного кешу задача не вводить.
- Рішення (рішення архітектора 2026-10-12, `rulings-plan-forks.md`): `queryKey` публічних запитів з цінами — сегмент 0 з реєстру сутностей (`simplycms/contracts/entities`) як раніше, наступним сегментом — ідентичність виду цін глядача: `'guest'` або id виду цін (НЕ `userId`). Запити вітрини інвалідуються при вході й виході.

- [ ] **Step 1: Тести** (харнес; БД із двома видами цін — гостьовим і оптовим, категорія «опт» з оптовим видом). Анонім: `getProduct`, `getCatalogProducts`, головна, `getPropertyOption` → у payload і в SSR HTML немає `price_type_id` оптового виду й оптової ціни. Покупець категорії «опт» → його вид є, гостьовий як фолбек є. Покупець дефолтної категорії → оптового немає. JSON-LD `offers` → лише гостьова ціна. Відповідь для залогіненого → `cache-control: private, no-store`; для гостя — без `private`. Клієнт: `queryKey` публічних запитів з цінами має сегмент виду цін (`'guest'` / id виду), а не `userId`; вхід і вихід інвалідують запити вітрини (після виходу оптових цін у кеші немає).
- [ ] **Step 2: Перевірка умови-стоп** (див. вище) — результат у звіт до реалізації. **Step 3: Прогнати** → FAIL; **Step 4: Реалізувати.**
- [ ] **Step 5: Прогнати** БЛ + `pnpm test:schema`. Мутації (рядок у звіті на кожну): прибрати фільтр у `product-detail.ts` → FAIL «аноним без оптового» (`getProduct`); відкат. Те саме в `catalog-products.ts` → FAIL каталогу; відкат. Прибрати сегмент виду цін з `queryKey` → FAIL клієнтського тесту ключа; відкат. Прибрати інвалідацію на вихід → FAIL «після виходу оптових цін у кеші немає»; відкат. Прибрати `private, no-store` для залогіненого → FAIL заголовка; відкат. Брати категорію з параметра замість сесії (якщо реалізація має такий шов) → FAIL «покупець дефолтної категорії без оптового»; відкат.
- [ ] **Step 6: Commit** `fix(k3-e8): ціни вітрини лише для виду глядача, персоналізоване — private, no-store (Р29)`.

### Task А6.4: Помилка ≠ «порожньо» на вітрині, банер головної (Р26, Р24)

Факти (звірено на HEAD плану):
- **Р26 (D-05/D-19, Opus 95).** Збій запиту маскується під «порожньо» / «не знайдено»: `storefront-routes/pages/Profile.tsx:38,62`; `ProfileOrders.tsx:49,105` (`data: orders = []` → «немає замовлень»); `ProfileOrderDetail.tsx:70,136,146`; `OrderSuccess.tsx:64,112,124`. Найгірше — «замовлення не знайдено» одразу після оформлення, і покупець оформлює вдруге. Адмінка: `admin/features/discounts/discount/useDiscountCard.ts:106` (`notFound: !isNew && detail.isError`), а `admin-server/impl/discounts/get.ts:30` кидає plain `Error` («знижки … не існує»), тож справжнє «не знайдено» від збою не відрізнити.
- **Р24 (Д1, Opus 100).** Головна бере банери лише за `isActive` (`storefront/loaders/home.ts:39-43`): усі розміщення (`catalog`, `section`, `global`…) і без розкладу. Еталон — `loadBanners(db, { placement, sectionId? }, now)` (`storefront/loaders/banners.ts:24-50`: `isActive` + `placement` + розклад `isBannerVisible`). Тема бере ПЕРШИЙ банер як hero. Наявний тест — лише `data.banners.length > 0` (`test-harness/pg/__tests__/storefront-loaders.test.ts:181`).

**Files:**
- Modify: `storefront-routes/pages/{Profile.tsx,ProfileOrders.tsx,ProfileOrderDetail.tsx,OrderSuccess.tsx}`, i18n вітрини (стан помилки з повтором — обидва каталоги), `admin/features/discounts/discount/useDiscountCard.ts`, `admin/features/discounts/discount/DiscountEditPage.tsx:34-38` (стан помилки), `admin-server/impl/discounts/get.ts:30`, `contracts/domain-errors.ts` (новий член родини), серверний клас помилки поруч із наявними (`admin-server/impl/errors.ts`), `admin/lib/admin-error.ts` (за потреби), `storefront/loaders/home.ts:39-43`
- Test: нові тести чотирьох сторінок (`storefront-routes/pages/__tests__/`), тест `useDiscountCard`, `runtime/__tests__/domain-error-adapter.test.ts`, харнес `storefront-loaders.test.ts`

**Interfaces:**
- Р26: сторінки розрізняють `isError` (стан помилки з кнопкою «Повторити» → `refetch`) і справжнє «не знайдено» / «порожньо» (запит успішний, даних немає). Компоненти — `simplycms/ui`, рядки — `useT`.
- Доменне «не знайдено»: новий член закритої родини `DOMAIN_ERROR_NAME` (`contracts/domain-errors.ts`) і серверний клас, за зразком `AdminConflictError`/`AuthzError`. `domainErrorAdapter` читає родину й переносить його через межу serverFn. Маскування А6.1 його пропускає, бо предикатом там є членство в родині. `discounts/get.ts:30` кидає саме його. `useDiscountCard`: `notFound` — лише для цієї доменної помилки, будь-яка інша — стан помилки.
- Адмінку цілком (54 файли на `useLiveQuery`/`useLiveInfiniteQuery` без `isError`) — планово спільним компонентом, у rc.1 НЕ тягнемо.
- Р24: `loadHomePageData` кличе `loadBanners(db, { placement: 'home' })`. Власного запиту банерів у `home.ts` не лишається.

- [ ] **Step 1: Тести.** Кожна з чотирьох сторінок: запит відхилено → стан помилки з «Повторити» (клік кличе `refetch`), тексту «немає замовлень» / «не знайдено» немає; запит успішний з `null`/`[]` → «не знайдено» / «порожньо». `OrderSuccess`: збій мережі одразу після оформлення → НЕ «замовлення не знайдено». `useDiscountCard`: доменне «не знайдено» → `notFound: true`; мережевий збій / 500 → `notFound: false` + стан помилки. Адаптер: нова доменна помилка переживає межу serverFn з `name`. Харнес головної: банер `placement: 'catalog'` і банер `home` з розкладом у майбутньому не потрапляють у `data.banners`; чинний банер `home` — потрапляє.
- [ ] **Step 2: Прогнати** → FAIL; **Step 3: Реалізувати**, ключі i18n в обох каталогах.
- [ ] **Step 4: Прогнати** БЛ + `pnpm test:schema`. Мутації (рядок у звіті на кожну): `OrderSuccess` знову трактує `isError` як «не знайдено» → FAIL тесту `OrderSuccess`; відкат. `useDiscountCard` `notFound: detail.isError` → FAIL «мережевий збій → `notFound: false`»; відкат. `get.ts:30` знову plain `Error` → FAIL «доменне не знайдено → `notFound: true`»; відкат. `home.ts` знову лише `isActive` → FAIL харнесу банерів; відкат.
- [ ] **Step 5: Commit** `fix(k3-e8): збій запиту на вітрині ≠ «порожньо», банер головної за розміщенням і розкладом (Р26, Р24)`.

### Task А6.5: Прод-рецепт, власний Postgres на магазин, заглушки env (Р28)

До Р28 архітектор додав (доповнення до А6.5, S4-16) прибирання з репо абсолютних симлінків і деталей приватної інфраструктури — пункти (г) і (д) нижче.

Факти (звірено на HEAD плану):
- (а) Прод-рецепти розходяться з Е8-Р6. `docs/development/ENVIRONMENT.md:97` пише «у проді — `pnpm start:prod`». Кореневий `README.md:34,59,115` дає `pnpm build && pnpm start` як production-запуск. `packages/create-simplycms-store/template/README.md:102-108` («Прод:») — `pnpm start` (`node server.mjs`, без накату й без `execve`). `template/package.json.tpl:13-14` має `start` і `start:prod`.
- (б) Ролі `app_runtime`/`app_admin` — кластерні. Два магазини в одному кластері ділять ролі: синк пароля одного ламає інший, а через `SET LOCAL ROLE app_admin` видно чужу базу.
- (в) `template/env.example` несе заглушки секретів, які «працюють» як значення: `DATABASE_URL=postgresql://app_runtime:your-password@localhost:5432/postgres`, `BETTER_AUTH_SECRET=your-32-byte-random-secret`, закоментовані `S3_ACCESS_KEY=your-access-key`, `S3_SECRET_KEY=your-secret-key`, `SMTP_URL=smtps://user:password@smtp.example.com:465`, `MIGRATION_DATABASE_URL=postgresql://owner:password@localhost:5432/postgres`. Коментар про `BETTER_AUTH_URL` («без неї Better Auth виводить базу із самого запиту») після Р18(а) хибний, якщо Task 11 його ще не виправив.

**Files:**
- Modify: `docs/development/ENVIRONMENT.md` (§ запуск у проді `:93-104`; новий абзац «Власний екземпляр Postgres на магазин»), `README.md:34,59,115`, `packages/create-simplycms-store/template/README.md:93-108`, `packages/create-simplycms-store/template/env.example`, `packages/cli/src/doctor-checks.mjs` (`checkEnv:108-116` або нова перевірка поруч), `packages/cli/src/doctor-db-checks.mjs` (`runOnlineChecks:83-…`), `docs/architecture/cli.md` (нові перевірки)
- Modify (г, д): git-індекс `.claude/skills/tanstack-*` (`git rm --cached`; файли на диску не чіпати), `.gitignore` (`.claude/skills/tanstack-*`), за потреби — скрипт або задокументований крок, що створює ВІДНОСНІ лінки на `node_modules/...` (`docs/development/TOOLING.md`), `docs/superpowers/specs/2026-10-12-pilot-readiness-design.md:16` (це спека А: виняток із правила «спеки А і Б — лише в Task 25», бо правку назвав архітектор)
- Test: `tests/cli-doctor.test.ts`, тест онлайн-перевірок doctor (фейкове ядро/проба, як наявні), тест парності «`env.example` не містить відомих заглушок» (поруч із `tests/create-store-template-parity.test.ts`), харнес-кейс для (б′) (друга БД у тестовому кластері), новий `tests/git-symlinks.test.ts` (г)

**Interfaces:**
- (а) Старт у проді — лише `node scripts/start.mjs`. Прибрати `pnpm start:prod` / `pnpm start` як прод-рецепт з `ENVIRONMENT.md:97`, README шаблону (розділ «Прод») і кореневого `README.md:34,59,115`. `pnpm start` лишається як локальний запуск зібраного бандла з позначкою «не для проду».
- Рішення (рішення архітектора 2026-10-12, `rulings-plan-forks.md`): скрипт `start:prod` з `template/package.json.tpl:14` прибрати; `start` лишається для локального запуску зібраного бандла. Перевірити, що скаффолдер і скіл деплою (Task 22, `references/dokploy.md`) задають стартовою командою платформи `node scripts/start.mjs` (`RAILPACK_START_CMD` або аналог), а не `pnpm start`. Тести й Gate B, що кличуть `start:prod`, переводяться на `node scripts/start.mjs`.
- (б) `ENVIRONMENT.md`: вимога платформи (рішення власника) — КОЖЕН магазин має ВЛАСНИЙ екземпляр Postgres, з причиною (див. факти). Скіли деплою й онбордингу пишуть те саме (Task 22).
- (б′) `doctor --online` → `warn`, якщо в кластері є інші бази з таблицею `public.simplycms_migrations` або роль `app_runtime` має `CONNECT` до інших баз (`has_database_privilege('app_runtime', datname, 'CONNECT')` по `pg_database` без шаблонів і без `current_database()`). Текст називає бази, але не облікові дані. Ходить тим самим read-only шляхом, що й журнал (Е8-Р13: через ядро магазину).
- Рішення (рішення архітектора 2026-10-12, `rulings-plan-forks.md`): (б′) ігнорує `postgres`, `template0`, `template1`; попереджає про будь-яку іншу базу з `simplycms_migrations` або таку, куди `app_runtime` має `CONNECT` (`has_database_privilege`). Стоковий `PUBLIC CONNECT` дає попередження на будь-яку сторонню базу — так і треба: спільний кластер порушує вимогу. Текст: `у кластері є інші бази (<імена>) — магазину потрібен окремий екземпляр Postgres; спільний кластер ділить ролі app_runtime/app_admin між магазинами`.
- (в) `env.example`: заглушки секретів і паролів → порожні значення з коментарем, як згенерувати (`BETTER_AUTH_SECRET=` + `openssl rand -base64 32`; `DATABASE_URL=` + формат і роль `app_runtime`; так само `S3_*`, `SMTP_URL`, `MIGRATION_DATABASE_URL`). `doctor` дає `error` на відомих значеннях-заглушках — дослівно ті, що наведено у фактах (в). Список один, з ним працюють і doctor, і тест шаблону. Повідомлення називає ключ, а не значення.
- (г) S4-16. У git-індексі лежать симлінки `.claude/skills/tanstack-*`. Шість із них мають абсолютні цілі, які існують лише на одній машині: `tanstack-db-core`, `tanstack-db-meta-framework`, `tanstack-react-db` → `/tmp/claude-1000/…/scratchpad/tanstack-db-tarballs/…`; `tanstack-router-core`, `tanstack-start-core`, `tanstack-start-server-core` → `/home/vsydorenko/github/simplyCMS/node_modules/.pnpm/…`. `tanstack-react-start` і `tanstack-virtual-file-routes` — відносні (`../../node_modules/@tanstack/…`). Рішення: прибрати `.claude/skills/tanstack-*` з індексу (`git rm --cached`, локальні лінки розробника лишаються), додати `.claude/skills/tanstack-*` у `.gitignore`. Якщо скіли потрібні — скрипт або задокументований крок створює ВІДНОСНІ лінки на `node_modules/...`. Негативний контроль: тест «жоден симлінк у git-індексі не має абсолютної цілі» — `git ls-files -s` → записи з режимом `120000` → `git cat-file -p <blob>` → ціль не починається з `/`.
- (д) `docs/superpowers/specs/2026-10-12-pilot-readiness-design.md:16` називає приватну адресу Garage (`10.0.0.4:3900`) і назви проєктів Dokploy (`shared-storage` тощо). Узагальнити («спільне S3-сховище в приватній мережі Dokploy»): деталі інфраструктури пілоту живуть у проєкті alterenergy, не в публічному репо платформи. Після правки — `git grep -nE "10\.0\.0\.[0-9]+|shared-storage" -- docs ':!docs/superpowers/plans/**'` → порожньо або позначене (вивід — у звіт).
- 🔴 Правило архітектора (до відома оркестратора й власника): гілку не пушити окремо до PR rc.1 — звіти аудиту виходять публічно разом із виправленнями.

- [ ] **Step 1: Тести.** `cli-doctor`: `.env.local` з `BETTER_AUTH_SECRET=your-32-byte-random-secret` → `error`, текст називає `BETTER_AUTH_SECRET`, exit 1; `DATABASE_URL` з `your-password` → `error`; згенерований секрет → без цієї помилки. Шаблон: `env.example` не містить жодного значення зі списку заглушок. Онлайн (фейкове ядро): друга база з журналом → `warn` з її іменем; лише поточна (плюс `postgres`/`template0`/`template1`) → `ok`; стороння база без журналу, але з `CONNECT` для `app_runtime` → `warn` з текстом про окремий екземпляр Postgres. Скаффолдер/шаблон: у `package.json.tpl` немає `start:prod`; стартова команда платформи в скілі деплою й у підказках скаффолдера — `node scripts/start.mjs`. Харнес (б′): створити другу БД із `simplycms_migrations` у тестовому кластері → `warn`. Доки: `git grep -nE "pnpm start(:prod)?" -- README.md docs/development/ENVIRONMENT.md packages/create-simplycms-store/template/README.md` → кожен рядок або локальний запуск із позначкою «не для проду», або прибраний (вивід — у звіт). (г) `git-symlinks.test.ts`: кожен запис `120000` у `git ls-files -s` має ціль, що не починається з `/` (на HEAD плану FAIL на шести лінках `tanstack-*`).
- [ ] **Step 2: Прогнати** → FAIL; **Step 3: Реалізувати.**
- [ ] **Step 4: Прогнати** БЛ + `pnpm test:schema`. Мутації (рядок у звіті на кожну): прибрати `your-32-byte-random-secret` зі списку → FAIL doctor-тесту; відкат. Повернути заглушку в `env.example` → FAIL тесту шаблону; відкат. Онлайн-перевірка ігнорує інші бази → FAIL `warn`; відкат. Не виключати `postgres` → FAIL «лише поточна → `ok`»; відкат. (г) Додати в індекс тимчасовий симлінк з абсолютною ціллю (`ln -s /tmp/x .claude/skills/probe && git add -f …`) → FAIL `git-symlinks`; відкат (`git rm --cached`, видалити лінк).
- [ ] **Step 5: Commit** `fix(k3-e8): прод-старт лише start.mjs, власний Postgres на магазин, порожні заглушки env, без абсолютних симлінків у репо (Р28, S4-16)`.

---

## Хвиля Б1 — незалежне від А (можна виконувати до або між хвилями А)

### Task 17: `redesign-from-reference` → `simplycms-redesign`

**Files:** усі носії з розвідки:
- `packages/simplycms/skills/redesign-from-reference/` → `packages/simplycms/skills/simplycms-redesign/` (`git mv`);
- симлінки `.agents/skills/`, `.claude/skills/` (прямі, у пакет);
- `packages/create-simplycms-store/src/skill-links.mjs:27` (`BUNDLED_SKILLS`);
- `scripts/pilot-pack/{create-pkg-checks.mjs:123,link-skills.mjs,core-skills-parity.mjs,create-pkg-smoke.mjs:38,121}`;
- `.claude/commands/редизайн-за-референсом.md`;
- `tests/{cli-doctor.test.ts:316-334,cli-update.test.ts:162-189,create-store-skill-links.test.ts,create-store-template-parity.test.ts:11,212-220,design-import-*.test.ts}`;
- `AGENTS.md:33,237,239`, `CLAUDE.md:13,23`, `docs/guides/redesign-from-reference.md` (→ `simplycms-redesign.md`), `docs/tasks/platform-roadmap.md:315,1857,1878`, `.gitignore:61`, `.prettierignore:32`, `eslint.config.mjs:630`, `template/README.md:125`, `themes/default/*` (корінь → `template:sync`).

**Interfaces:**
- Produces: ім'я скіла `simplycms-redesign`. `simplycms update` прибирає лінк зі старим ім'ям: це вже робить механізм «прибирає осиротілі» в `syncSkillLinks`. Тест доводить це саме для `redesign-from-reference`.

- [ ] **Step 1:** тест `cli-update`: магазин з лінком `.claude/skills/redesign-from-reference` (ціль більше не існує) → після `update` лінка немає, `simplycms-redesign` є.
- [ ] **Step 2:** перейменування всіх носіїв.
- [ ] **Step 3: Прогнати** БЛ + `git grep -n "redesign-from-reference" -- ':!CHANGELOG.md' ':!docs/superpowers/**'` → порожньо або лише позначені історичні розділи `docs/tasks/*`. Мутація: прибрати очищення осиротілих у `skill-links.mjs` → FAIL Step 1; відкат.
- [ ] **Step 4: Commit** `refactor(k3-e8): скіл redesign-from-reference → simplycms-redesign`.

### Task 18: Вступ, керований блок `AGENTS.md`, `update` доглядає блок і хук

**Files:**
- Create: `packages/simplycms/agent/{intro.md,claude-md.md,permissions.json}` (`permissions.json` — рекомендовані `permissions.allow`/`ask` Claude Code для магазину: читання й `pnpm simplycms status|doctor` — allow; `db:apply`, скрипти онбордингу, `git push` — ask) (джерело вступу і специфіки Claude Code; `files` пакета += `agent`), `packages/cli/src/managed-block.mjs`, `packages/cli/src/hook-entry.mjs`, `packages/create-simplycms-store/template/{AGENTS.md,CLAUDE.md}`, `tests/managed-block.test.ts`, `tests/hook-entry.test.ts`
- Modify: `scripts/sync-create-store-template.mjs` (рендер блоку в шаблонний `AGENTS.md`), `tests/create-store-template-parity.test.ts`, `packages/cli/src/update.mjs` (блок, запис хука, Е8-Р12; re-exec нового CLI після `pnpm add` — Р21, `:99-128`), пакувальний кейс Р21 у Gate TOOL (`scripts/pilot-pack/tool-pkg-smoke.mjs`) або в `pilot-pack`, `packages/cli/src/doctor-fs-checks.mjs` (№18 `agent-files`; №15 `checkMailConfigured` (Е8-Р17), №16 `checkEmailVerification` (Р30, Task 12b) і №17 `engines` (Р32, Task 16b) зайняті: розбіжність блоку, відсутній запис хука → `warn`; у `details` — рекомендовані дозволи Claude Code «читання вільно, зміни через підтвердження» з `packages/simplycms/agent/permissions.json`, бо `update` дозволи не зливає)

**Interfaces:**
- Produces (`managed-block.mjs` — одна реалізація для синку і `update`, Е8-Р5):
  ```js
  export const BLOCK_BEGIN = '<!-- simplycms:begin (керується `simplycms update`; текст поза маркерами — ваш) -->';
  export const BLOCK_END = '<!-- simplycms:end -->';
  export function renderManagedBlock(introMd: string): string;            // BEGIN + intro + правило «почни з `pnpm simplycms status`» + END
  /** @returns {{ status: 'ok'|'drift'|'missing'|'damaged', next?: string }} */
  export function applyManagedBlock(fileText: string, block: string);
  ```
  `damaged` — маркер один, два BEGIN, END перед BEGIN; `missing` — маркерів немає зовсім (або немає файлу). В обох випадках `next` не повертається, `update` нічого не пише й друкує, що робити: два маркери, куди їх вставити, і `pnpm simplycms update` повторно (Б §3.3: «маркери відсутні чи пошкоджені → update нічого не пише»). Код `--check` — 3.
- `hook-entry.mjs`: `ensureSessionStartHook(settingsJsonText: string): { status: 'ok'|'added'|'updated', next: string }` — шукає запис за командою `node .claude/hooks/session-start.mjs` (початкова форма; амендмент 2026-10-12: канонічний запис — exec-форма `node` + `args: ["${CLAUDE_PROJECT_DIR}/.claude/hooks/session-start.mjs"]`, старий відносний `update` розпізнає й оновлює) у `hooks.SessionStart[]` з matcher `startup|clear|compact`; інші ключі й записи — без змін; невалідний JSON → помилка без запису.
- `update`: `--check` — без мережі й install, код 3 на будь-яку розбіжність (host-файли, блок, хук, шим, лінки), 1 — помилка (Е8-О8); `--write` — пише; без прапорців — як раніше, плюс блок і хук.
- **Р21 (Opus підтвердив експериментом; дефект сидить у версії, З ЯКОЇ оновлюються, тож мусить бути закритий у rc.1).** Зараз `update` робить `pnpm add` дочірнім процесом (`update.mjs:111-117`), а далі `findHostDrift(storeRoot)` (`:128`) звіряє host-файли з `CANON_HOST_DIR` ЗАПУЩЕНОГО CLI (`host-drift.mjs:17-19`, від `import.meta.url`). Node резолвить реальний шлях біна в `.pnpm/@simplycms+cli@<стара>/host`, і pnpm цю теку не прибирає. На офлайн-tarball-ах 0.0.1→0.0.2 `update` друкує «✓ Host-файли збігаються з каноном», хоча канон 0.0.2 інший. Тож одиночний `update --write` нових host-файлів не доставляє, і шим хука з Task 20 так не доїде. Рішення: після встановлення пакетів `update` передає керування НОВОМУ CLI — re-exec `node <storeRoot>/node_modules/@simplycms/cli/<bin.simplycms з його package.json> update --after-install <той самий argv>`. Новий процес install пропускає, бере свій канон і робить перевірку чи запис (host-файли, блок, хук, лінки). Код виходу дочірнього = код `update`. `--no-install` і `--check` re-exec не роблять. Відхилено: «канон з `node_modules/simplycms/host` у старому процесі», бо стара логіка порівняння лишається. Шов — той самий `deps.exec` (Step 3).

- [ ] **Step 1: `managed-block.test.ts`:** файл без маркерів → `missing`, без `next`; файл із порожньою парою маркерів → блок вставлено між ними; повторне застосування → `ok`, байт-у-байт той самий текст; текст власника до й після маркерів — байт-у-байт незмінний після оновлення блоку; кожна форма `damaged` → без `next`; паритет: блок у `template/AGENTS.md` === `renderManagedBlock(intro.md)` і блок, який рендерить `update` для свіжого магазину, — той самий рядок.
- [ ] **Step 2: `hook-entry.test.ts`:** порожній `{}` → `added`; зі сторонніми хуками `PreToolUse` → їх збережено; повторно → `ok`; змінена команда → `updated`; невалідний JSON → помилка.
- [ ] **Step 3: `cli-update.test.ts`:** `update --check` на магазині без мережі: `run` отримує ін'єкцію раннера процесів (`deps.exec`, дефолт — `execFileSync`; той самий шов для `pnpm view` і `pnpm add`, `update.mjs:42,112`), фейк кидає на будь-який виклик → `--check` його не кличе; код 3 при розбіжності блоку; код 0 без розбіжностей.
- [ ] **Step 3а: Р21, пакувальний тест** (Gate TOOL або кейс `pilot-pack`). Два tarball-и `@simplycms/cli` з різними host-канонами (стара й нова версії). Магазин на старій, один виклик `update --write` з офлайн-джерелом нової → host-файли магазину = канон НОВОЇ версії, у виводі немає «збігаються з каноном» до запису. Юніт у `cli-update.test.ts`: після `add` `deps.exec` отримує виклик `node …/@simplycms/cli/<bin> update --after-install …` з тим самим argv; з `--after-install` install і повторний re-exec не викликаються; `--no-install` → re-exec немає.
- [ ] **Step 4: Прогнати** → FAIL; **Step 5: Реалізувати.** `intro.md` (≤60 рядків): принципи (прев'ю → згода → застосувати; секрети лише файлами `0600`, у розмову не потрапляють; дані недоторкані — міграції лише нові; каталог наповнюється в адмінці) + таблиця «намір → скіл» (`simplycms-onboarding`, `simplycms-update`, `simplycms-diagnose`, `simplycms-redesign`). `claude-md.md`: `@AGENTS.md` + специфіка Claude Code (хук старту, дозволи «читання вільно, зміни через підтвердження»).
- [ ] **Step 6: Прогнати** `pnpm template:sync`, БЛ. Мутації: `applyManagedBlock` замінює весь файл → FAIL «текст власника незмінний»; відкат. `--check` викликає install → FAIL Step 3; відкат. Ручна правка блоку в `template/AGENTS.md` → паритет FAIL; відкат. Прибрати re-exec (звірка в старому процесі) → FAIL пакувального кейсу Step 3а (host-файли лишились старими); відкат. Re-exec без `--after-install` → FAIL юніта «повторний install не викликано» (або нескінченний цикл, зупинений тестом); відкат.
- [ ] **Step 7: Commit** `feat(k3-e8): керований блок AGENTS.md і запис хука — одна реалізація для шаблону й update`.

### Task 19: Каркас `simplycms status`

**Files:**
- Create: `packages/cli/src/status.mjs`, `packages/cli/src/status-stage.mjs`, `tests/cli-status.test.ts`
- Modify: `packages/cli/src/{index.mjs,doctor-checks.mjs}` (експорт спільного списку перевірок), `docs/architecture/cli.md`, `docs/architecture/test-contours.md:71` (К4(а): рядок Gate TOOL пише «`--help` згадує всі 6 команд», а в `COMMANDS` (`packages/cli/src/index.mjs:8-16`) на HEAD плану їх 7; після `status` — 8, і число оновлює й Task 21 зі `smoke` — звір із фактичним `COMMANDS` на момент коміту)

**Interfaces:**
- Consumes: `runOfflineChecks(ctx)` (`doctor-checks.mjs`) — та сама реалізація; групи env — `resolveDriverEnv` через `importFromStore(storeRoot,'simplycms/env')`.
- 🔴 Контекст офлайн-перевірок `status` будує ЛИШЕ через `buildOfflineContext(storeRoot, { production })` (`packages/cli/src/doctor.mjs`, Task 16b — спільна з `doctor`), не власним складанням: інакше перевірка №17 `engines` (Р32) тихо стає `skip`.
- Produces: `simplycms status [--json|--hook]`. Коди виходу: `0` — все гаразд; `3` — є що робити; інший — стан невідомий. JSON: `{ stage: 'not-created'|'local'|'deployed', checks: Check[], next: { skill: string, reason: string } | null, unknown: string[] }`. `--hook` — вступ (`node_modules/simplycms/agent/intro.md`, той самий файл, з якого рендериться керований блок, Б §3.4) + стан ≤25 рядків. Режим «прод» — як у `doctor` (Task 9, Step 5а, Е8-Р17): `--production` у `status` (крім `--hook`). Таймаут на всю команду ~5 с; кожна перевірка, що не вклалась, потрапляє в `unknown`, а не зникає.
- `deriveStage({ hasStoreRoot, deployJson }): Stage` і `nextSkill({ stage, checks }): { skill, reason } | null` — чисті функції в `status-stage.mjs`. Онлайн-частина (БД, журнал, власник, профіль, `/api/health` домену) — Task 21.

- [ ] **Step 1: Тести:** паритет вступу: текст вступу у виводі `--hook` === вміст між маркерами `renderManagedBlock(intro)` без рядка-правила (одна функція виділення, імпорт із `managed-block.mjs`); тека без магазину → `not-created`, `next.skill === 'simplycms-onboarding'`, код 3; магазин без `.simplycms/deploy.json` → `local`; з ним → `deployed`; перевірка, що кидає, → `unknown` непорожній і код ≠ 0/3; `--json` парситься; `--hook` ≤25 рядків і містить етап і наступний скіл; повільна перевірка (фейк 10 с) → загальний час <6 с і запис у `unknown`. Магазин із плагіном, `engines.simplycms` якого не задовольняє встановлене ядро → `status --hook` містить error №17 `engines` (рядок із назвою пакета й дією «онови плагін або відкоти ядро»), код 3.
- [ ] **Step 2: Прогнати** → FAIL; **Step 3: Реалізувати**; **Step 4: Прогнати** БЛ. Мутація: `status` повертає 0, коли `unknown` непорожній → FAIL; відкат. Мутація: `status` будує власний контекст без `engines` (замість `buildOfflineContext`) → FAIL кейсу №17; відкат.
- [ ] **Step 5: Commit** `feat(k3-e8): simplycms status — етап, наступний скіл, коди 0/3/невідомо`.

### Task 20: Шим хука старту сесії і файли агента в шаблоні

**Files:**
- Create: `packages/create-simplycms-store/template/.claude/{settings.json,hooks/session-start.mjs}`, `tests/session-start-shim.test.ts`
- Modify: `packages/cli/package.json` — `exports` і `publishConfig.exports` += `"./package.json": "./package.json"` (зараз експортується лише `"."`, `packages/cli/package.json:11-20`, тож `resolve('@simplycms/cli/package.json')` дав би `ERR_PACKAGE_PATH_NOT_EXPORTED`); `tests/create-store-template-parity.test.ts:203-207` — кейс «шаблон не несе копії скілів» перевіряє вже не відсутність `.claude`, а відсутність `.claude/skills` і `.agents/skills` (причина кейсу — копії скілів, не тека загалом)
- Modify: `scripts/pilot-pack/{create-pkg-checks.mjs,create-pkg-smoke.mjs}` (Gate CLI), `scripts/pilot-pack/tool-doctor-smoke.mjs` (Gate TOOL), `docs/architecture/test-contours.md` §3

**Interfaces:**
- Consumes: `simplycms status --hook` (Task 19), `intro.md` через блок (Task 18).
- Produces: `session-start.mjs` — шим без логіки, ESM, лише `node:*` модулі: знаходить CLI магазину через `createRequire(join(root,'package.json')).resolve('@simplycms/cli/package.json')` → поле `bin.simplycms` (не внутрішній шлях `src/index.mjs`: розкладка пакета може змінитись — Е8-О5), корінь — `CLAUDE_PROJECT_DIR` або `cwd`; запускає його `status --hook` з таймаутом 8 с, stdout/stderr — у тимчасові файли (не пайп: урок SMP про дедлок); друкує `{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"<вступ зі статусом>"}}`; ЗАВЖДИ код 0. Немає CLI → «УВАГА: стан магазину невідомий — залежності не встановлено. Виконай `pnpm install`». Таймаут, невідомий код, порожній чи зламаний вивід → «УВАГА: стан невідомий (<причина>). Виконай `pnpm simplycms status`». `settings.json` шаблону: рівно запис `SessionStart` (matcher `startup|clear|compact`, `timeout: 10`).
- Шим — host-файл (Е8-О5): `.claude/hooks/session-start.mjs` входить у канон host-файлів CLI (`packages/cli/host/`, `findHostDrift`/`writeHostFiles`), тож `simplycms update` оновлює його в наявних магазинах, а `doctor` №6 показує дрейф. Джерело — `packages/create-simplycms-store/template/.claude/hooks/session-start.mjs`; копію в `packages/cli/host/` синхронізує `pnpm template:sync` (додати в `SYNCED_FILES`) під тестом парності.

- [ ] **Step 1: `session-start-shim.test.ts`** (дочірній процес, tmp-теки): без `node_modules` → код 0, JSON валідний, текст «pnpm install»; фейковий CLI, що спить 20 с → код 0 за ≤10 с, «УВАГА»; фейковий CLI з виходом 2 і сміттям у stdout → код 0, «УВАГА»; фейковий CLI з кодом 3 і текстом → `additionalContext` містить текст; CLI з іншою розкладкою (`bin` → `dist/cli.mjs`, `src/` немає) → шим знаходить його через `package.json`; магазин зі старим шимом → `update --check` код 3, `update` замінює файл; шим не пише у файли проєкту (знімок дерева до/після).
- [ ] **Step 2: Вимір `npm pack`.** `pnpm --filter create-simplycms-store pack` → `tar -tzf` містить `package/template/.claude/settings.json` і `package/template/.claude/hooks/session-start.mjs`. Результат — у звіт. Якщо ріже — перейменування за схемою `gitignore` (`RENAMES` у `scaffold.mjs:107-111`) + запис у звіті.
- [ ] **Step 3: Gate CLI:** `bin`-скаффолд у tmp (`--no-install --no-git`) має `AGENTS.md` (з блоком), `CLAUDE.md` (`@AGENTS.md`), `.claude/settings.json`, шим; запуск шима там → «pnpm install», код 0. **Gate TOOL:** у скретчі з `node_modules` запуск шима → код 0, `additionalContext` містить етап `local`; симлінки скілів живі (`realpath` резолвиться в `node_modules/simplycms/skills/*`).
- [ ] **Step 4: Прогнати** → FAIL; **Step 5: Реалізувати**; **Step 6: Прогнати** БЛ + `pnpm pilot:pack`. Мутації: шим виходить кодом 1 на таймауті → FAIL; відкат. Видалити `.claude/settings.json` з шаблону → Gate CLI FAIL; відкат. Зламати симлінк скіла в скретчі (ціль → неіснуюча тека) → Gate TOOL FAIL; відкат. Додати `template/.claude/skills/x/SKILL.md` → парність FAIL; відкат.
- [ ] **Step 7: Commit** `feat(k3-e8): хук старту сесії магазину й файли агента в шаблоні`.

---

## Хвиля Б2 — після команд А

### Task 21: Онлайн-частина `status`, `.simplycms/deploy.json`, `simplycms smoke`

**Files:**
- Create: `packages/cli/src/{status-online.mjs,deploy-record.mjs,smoke.mjs,smoke-checks.mjs}`, `tests/{cli-status-online.test.ts,cli-smoke.test.ts,deploy-record.test.ts}`
- Modify: `packages/cli/src/{status.mjs,index.mjs}`, `packages/cli/src/doctor-db-checks.mjs` (спільні онлайн-перевірки для `doctor --online` і `status`), `docs/architecture/cli.md`

**Interfaces:**
- Consumes: `readJournal`, `listMigrationFiles`, `pendingMigrations` (Task 3), `resolveDriverEnv` (Task 1).
- Produces у `simplycms/migrate` (операційне читання БД магазину для CLI; одна реалізація для `doctor --online` і `status`): `readStoreFacts(runtimeConnectionString): Promise<{ owners: number; profile: { name: string; email: string | null } | null; failedMail: number }>` — та сама read-only транзакція з `set local role app_admin`, що й `readJournal`. Модуль `simplycms/mail` CLI не імпортує: той тягне пул `simplycms/db` з `process.env`, а CLI env процесу не мутує.
- Produces:
  - `deploy.json` (закомічений, без секретів): `{ "version": 1, "dokploy": { "url", "projectId", "applicationId", "postgresId" }, "domain", "bucket", "createdAt" }`. `readDeployRecord(root)`, `writeDeployRecord(root, rec)`; валідатор відкидає будь-які поля поза схемою (Е8-Б4: перевірку значень за словами на кшталт `secret` не робимо — хибні спрацювання на іменах ресурсів).
  - Онлайн-перевірки `status` і `doctor --online` (спільний модуль): БД доступна; ненакатані міграції; власник є (`user_roles` admin ≥1); профіль (`name`, `contacts.email`) заповнений — порожній email → `warn` «листи власнику про замовлення не надходитимуть»; невдалі листи → `warn`; при `stage==='deployed'` — `GET https://<domain>/api/health` (таймаут 3 с) → `ok`, `build`.
  - `simplycms smoke <url>`: `/api/health` (`status:'healthy'`, `build` непорожній), `/`, `/catalog`, `/admin` (редирект на вхід), `/robots.txt`, стиснення `br` на `/assets/<entry>.js` (entry з HTML), POST 3 МБ на `/_serverFn/x` → 413 (не 502). Вивід `✓/✗ назва — деталь`, код 1, якщо хоч одна червона. Чисті перевірки — у `smoke-checks.mjs` під юнітом; мережа — тонкий шар.

- [ ] **Step 1: Тести** (фейкове ядро й локальний HTTP-сервер): кожна онлайн-перевірка ок/warn/error; `deploy.json` із полем поза схемою (`"apiKey"`) → відмова валідатора; `"bucket": "secret-shop"` → приймається; `dokploy.url` з userinfo (`https://u:p@dokploy.x`) → відмова; `smoke` проти сервера, що на 3 МБ відповідає 502, → `✗` і код 1; проти сервера без `br` → `✗`.
- [ ] **Step 2: Прогнати** → FAIL; **Step 3: Реалізувати**; **Step 4: Прогнати** БЛ + живий `pnpm simplycms smoke http://127.0.0.1:<port>` проти скретча `pnpm pilot --keep` (вивід — у звіт). Мутації: `smoke` вважає 502 на 3 МБ успіхом → FAIL; відкат. Валідатор `deploy.json` пропускає поля поза схемою → FAIL; відкат. Онлайн-перевірка власника рахує будь-якого користувача, а не роль admin → FAIL; відкат. Порожній `contacts.email` → `ok` замість `warn` → FAIL; відкат.
- [ ] **Step 5: Commit** `feat(k3-e8): онлайн-стан status, запис деплою без секретів, simplycms smoke`.

### Task 22: Скіл `simplycms-onboarding` і Dokploy-скрипти

**Files:**
- Create: `packages/simplycms/skills/simplycms-onboarding/{SKILL.md,references/{requirements.md,local.md,dokploy.md,garage-bucket.md,smtp.md,backups-restore.md,summary.md},scripts/{dokploy.mjs,dokploy-env.mjs,prod-run.mjs,secrets-file.mjs}}`, тести `tests/onboarding-scripts.test.ts`
- Modify: симлінки `.agents/skills/`, `.claude/skills/` (прямі, у пакет); `BUNDLED_SKILLS`

**Interfaces:**
- Produces:
  - `SKILL.md` (≤120 рядків): frontmatter `name`, `description` (тригери англійською й українською); шапка-ланцюжок етапів 1–8 зі спеки Б §3.5; розділ «Межі» (що скіл НЕ робить: наповнення каталогу, DNS без згоди, створення сервісів Dokploy без згоди, видалення); правило «прев'ю → згода → застосувати» для кожного кроку мутації; стан продовжується з `deploy.json` і `status`.
  - `scripts/` — перенесення `klasnakasa/tooling/scripts/src/{dokploy,dokploy-env,prod-run}.mjs` без зашитих ID: ідентифікатори з `.simplycms/deploy.json`, облікові дані Dokploy — `DOKPLOY_URL`/`DOKPLOY_API_KEY` з файлу секретів, НЕ з `~/.claude.json`. `dokploy-env.mjs set KEY` читає значення зі stdin (відмовляє на TTY, порожньому значенні й `\n`) або напряму з файлу секретів: `--from-secrets <файл>` (амендмент 2026-10-12); `saveEnvironment` завжди з `createEnvFile:false`. `prod-run.mjs` видаляє розклад у `finally`. `secrets-file.mjs init <path>` створює git-ігнорований файл `0600` з порожніми ключами і НЕ друкує значень; команду `pipe` ПРИБРАНО (амендмент 2026-10-12): шлях без виводу — `dokploy-env.mjs set KEY --from-secrets <path>`. Пошук ресурсу за ID/ім'ям перед створенням (ідемпотентність). Механічна згода (Б §2, анти-ціль «незворотні дії без явної згоди»): кожен мутуючий виклик (створення сервісу, `saveEnvironment`, `prod-run`, домен) без `--confirm` друкує прев'ю (що буде створено/змінено, лише імена ключів) і виходить кодом 3, нічого не змінивши.
  - `references/dokploy.md`: Postgres 17 (пастка дефолтного `postgres:18` з томом не туди), Railpack з `RAILPACK_START_CMD="node scripts/start.mjs"`, `RAILPACK_NODE_VERSION=24`, autoDeploy, домен і TLS (Cloudflare DNS only), `MIGRATION_DATABASE_URL` власника схеми, бекапи БД і тому, разове запрошення власника через `prod-run` — ПІСЛЯ налаштування SMTP і без `--print-link` (Е8-С2: посилання з адмінським токеном не має потрапити у вивід, що йде в розмову агента). `garage-bucket.md` — крок власника (`GARAGE_DEPLOYMENT.md` §6 klasnakasa, параметризовано), перевірка з контейнера (`403` = мережа є); позначка «наш варіант інфраструктури, магазин стороннього власника приносить будь-яке S3».
  - Р28(б), рішення власника: `references/requirements.md` і `references/dokploy.md` прописують вимогу «КОЖЕН магазин — ВЛАСНИЙ екземпляр Postgres» з причиною: ролі `app_runtime`/`app_admin` кластерні, синк пароля одного магазину ламає інший, а через `SET LOCAL ROLE app_admin` видно чужу базу. Скіл не створює БД магазину в чужому кластері.
  - Е8-Р17: крок перевірки після деплою і `summary.md` кличуть `pnpm simplycms doctor --online --production` (у плані Task 22 цього рядка не було, хоча Р17 його вимагає) — не `doctor` без прапорця.

- [ ] **Step 1: Тести скриптів** (фейковий `fetch`): `dokploy-env set` з TTY → код 2; з порожнім stdin → код 2; тіло `saveEnvironment` має `createEnvFile:false` і змінює рівно один ключ, решта блоку байт-у-байт; вивід не містить значення; `prod-run` викликає `schedule.delete` і при помилці `runManually`; будь-який мутуючий скрипт без `--confirm` → код 3, фейковий `fetch` не отримав жодного не-GET запиту; `secrets-file init` створює файл із правами `0o600` і додає шлях у `.gitignore`. Тексти скіла: `SKILL.md` + `references/` містять `doctor --online --production` і вимогу власного екземпляра Postgres (перевірка — у `store-skills.test.ts` Task 23 або тут, на вибір виконавця).
- [ ] **Step 2: Прогнати** → FAIL; **Step 3: Реалізувати**; **Step 4: Прогнати** БЛ. Мутація: прибрати відмову на TTY → FAIL; відкат. `createEnvFile:true` → FAIL; відкат. Замінити в скілі `doctor --online --production` на `doctor --online` → FAIL перевірки текстів; відкат.
- [ ] **Step 5: Commit** `feat(k3-e8): скіл simplycms-onboarding і Dokploy-скрипти без витоку секретів`.

### Task 23: Скіли `simplycms-update`, `simplycms-diagnose` і тести скілів

**Files:**
- Create: `packages/simplycms/skills/{simplycms-update,simplycms-diagnose}/{SKILL.md,references/*}`, `tests/store-skills.test.ts`
- Modify: `packages/cli/src/index.mjs:8` — `export const COMMANDS` (зараз модуль-приватна константа; `main()` лишається поведінково тим самим)
- Modify: симлінки, `BUNDLED_SKILLS`, `packages/simplycms/agent/intro.md` (таблиця «намір → скіл» — якщо змінились формулювання)

**Interfaces:**
- Produces:
  - `simplycms-update`: кроки спеки Б §3.5.2; перехід мажорної версії — лише свідомо: `update` зупиняється кодом 3, агент читає BREAKING у `CHANGELOG` між версіями, узгоджує з власником і запускає `simplycms update --to X` (Task 16); ризикова міграція → ручний бекап перед деплоєм; посилання на `CHANGELOG` (розділ BREAKING) з `node_modules/simplycms/CHANGELOG.md` — перевірити, що файл у `files` пакета, інакше додати.
  - `simplycms-diagnose`: `status`/`doctor --online`; логи Dokploy (`application.readLogs` через скрипт онбордингу — посилання, не копія); `references/pitfalls.md` у форматі «симптом → причина → що робити» (мінімум: часткова група env, `UnjournaledDatabaseError`, `MigrationChecksumError`, 503 на `/media`, невдалі листи, застарілий чанк, `TRAEFIK DEFAULT CERT`, `Installing railpack → curl exit 22`); відновлення з бекапу як процедура.
- `tests/store-skills.test.ts` (Б §3.7):
  - кожен `packages/simplycms/skills/simplycms-*/SKILL.md` має frontmatter `name` = ім'я теки і `description`, а також розділ `## Межі`; `SKILL.md` ≤150 рядків;
  - кожна команда `simplycms <cmd>` у скілах і `references/` є ключем `COMMANDS` (`packages/cli/src/index.mjs`, імпорт, не регексп по файлу); кожен `pnpm <script>` — скрипт `template/package.json.tpl` або вбудована команда pnpm зі списку `['install','up','add','exec','create','dlx']`;
  - кожен відносний шлях `references/*.md`/`scripts/*.mjs`, згаданий у `SKILL.md`, існує;
  - таблиця «намір → скіл» в `intro.md` перелічує рівно теки `simplycms-*`.
  - жоден скіл і `references/` не містять `@latest` для пакетів SimplyCMS (у RC-період вхід — `pnpm create simplycms-store@next`; скіл, що зашиває тег, з часом бреше).

- [ ] **Step 1: `store-skills.test.ts`** → FAIL (скілів немає); **Step 2:** тексти; **Step 3: Прогнати** БЛ. Мутації: згадати `simplycms deploy` у скілі → FAIL; відкат. Прибрати `## Межі` з одного скіла → FAIL; відкат. Додати скіл без рядка в таблиці → FAIL; відкат.
- [ ] **Step 4: Commit** `feat(k3-e8): скіли simplycms-update і simplycms-diagnose, тести скілів магазину`.

### Task 24: Скаффолдер — мінімум кроків

**Files:**
- Modify: `packages/create-simplycms-store/src/steps.mjs:103` (`printNextSteps`), `packages/create-simplycms-store/README.md`, `template/README.md` (розділ «Агент і деплой»), тести скаффолдера (`tests/create-store-*.test.ts`)

**Interfaces:**
- Produces: фінальне повідомлення — одне речення: «Магазин створено в `<тека>`. Відкрийте агента (Claude Code чи Codex) у цій теці й скажіть: «розгорни магазин».» Довідкові кроки для людини без агента — у `template/README.md`, а не в консолі. README пакета на npm: перший розділ «Для агента: з порожньої теки» — `pnpm create simplycms-store@next <тека>` у RC-період (README і скіл онбордингу не зашивають `@latest`; тег у README — той, під яким публікується версія: тест порівнює його з `distTagFor(version)`) → відкрити агента в теці → хук і `AGENTS.md` поведуть на `simplycms-onboarding`. Твердження «Листів магазин не шле» прибрати.

- [ ] **Step 1: Тест:** вивід `printNextSteps` — рівно одне речення-нотатка без `psql`, `cp .env.example`; README пакета містить розділ «Для агента» першим після назви. **Step 2:** реалізувати. **Step 3: Прогнати** БЛ + `pnpm pilot:pack`. Мутація: повернути цикл `psql` у нотатку → FAIL; відкат.
- [ ] **Step 4: Commit** `feat(k3-e8): скаффолдер — одне речення для власника, вхідна точка агента в README`.

---

## Хвиля Ф — носії стану й фінальний доказ

### Task 25: Носії стану, амендмент спек, фінальний ланцюг

**Files:**
- Modify: `docs/tasks/platform-roadmap.md` (Е8 А+Б виконано; закриті борги 0.4.1-6…9, Е6г-5/6/9/13, К2-Е0-1; Е6г-12 лишається), `docs/tasks/v2-state-map.md` (§3.3 «Листи не відправляються» → чинний стан; накат; S3; старт), `CHANGELOG.md` — розділ `[1.0.0-rc.1]` (дата — у день релізу; реліз-коміт `chore(release): v1.0.0-rc.1` робить `pnpm release 1.0.0-rc.1` за словом власника). BREAKING: Node 24, `update --check` без install і мережі, перейменування скіла, заморожування baseline, `SendAuthEmail` прибрано, `owner:invite` без посилання при SMTP, діапазони `engines` `^M`, `docs/architecture/{cli.md,storage.md,release-process.md,test-contours.md,data-layer.md,repository-layout.md,upstream-workarounds.md}`, `docs/development/{ENVIRONMENT.md §2 «Запуск у проді»,TOOLING.md}`, `AGENTS.md` (пакети й реліз: правило заморожування міграцій одним рядком), специ А і Б (розділ «Амендмент (план, 2026-10-12)»: Е8-Р1…Р14, О1–О8, Б1–Б5, В1–В4, С1–С2, рішення власника про semver і RC, таблиця розбіжностей; у тілі спек: А §3 — драйвер `log` у проді без тіла (С1), А §6 — посилання запрошення лише за С2, обидві спеки — `0.15.0` → `1.0.0-rc.1`). Амендмент переносить і рішення після аудиту Р15–Р30 (+ К1, К4(а), Д2, Д5) разом з іншими (розділ «Рішення після аудиту»). `tests/migrations-frozen.test.ts`: `FROZEN` охоплює ВСІ міграції, що їдуть у rc.1 (на HEAD плану — `0000…0005`, плюс усі, що додали хвилі після), а не лише `0000–0004`. Зараз тест фільтрує канон за ключами `FROZEN` (`:38`), тож новий файл поза списком мовчки не стережеться. Тест асертить, що множина файлів канону == ключі `FROZEN`. YAML публікації CI (`.github/workflows/publish-packages.yml`) тут не чіпати: єдина правка цього файлу в плані — рядок `--tag` у Task 16; захист публікації (provenance, environment, Trusted Publishing) роблять архітектор з власником перед PR.

- [ ] **Step 1:** оновити носії. Перевірка «скасоване рішення в усіх носіях»: `git grep -nE "stubSendAuthEmail|SendAuthEmail|SendInviteEmail|redesign-from-reference|psql -f|>=22\.12|рівно ТРИ|0\.15\.0|start:prod|роль admin на місці|Відкрите вікно" -- ':!CHANGELOG.md' ':!docs/superpowers/**'` → кожен рядок або оновлено, або це позначений історичний розділ. Вивід — у звіт.
- [ ] **Step 2: Фінальний доказ.** `pnpm harness:up`, БЛ повністю, `pnpm live:smoke`, `node scripts/release/pilot-full.mjs`. Перевірка трейлерів (Global Constraints). Підсумок кожного гейту (команда → результат) — у звіт.
- [ ] **Step 3: Мутація головних гейтів (повтор на фінальному дереві).** `migrations-frozen` (пробіл у `0002`), Gate B `environ` (`spawn` замість `execve`), `s3.contract` (без `HEAD`), `mail-outbox` («успіх → рядка немає»), `session-start-shim` (код 1 на таймауті), `release-prerelease` (`compareVersions` ігнорує суфікс), `upgrade-1x` (звірка сум лише для заморожених), `migrations-frozen` (новий файл канону поза `FROZEN`). Кожна → червоний → відкат → зелений.
- [ ] **Step 4: Commit** `docs(k3-e8): носії стану, амендмент спек А і Б`.
