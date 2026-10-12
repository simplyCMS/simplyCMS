# К3-Е8 (А+Б): готовність до пілоту й агентний супровід магазину — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Магазин, створений з npm, розгортається на Dokploy зі своєю БД, бакетом S3, поштою через SMTP і накатом міграцій на старті. Агент у магазині з першої сесії бачить стан і наступний крок і веде власника від порожньої теки до живого магазину. Обидві частини йдуть одним релізом — першим пререлізом `1.0.0-rc.1` (npm-тег `next`). Е8 (зовнішній агент розгортає пілот саме з RC) — після релізу, цей план його не робить; знайдене в Е8 закривається в `rc.2…`, а `1.0.0` — окремим рішенням після живого пілоту.

**Architecture:** Хвиля А0 вводить чистий резолвер груп env (`simplycms/env`) і Node 24. Хвиля А1 замінює психологію «накоти psql-циклом» на журнал із контрольними сумами в ядрі (`simplycms/migrate`): одна реалізація для проду, харнесу, `db:demo`, CLI, `doctor` і `status`. Перед заморожуванням baseline у нього вносяться дешеві борги схеми. Хвиля А2 — прод-старт (`scripts/start.mjs` + `process.execve`), ідентифікатор збірки, стиснення статики, 413 без закриття з'єднання. А3 додає драйвер `s3` за наявним контрактом. А4 додає порт пошти `simplycms/mail` з outbox `mail_outbox` (перша append-only міграція `0005`). Хвиля Б1 (не залежить від А): перейменування скіла, керований блок інструкцій, каркас `status`, шим хука. Б2 (після А): онлайн-перевірки `status`, `smoke`, тексти скілів онбордингу, оновлення й діагностики, мінімальний скаффолдер.

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
- **Е8-Р7.** `resolveDriverEnv(env)` — чиста функція в новому server-only субшляху `simplycms/env` (не в `runtime`: там client-safe речі). Точки виклику: `server.mjs` до імпорту хендлера, `start.mjs`, фабрики драйверів, `doctor`/`status`. Помилка називає саме відсутні ключі й не містить значень.
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
- **Е8-С2.** `owner:invite` друкує посилання лише коли драйвер `log` поза продом або з явним `--print-link`. Зі SMTP — «лист надіслано на <email>». У проді без SMTP і без `--print-link` — код 1 з поясненням «налаштуй `SMTP_URL`/`MAIL_FROM` або свідомо `--print-link`». Скіл онбордингу ставить SMTP ДО кроку запрошення й `--print-link` не вживає.

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
  Порядок: `resolveDriverEnv(env)` (часткова група → вихід 1 до накату; `warnings` → `log`) → якщо задано `MIGRATION_DATABASE_URL` → `migrate({ connectionString, dir: join(cwd,'db/migrations'), runtimeUrl: env.DATABASE_URL, log })`; помилка → вихід 1 → `execve(process.execPath, [process.execPath, join(cwd,'server.mjs')], envWithout(STRIPPED_ENV))`. Немає `process.execve` → вихід 1 з текстом «потрібен Node ≥ 24 (process.execve); стартова команда — `node scripts/start.mjs`».
- `server.mjs`: при наповненні з `.env.local`/`.env` пропускає ключі `STRIPPED_ENV` (дублікат списку в `server.mjs` з коментарем-посиланням на `start-core.mjs` + тест парності двох списків); до динамічного імпорту хендлера кличе `resolveDriverEnv(process.env)` з `simplycms/env`; помилка → `console.error(message)` і `process.exit(1)`; при `mail.driver==='log'` друкує одне попередження «пошта не налаштована: листи лише в лозі сервера».

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
- [ ] **Step 5а: Режим «прод» (А §3, §5).** `doctor` (а згодом `status`, Task 19) у режимі `NODE_ENV=production` (env процесу або `.env*` магазину через `readStoreEnv`): `mail.driver==='log'` → `error` «пошта не налаштована: у проді листи губляться в лозі»; поза продом — `warn`. Тест у `cli-doctor.test.ts`, обидва режими. Мутація: прибрати перевірку `NODE_ENV` → FAIL кейсу «прод → error»; відкат.
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
- Modify: `packages/simplycms/src/auth/{send-email.ts,invite-email.ts,instance.ts:59-92,invite.ts:81-120}`, `packages/simplycms/src/site/` (`declareStoreLocale`, `getStoreLocale` поруч із `declareBuiltThemes`), `src/server.ts` (→ `template:sync`), `template/scripts/{owner-invite.mjs,owner-invite-core.mjs}`, `packages/simplycms/src/i18n/catalogs/{uk,en}/mail.ts` + обидва `index.ts`, `tests/i18n-coverage/scan.ts:62` (`SCANNED_ROOTS` += `packages/simplycms/src/mail`, `packages/simplycms/src/auth`)
- Create: `packages/simplycms/src/mail/render/{auth.ts,layout.ts}` (+ тести)

**Interfaces:**
- Produces: `renderPasswordResetMail({ to, url, storeName, t }): MailMessage`, `renderOwnerInviteMail({ to, url, storeName, ttlMs, t }): MailMessage` — чисті функції; `t = createTranslator(getStoreLocale())`; `storeName` = `profile.name || 'SimplyCMS'` з `readStoreProfile`. `declareStoreLocale(locale: Locale): void`; `getStoreLocale(): Locale` — незадеклароване → `'uk'` + одне `console.warn` на процес.
- Тип `SendAuthEmail` і `SendInviteEmail` зникають; `InviteEmail` → `MailMessage`. `sendResetPassword` (Е8-О1): guard → `await scheduleMail([{kind:'password_reset', message}])` (швидкий запис у БД) → `void deliverMail(ids).catch(logWithoutSecrets)` — БЕЗ `await`. BA кличе колбек лише для наявного email, і затримка SMTP у відповіді дає перебір користувачів за часом; BA прямо радить не чекати відправки. `issueOwnerInvite` приймає `schedule?: typeof scheduleMail` (дефолт — справжній) замість `sendEmail`. `owner:invite` ставить лист у чергу й доставляє через порт. Посилання у виводі — лише за Е8-С2: драйвер `log` поза продом або прапорець `--print-link`; зі SMTP — «лист надіслано на <email>»; прод без SMTP і без `--print-link` — код 1 з поясненням.

- [ ] **Step 1: Тести.** Рендер: обидві функції з `t` для `uk` і `en` дають тему й текст з `storeName` і `url`, HTML екранує `<` у `storeName`. `instance.test`/харнес: `requestPasswordReset` → у `mail_outbox` з'явився і зник рядок `password_reset`, фейковий транспорт отримав лист з `storeName` профілю. `owner-invite-core`, три гілки Е8-С2: (1) SMTP → вивід «лист надіслано на …» без посилання й токена; (2) `log` поза продом → вивід має посилання; (3) `NODE_ENV=production` + `log` без `--print-link` → код 1, текст називає `SMTP_URL`, `MAIL_FROM` і `--print-link`, посилання немає; з `--print-link` → посилання є. Мутація: друкувати посилання в гілці SMTP → FAIL (1). `getStoreLocale()` без декларації → `'uk'` і рівно одне попередження за два виклики. Таймінг (Е8-О1): фейковий транспорт спить 2 с → `requestPasswordReset` повертається раніше, ніж транспорт завершився (асерт за промісом-маркером транспорту, не за годинником); рядок у `mail_outbox` уже є на момент повернення.
- [ ] **Step 2: Прогнати** → FAIL; **Step 3: Реалізувати**, ключі `mail.*` в обох каталогах (тести парності `tests/i18n-catalog-parity.test.ts` і `catalog-integrity.test.ts`), `pnpm template:sync`.
- [ ] **Step 4: Прогнати** БЛ. Мутації: додати `await` перед `deliverMail` у `sendResetPassword` → FAIL таймінгу; відкат. Кириличний літерал у `render/auth.ts` → `i18n-coverage` FAIL (доводить, що `SCANNED_ROOTS` справді покриває `mail`); відкат. `instance.ts` знову на `stubSendAuthEmail` → харнес-тест скидання FAIL; відкат.
- [ ] **Step 5: Commit** `feat(k3-e8): листи скидання і запрошення через порт пошти, локаль хоста, i18n`.

### Task 12: Листи замовлення і картка хвостів пошти в адмінці

**Files:**
- Modify: `packages/simplycms/src/storefront/loaders/place-order.ts:41-80`, `packages/simplycms/src/mail/render/order.ts` (новий, + тест), `admin-server/index.ts` (`listMailOutbox`, `retryMailOutbox`), `admin-server/impl/mail/outbox.ts` (новий), `admin/features/settings/{MailOutboxCard.tsx,useMailOutbox.ts}` (нові), `SettingsPage.tsx`, `i18n/catalogs/{uk,en}/admin/settings.ts`, `tests/i18n-coverage` (за потреби), `eslint.tier-zones.mjs` (`mail` у upward-списках `storefront` і `admin-server`)
- Test: `packages/simplycms/test-harness/pg/__tests__/order-mail.test.ts`, `admin/features/settings/__tests__/MailOutboxCard.test.tsx`

**Interfaces:**
- Consumes: `enqueueMail`, `deliverMail`, `listMailOutbox`, `retryMail` (Task 10); `readStoreProfile` (`simplycms/site`).
- Produces: `renderOrderCustomerMail({ order, storeName, t })`, `renderOrderOwnerMail({ order, storeName, adminUrl, t })`. У `placeOrderFor`: всередині `run`, після `createOrder`, `operator(odb => enqueueMail(odb, items))` (ескалація `app_user → app_admin`, як `eraseMediaRows`); лист власнику — лише якщо `profile.contacts.email` непорожній; після COMMIT для ОБОХ гілок (гість і покупець) — `deliverMail(ids)`; збій доставки не ламає відповідь замовлення. Серверні функції: `runAdmin('settings.manage', …)`; `retryMailOutbox` → `retryMail()`.

- [ ] **Step 1: `order-mail.test.ts`:** гість оформлює → два листи (`order_customer` на `input.email`, `order_owner` на email профілю) доставлено фейком, рядків немає; профіль без email → один лист; транспорт кидає → замовлення є, два рядки з `attempts=1`; ROLLBACK замовлення (помилка резерву) → листів і рядків немає; атомарність: тестовий тригер `before insert on mail_outbox` кидає виняток → замовлення НЕМАЄ (лист і замовлення комітяться разом або ніяк); `deliverMail` підмінено на no-op → обидва рядки є в таблиці одразу після COMMIT.
- [ ] **Step 2: `MailOutboxCard.test.tsx`:** рядки з віком і типом, без тіла; «Повторити» кличе мутацію й інвалідує ключ `entityKey(ENTITY.mailOutbox)`; порожній стан. Серверний тест: користувач без `settings.manage` → відмова.
- [ ] **Step 3: Прогнати** → FAIL; **Step 4: Реалізувати.**
- [ ] **Step 5: Прогнати** БЛ. Мутації: `scheduleMail` після COMMIT замість `enqueueMail` усередині `run` → кейс ROLLBACK лишається зеленим, а кейс атомарності FAIL (замовлення є, листа немає — саме тому він є); відкат. Прибрати перевірку порожнього email власника → FAIL «один лист»; відкат. Картка рендерить поле `message`, якщо воно прийде (додати його в `listMailOutbox`) → FAIL `MailOutboxCard`/серверного тесту «без тіла»; відкат. `runAdmin('settings.manage', …)` → `runAdmin('orders.read', …)` (або інше право, яке має тестовий не-власник) → FAIL «без `settings.manage` → відмова»; відкат.
- [ ] **Step 6: Commit** `feat(k3-e8): листи замовлення покупцю й власнику, хвости пошти в налаштуваннях`.

### Task 13: Живі контури: `live:smoke` з Mailpit і `pilot-full` з Garage + Mailpit

**Files:**
- Create: `scripts/pilot-pack/{gate-media.mjs,gate-mail.mjs}`, `tests/pilot-gate-media.test.ts` (юніт на чисту частину: розбір виводу дочірнього процесу)
- Modify: `scripts/live-smoke.mjs` (+ новий `scripts/live-smoke/mail.mjs`), `scripts/pilot-pack/{env.mjs,scaffold.mjs,run.mjs}`, `scripts/release/pilot-full.mjs:28-48`, `tests/release-gates.test.ts:29-30`, `docs/architecture/{test-contours.md,release-process.md:186}`

**Interfaces:**
- Consumes: `.env.harness` (`S3_*`, `HARNESS_SMTP_URL`, `HARNESS_MAILPIT_URL`) з Task 8.
- Produces: `env.mjs` пише в `.env` скретча три обов'язкові ключі + групи `S3_*`, `SMTP_URL`, `MAIL_FROM=pilot@simplycms.test`, якщо вони задані в оточенні прогону; `pilot-full` задає їх з `.env.harness`. Новий `scripts/pilot-pack/gate-media.mjs` (повний режим, після Gate B): дочірній `node --input-type=module` з `cwd` = скретч і env скретча імпортує `simplycms/storage` з `node_modules` скретча → `getMediaDriver().put(mediaKey('image/png'), bytes)` → `open` дає ті самі байти → підписаний `HEAD` у Garage з процесу гейту бачить об'єкт → `delete`. Це доказ, що ЗАПАКОВАНЕ ядро вибирає `s3` за env, а не лише монорепо.

- [ ] **Step 1: `live-smoke/mail.mjs`:** `scripts/live-smoke.mjs:89-94` (явний `env` сервера) отримує `SMTP_URL = HARNESS_SMTP_URL` і `MAIL_FROM` — без них SMTP-каналу в прогоні немає. Посилання й токени у вивід не друкуються (лише «лист знайдено, форма відкривається»). Після воронки чекауту — Mailpit має лист замовлення покупцю на адресу воронки; `requestPasswordReset` на ту саму адресу → лист із посиланням `/auth/set-password?token=…`; перехід за посиланням → форма відкривається. Чистка Mailpit на старті.
- [ ] **Step 2: `pilot-full`** з групами env; `gate-media` у `run.mjs` після B (лише повний режим; у `--pack-only` — skip із причиною). Так само `gate-mail` (`scripts/pilot-pack/gate-mail.mjs`): дочірній процес у скретчі імпортує `simplycms/mail` з `node_modules` скретча → `getMailTransport().send(...)` з унікальною темою → Mailpit API має лист із цією темою і `From = MAIL_FROM` — доказ SMTP-драйвера в ЗАПАКОВАНОМУ магазині (А §8).
- [ ] **Step 3: Прогнати** БЛ + `pnpm harness:up && pnpm live:smoke` + `node scripts/release/pilot-full.mjs`. Вивід обох — у звіт. Мутації: `MAIL_FROM` прибрати з `env.mjs` → старт скретча падає з `MAIL_FROM` (доказ, що Task 5 працює в запакованому магазині); відкат. `S3_BUCKET` на неіснуючий → `gate-media` FAIL; відкат. Прибрати `SMTP_URL` з env `live:smoke` → крок листів FAIL (не skip); відкат. Прибрати `SMTP_URL` з `env.mjs` → `gate-mail` FAIL (лист пішов у лог, а не в Mailpit); відкат. Прибрати `S3_*` з `env.mjs` → `gate-media` FAIL на підписаному `HEAD` (драйвер мовчки поклав файл у `local-fs` — саме той клас, проти якого гейт); відкат.
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
- Modify: `scripts/release/{bump.mjs,manifest-version.mjs}`, `scripts/release.mjs` (перевірка «нова версія > поточної» з пререлізами), `.github/workflows/publish-packages.yml` (вибір тегу), `packages/simplycms/src/contracts/semver/{index.ts,core-range.ts}`, `packages/cli/src/update.mjs:40-50`, `packages/create-simplycms-store/src/index.mjs:24` (лише тест)
- Create: `scripts/release/dist-tag.mjs` (`distTagFor(version): 'latest' | 'next'`) + тест; `tests/release-prerelease.test.ts`

**Interfaces:**
- Produces:
  - `VERSION_RE = /^\d+\.\d+\.\d+(-rc\.\d+)?$/` — лише форма `-rc.N` (інших пререлізів лінія не має; ширший regex прийняв би `1.0.0-beta` без правил порядку);
  - `compareVersions(a, b)`: `1.0.0-rc.1 < 1.0.0-rc.2 < 1.0.0 < 1.0.1`; `rc.10 > rc.9` (числове порівняння);
  - `distTagFor(version)`: пререліз → `'next'`, інакше `'latest'`. Workflow: `pnpm publish -r --access public --no-git-checks --tag "$(node -e "…distTagFor(currentVersion())…")"`; тег git `v1.0.0-rc.1` — без змін механізму;
  - `contracts/semver`: розбір `X.Y.Z-rc.N`; `satisfies` для `^M.0.0-0` = «`>= M.0.0-0` і `< (M+1).0.0-0`» — матчить і RC, і фінальний `M.x`; для `^M.m.p` без `-0` пререлізи НЕ матчаться (стандартна семантика: пререліз — лише за явної згоди діапазону);
  - `coreRangeFor('1.0.0-rc.N')` → `'^1.0.0-0'`; `coreRangeFor('1.0.0')` → `'^1.0.0'` (Task 15). Бамп релізу RC переписує `engines` на `^1.0.0-0`, фінальний `1.0.0` — на `^1.0.0`;
  - `update`: цільова версія без `--to` — якщо поточна версія ядра магазину пререліз, то `max(dist-tags.next, dist-tags.latest)` за `compareVersions` (`pnpm view @simplycms/cli dist-tags --json`), інакше `dist-tags.latest`; цільова < поточної → нічого не ставити, повідомити «новішого релізу немає» (ніколи не даунгрейдити без явного `--to`).
  - `update` не перетинає мажорну межу без явного `--to` (наслідок чесного semver): мажорна цілі > мажорної поточної версії → нічого не ставити, вивести «доступна мажорна версія X — містить зламані зміни, див. розділ BREAKING у CHANGELOG; оновлення — `simplycms update --to X`» і код 3. RC → фінальний тієї ж мажорної (`1.0.0-rc.2 → 1.0.0`) — не перетин межі. `0.x` → `1.x` — перетин.

- [ ] **Step 1: Тести (`tests/release-prerelease.test.ts` і тести `contracts/semver`).**
  - `VERSION_RE`: приймає `1.0.0-rc.1`, `1.0.0`; відкидає `1.0.0-beta.1`, `1.0.0-rc`, `1.0.0-rc.01`;
  - `compareVersions`: ланцюг `0.14.0 < 1.0.0-rc.1 < 1.0.0-rc.2 < 1.0.0-rc.10 < 1.0.0 < 1.0.1`;
  - `bumpTo('1.0.0-rc.1')` на фікстурі: `CORE_VERSION = '1.0.0-rc.1'`, маніфести `version: '1.0.0-rc.1'` і `engines: { simplycms: '^1.0.0-0' }`;
  - `distTagFor`: `1.0.0-rc.1` → `next`, `1.0.0` → `latest`; сухий прогін виразу з workflow (той самий рядок `node -e`, винесений у `scripts/release/dist-tag.mjs --print`) друкує `next` для RC;
  - `satisfies`: `^1.0.0-0` приймає `1.0.0-rc.1`, `1.0.0`, `1.7.0`; відкидає `2.0.0-rc.1`, `0.14.0`; `^1.0.0` відкидає `1.0.0-rc.1`;
  - валідатори модулів (тема й плагін): ядро `1.0.0-rc.1` + `engines` `^1.0.0-0` → прийнято (без цього RC відхилив би власні вшиті теми);
  - скаффолдер: `readVersion()` (`create-simplycms-store/src/index.mjs:24`) = власна версія пакета, тож з тегу `next` магазин отримує `__SIMPLYCMS_VERSION__ = 1.0.0-rc.1` — тест на фікстурі `package.json` з RC-версією;
  - `update`: магазин на `1.0.0-rc.1`, фейковий реєстр `{ latest: '0.14.0', next: '1.0.0-rc.2' }` → ціль `1.0.0-rc.2`; `{ latest: '0.14.0', next: '1.0.0-rc.1' }` → «новішого релізу немає», `pnpm add` не викликано; магазин на `0.14.0` → ціль `latest`; межа мажорної: `0.14.0` + `latest: '1.0.0'` без `--to` → код 3, текст називає `1.0.0` і `--to`, `pnpm add` не викликано; з `--to 1.0.0` → ставить; `1.0.0-rc.2` + `latest: '1.0.0'` → ставить.
- [ ] **Step 2: Прогнати** → FAIL; **Step 3: Реалізувати.**
- [ ] **Step 4: Прогнати** БЛ. Мутації: `compareVersions` ігнорує суфікс → FAIL ланцюга (`1.0.0-rc.1` = `1.0.0`); відкат. `distTagFor` завжди `latest` → FAIL; відкат. `update` бере лише `latest` → FAIL «RC не даунгрейдиться»; відкат. Прибрати перевірку мажорної межі → FAIL «0.14.0 → 1.0.0 без `--to`»; відкат. `satisfies('^1.0.0-0', '1.0.0-rc.1')` → `false` → FAIL валідаторів; відкат.
- [ ] **Step 5: Commit** `feat(k3-e8): пререлізний цикл 1.0.0-rc.N — тег next, порядок версій, update без даунгрейду`.

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
- Modify: `scripts/sync-create-store-template.mjs` (рендер блоку в шаблонний `AGENTS.md`), `tests/create-store-template-parity.test.ts`, `packages/cli/src/update.mjs` (блок, запис хука, Е8-Р12), `packages/cli/src/doctor-fs-checks.mjs` (№15 `agent-files`: розбіжність блоку, відсутній запис хука → `warn`; у `details` — рекомендовані дозволи Claude Code «читання вільно, зміни через підтвердження» з `packages/simplycms/agent/permissions.json`, бо `update` дозволи не зливає)

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
- `hook-entry.mjs`: `ensureSessionStartHook(settingsJsonText: string): { status: 'ok'|'added'|'updated', next: string }` — шукає запис за командою `node .claude/hooks/session-start.mjs` у `hooks.SessionStart[]` з matcher `startup|clear|compact`; інші ключі й записи — без змін; невалідний JSON → помилка без запису.
- `update`: `--check` — без мережі й install, код 3 на будь-яку розбіжність (host-файли, блок, хук, шим, лінки), 1 — помилка (Е8-О8); `--write` — пише; без прапорців — як раніше, плюс блок і хук.

- [ ] **Step 1: `managed-block.test.ts`:** файл без маркерів → `missing`, без `next`; файл із порожньою парою маркерів → блок вставлено між ними; повторне застосування → `ok`, байт-у-байт той самий текст; текст власника до й після маркерів — байт-у-байт незмінний після оновлення блоку; кожна форма `damaged` → без `next`; паритет: блок у `template/AGENTS.md` === `renderManagedBlock(intro.md)` і блок, який рендерить `update` для свіжого магазину, — той самий рядок.
- [ ] **Step 2: `hook-entry.test.ts`:** порожній `{}` → `added`; зі сторонніми хуками `PreToolUse` → їх збережено; повторно → `ok`; змінена команда → `updated`; невалідний JSON → помилка.
- [ ] **Step 3: `cli-update.test.ts`:** `update --check` на магазині без мережі: `run` отримує ін'єкцію раннера процесів (`deps.exec`, дефолт — `execFileSync`; той самий шов для `pnpm view` і `pnpm add`, `update.mjs:42,112`), фейк кидає на будь-який виклик → `--check` його не кличе; код 3 при розбіжності блоку; код 0 без розбіжностей.
- [ ] **Step 4: Прогнати** → FAIL; **Step 5: Реалізувати.** `intro.md` (≤60 рядків): принципи (прев'ю → згода → застосувати; секрети лише файлами `0600`, у розмову не потрапляють; дані недоторкані — міграції лише нові; каталог наповнюється в адмінці) + таблиця «намір → скіл» (`simplycms-onboarding`, `simplycms-update`, `simplycms-diagnose`, `simplycms-redesign`). `claude-md.md`: `@AGENTS.md` + специфіка Claude Code (хук старту, дозволи «читання вільно, зміни через підтвердження»).
- [ ] **Step 6: Прогнати** `pnpm template:sync`, БЛ. Мутації: `applyManagedBlock` замінює весь файл → FAIL «текст власника незмінний»; відкат. `--check` викликає install → FAIL Step 3; відкат. Ручна правка блоку в `template/AGENTS.md` → паритет FAIL; відкат.
- [ ] **Step 7: Commit** `feat(k3-e8): керований блок AGENTS.md і запис хука — одна реалізація для шаблону й update`.

### Task 19: Каркас `simplycms status`

**Files:**
- Create: `packages/cli/src/status.mjs`, `packages/cli/src/status-stage.mjs`, `tests/cli-status.test.ts`
- Modify: `packages/cli/src/{index.mjs,doctor-checks.mjs}` (експорт спільного списку перевірок), `docs/architecture/cli.md`

**Interfaces:**
- Consumes: `runOfflineChecks(ctx)` (`doctor-checks.mjs`) — та сама реалізація; групи env — `resolveDriverEnv` через `importFromStore(storeRoot,'simplycms/env')`.
- Produces: `simplycms status [--json|--hook]`. Коди виходу: `0` — все гаразд; `3` — є що робити; інший — стан невідомий. JSON: `{ stage: 'not-created'|'local'|'deployed', checks: Check[], next: { skill: string, reason: string } | null, unknown: string[] }`. `--hook` — вступ (`node_modules/simplycms/agent/intro.md`, той самий файл, з якого рендериться керований блок, Б §3.4) + стан ≤25 рядків. Режим «прод» — як у `doctor` (Task 9, Step 5а). Таймаут на всю команду ~5 с; кожна перевірка, що не вклалась, потрапляє в `unknown`, а не зникає.
- `deriveStage({ hasStoreRoot, deployJson }): Stage` і `nextSkill({ stage, checks }): { skill, reason } | null` — чисті функції в `status-stage.mjs`. Онлайн-частина (БД, журнал, власник, профіль, `/api/health` домену) — Task 21.

- [ ] **Step 1: Тести:** паритет вступу: текст вступу у виводі `--hook` === вміст між маркерами `renderManagedBlock(intro)` без рядка-правила (одна функція виділення, імпорт із `managed-block.mjs`); тека без магазину → `not-created`, `next.skill === 'simplycms-onboarding'`, код 3; магазин без `.simplycms/deploy.json` → `local`; з ним → `deployed`; перевірка, що кидає, → `unknown` непорожній і код ≠ 0/3; `--json` парситься; `--hook` ≤25 рядків і містить етап і наступний скіл; повільна перевірка (фейк 10 с) → загальний час <6 с і запис у `unknown`.
- [ ] **Step 2: Прогнати** → FAIL; **Step 3: Реалізувати**; **Step 4: Прогнати** БЛ. Мутація: `status` повертає 0, коли `unknown` непорожній → FAIL; відкат.
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
  - `scripts/` — перенесення `klasnakasa/tooling/scripts/src/{dokploy,dokploy-env,prod-run}.mjs` без зашитих ID: ідентифікатори з `.simplycms/deploy.json`, облікові дані Dokploy — `DOKPLOY_URL`/`DOKPLOY_API_KEY` з файлу секретів, НЕ з `~/.claude.json`. `dokploy-env.mjs set KEY` читає значення лише зі stdin, відмовляє на TTY, порожньому значенні й `\n`; `saveEnvironment` завжди з `createEnvFile:false`. `prod-run.mjs` видаляє розклад у `finally`. `secrets-file.mjs init <path>` створює git-ігнорований файл `0600` з порожніми ключами і НЕ друкує значень; `secrets-file.mjs pipe <path> KEY | dokploy-env.mjs set KEY` — шлях без виводу. Пошук ресурсу за ID/ім'ям перед створенням (ідемпотентність). Механічна згода (Б §2, анти-ціль «незворотні дії без явної згоди»): кожен мутуючий виклик (створення сервісу, `saveEnvironment`, `prod-run`, домен) без `--confirm` друкує прев'ю (що буде створено/змінено, лише імена ключів) і виходить кодом 3, нічого не змінивши.
  - `references/dokploy.md`: Postgres 17 (пастка дефолтного `postgres:18` з томом не туди), Railpack з `RAILPACK_START_CMD="node scripts/start.mjs"`, `RAILPACK_NODE_VERSION=24`, autoDeploy, домен і TLS (Cloudflare DNS only), `MIGRATION_DATABASE_URL` власника схеми, бекапи БД і тому, разове запрошення власника через `prod-run` — ПІСЛЯ налаштування SMTP і без `--print-link` (Е8-С2: посилання з адмінським токеном не має потрапити у вивід, що йде в розмову агента). `garage-bucket.md` — крок власника (`GARAGE_DEPLOYMENT.md` §6 klasnakasa, параметризовано), перевірка з контейнера (`403` = мережа є); позначка «наш варіант інфраструктури, магазин стороннього власника приносить будь-яке S3».

- [ ] **Step 1: Тести скриптів** (фейковий `fetch`): `dokploy-env set` з TTY → код 2; з порожнім stdin → код 2; тіло `saveEnvironment` має `createEnvFile:false` і змінює рівно один ключ, решта блоку байт-у-байт; вивід не містить значення; `prod-run` викликає `schedule.delete` і при помилці `runManually`; будь-який мутуючий скрипт без `--confirm` → код 3, фейковий `fetch` не отримав жодного не-GET запиту; `secrets-file init` створює файл із правами `0o600` і додає шлях у `.gitignore`.
- [ ] **Step 2: Прогнати** → FAIL; **Step 3: Реалізувати**; **Step 4: Прогнати** БЛ. Мутація: прибрати відмову на TTY → FAIL; відкат. `createEnvFile:true` → FAIL; відкат.
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
- Modify: `docs/tasks/platform-roadmap.md` (Е8 А+Б виконано; закриті борги 0.4.1-6…9, Е6г-5/6/9/13, К2-Е0-1; Е6г-12 лишається), `docs/tasks/v2-state-map.md` (§3.3 «Листи не відправляються» → чинний стан; накат; S3; старт), `CHANGELOG.md` — розділ `[1.0.0-rc.1]` (дата — у день релізу; реліз-коміт `chore(release): v1.0.0-rc.1` робить `pnpm release 1.0.0-rc.1` за словом власника). BREAKING: Node 24, `update --check` без install і мережі, перейменування скіла, заморожування baseline, `SendAuthEmail` прибрано, `owner:invite` без посилання при SMTP, діапазони `engines` `^M`, `docs/architecture/{cli.md,storage.md,release-process.md,test-contours.md,data-layer.md,repository-layout.md,upstream-workarounds.md}`, `docs/development/{ENVIRONMENT.md §2 «Запуск у проді»,TOOLING.md}`, `AGENTS.md` (пакети й реліз: правило заморожування міграцій одним рядком), специ А і Б (розділ «Амендмент (план, 2026-10-12)»: Е8-Р1…Р14, О1–О8, Б1–Б5, В1–В4, С1–С2, рішення власника про semver і RC, таблиця розбіжностей; у тілі спек: А §3 — драйвер `log` у проді без тіла (С1), А §6 — посилання запрошення лише за С2, обидві спеки — `0.15.0` → `1.0.0-rc.1`)

- [ ] **Step 1:** оновити носії. Перевірка «скасоване рішення в усіх носіях»: `git grep -nE "stubSendAuthEmail|SendAuthEmail|SendInviteEmail|redesign-from-reference|psql -f|>=22\.12|рівно ТРИ|0\.15\.0" -- ':!CHANGELOG.md' ':!docs/superpowers/**'` → кожен рядок або оновлено, або це позначений історичний розділ. Вивід — у звіт.
- [ ] **Step 2: Фінальний доказ.** `pnpm harness:up`, БЛ повністю, `pnpm live:smoke`, `node scripts/release/pilot-full.mjs`. Перевірка трейлерів (Global Constraints). Підсумок кожного гейту (команда → результат) — у звіт.
- [ ] **Step 3: Мутація головних гейтів (повтор на фінальному дереві).** `migrations-frozen` (пробіл у `0002`), Gate B `environ` (`spawn` замість `execve`), `s3.contract` (без `HEAD`), `mail-outbox` («успіх → рядка немає»), `session-start-shim` (код 1 на таймауті), `release-prerelease` (`compareVersions` ігнорує суфікс), `upgrade-1x` (звірка сум лише для заморожених). Кожна → червоний → відкат → зелений.
- [ ] **Step 4: Commit** `docs(k3-e8): носії стану, амендмент спек А і Б`.
