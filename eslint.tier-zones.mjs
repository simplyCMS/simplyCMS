// Тір-зони напрямку шарів (ПК3, трек К0).
//
// До консолідації дисципліну шарів стерегла межа npm-пакета: `@simplycms/ui`
// фізично не міг імпортувати `@simplycms/admin`, бо той не був у його
// `dependencies`, і `audit-deps` це б спіймав. Після злиття 26 пакетів в один
// `simplycms` межі не стало — усе живе в `packages/simplycms/src/*` і будь-яка
// тека дотягується до будь-якої self-reference субшляхом. Ці зони повертають
// межу правилом `no-restricted-imports`.
//
// 🔴 Зони фіксують СТАТУС-КВО, знятий Step 1 задачі (`rg -o "from 'simplycms/…"`
// по кожній теці), а НЕ бажану архітектуру: заборонено рівно те, чого сьогодні
// в коді немає. Тому вмикання зон не змінює жодного рядка — воно лише не дає
// новому імпорту поїхати вгору по шарах непоміченим.
//
// 🔴 Дві розбіжності з тірингом `packages/README.md` зафіксовано ФАКТОМ, а не
// виправлено кодом (знахідки Step 1):
//   • `plugin-sdk` README називає T2, але він імпортує `plugins` (T4) — тут
//     він T4 із явним винятком на `plugins`;
//   • `core` (legacy-фасад, у README поза тірами) стоїть T5 поруч з `admin` і
//     `storefront-routes`; при цьому пʼять `*-ui` (T4) тягнуть `core` вгору —
//     зустрічний цикл, борг розселення `core` по тірах поза К0.
//
// Кожна заборона виражена ДВОМА формами специфікатора — bare-субшляхом
// `simplycms/<тека>` і відносним шляхом (`../<тека>`, `../../<тека>`, …):
// правило матчить рядок, а не резолвлений модуль. Деталі й бюджет рівнів
// `../` — в `eslint.tier-relative.mjs`.

import { dbClientImportGroup } from './eslint.db-client-zone.mjs';
import { relativeForms } from './eslint.tier-relative.mjs';

// 🔴 Межа зони — СТАТИЧНИЙ імпорт/`export … from`: `no-restricted-imports`
// динамічний `import()` не бачить (той самий урок, що дав окремий селектор
// межі довіри плагінів). Дзеркального селектора тут свідомо немає: теки
// `src/admin`, `src/*-ui` і `routes/storefront` уже під `no-restricted-syntax`
// з i18n-зони, а flat config ЗАМІНЮЄ опції правила цілком — довелося б
// дублювати i18n-селектори у 23 блоки. Факт Step 1: динамічних `import()`
// на субшляхи `simplycms/*` у пакеті НУЛЬ, тож дірка сьогодні порожня; борг
// зафіксовано в звіті Task 4.
const PKG = 'packages/simplycms';

// [тека в пакеті, шар T, субшлях у exports-мапі (null — теку не імпортують),
//  фактичні імпорти на СВІЙ шар або ВИЩЕ (знімок Step 1; усе нижче легальне),
//  додатково заборонені теки НИЖЧОГО шару — там, де шар не єдиний критерій,
//  винятки-ФАЙЛИ `<тека>/<файл>`: один модуль забороненої теки, відкритий зоні
//  без відкриття решти теки (причина — коментарем біля рядка)]
const TIER_ZONES = [
  ['src/contracts', 0, 'contracts', []],
  ['src/domain', 1, 'domain', []],
  ['src/schema', 1, 'schema', []],
  // db-рантайм v2 (Task 6, В2-К1а) — T2 поруч із `auth`: він теж серверний
  // і теж стоїть над схемою (T1). Що саме йому вільно, задає шар:
  // `contracts`, `domain`, `schema` — і більше нічого.
  ['src/db', 2, 'db', []],
  // Е8-Т11: auth кличе пошту (`mail` — outbox і рендер листів), читає назву
  // магазину й локаль з `site`, тексти з `i18n` і базу посилань з `env`
  // (`siteUrl`). Зворотних імпортів немає: `mail` про `auth` не знає.
  // Auth-контур v2 (Task 7, В2-К1а) — T2 поруч із `db`: він теж серверний і
  // теж стоїть над схемою. `db` у винятку `upward` навмисно: єдиний канал до
  // Postgres — `withActor`, тож заборонити auth-у власний тір означало б
  // виштовхнути його на голий пул, тобто рівно туди, куди не можна.
  ['src/auth', 2, 'auth', ['db', 'mail', 'site', 'i18n', 'env']],
  ['src/react-query', 2, 'react-query', []],
  ['src/runtime', 2, 'runtime', []],
  ['src/i18n', 2, 'i18n', []],
  // SSR-лоадери вітрини (В2-К1а) — T2, і `db` у винятку `upward` з тієї
  // самої причини, що в `auth`: єдиний канал до Postgres — `withActor`, тож
  // заборона власного тіру виштовхнула б лоадери на голий пул, тобто рівно
  // туди, куди не можна.
  // `storage` у винятку поруч із `db` і `auth`: для лоадерів вітрини це та
  // сама інфраструктурна залежність — єдиний канал до файлів, як `withActor`
  // до Postgres. Класифікація дерева, а не послаблення межі. Зона ширша за
  // намір (тір-зони не вміють вужче за теку), тож факт «порт імпортує рівно
  // `avatar.ts`» пінує ратчет `tests/storage-port-consumers.test.ts`.
  // `inventory` (Е3-5) — облік залишків: спільний домен, класифікація дерева.
  // `commerce` (Е5б-5) — ціноутворення й доставка, спільні з адмінкою.
  // `site` (Е6б-7) — спільний кеш профілю/теми: вітрина читає, адмінка скидає.
  // `mail`, `env`, `i18n` (Е8, Task 12): лист замовлення ставиться в outbox у
  // транзакції оформлення; посилання в листі — лише `siteUrl` (Р18в), тексти —
  // каталог `mail.*`.
  [
    'src/storefront',
    2,
    'storefront',
    [
      'db',
      'auth',
      'storage',
      'inventory',
      'commerce',
      'sanitize',
      'site',
      'mail',
      'env',
      'i18n',
    ],
  ],
  // Серверний шар адмінки (Е1б) — T2. Виняток upward той самий, що в
  // storefront: єдиний канал до Postgres — withActor (db), перший рубіж —
  // requireGrant (auth). Ширшого не давати.
  // `storage` (Е2) у винятку з тієї ж причини, що `db` і `auth`: канал до
  // файлів один — порт, і заборона власного тіру виштовхнула б адмінку на
  // прямий `node:fs`, тобто рівно туди, куди не можна.
  // `inventory` (Е3-5) — облік залишків: спільний домен, класифікація дерева.
  // `commerce` (Е5б-5) — ціноутворення й доставка, спільні з вітриною.
  // `site` (Е6б-7) — спільний кеш профілю/теми: адмінка скидає після COMMIT,
  // а `storefront` їй імпортувати не можна (той самий тір).
  // `mail` (Е8, Task 12): картка хвостів пошти читає/повторює outbox.
  [
    'src/admin-server',
    2,
    'admin-server',
    [
      'db',
      'auth',
      'storage',
      'inventory',
      'commerce',
      'sanitize',
      'site',
      'mail',
    ],
  ],
  // Порт сховища (Е2) — T2. Upward-виняток `db` той самий, що в `auth` і
  // `storefront`: рядок `media` пишеться через `withActor`, іншого каналу
  // до Postgres немає. `auth` НЕ у винятку — грант перевіряє викликач
  // (serverFn), а не сам порт.
  // `env` (Е8-Р7): вибір драйвера за групами S3_*/MEDIA_ROOT — чиста функція
  // `resolveDriverEnv`, власного читання `process.env` у сховищі немає.
  ['src/storage', 2, 'storage', ['db', 'env']],
  // Облік залишків (Е3-5) — T2. Upward `db`: гвард пише через ActorDb
  // (withActor — єдиний канал до Postgres), як у `storage`.
  ['src/inventory', 2, 'inventory', ['db']],
  // Ціноутворення й доставка (Е5б-5) — T2. Upward лише `db`, як в
  // `inventory`: рушій читає прайси/знижки/тарифи через ActorDb.
  ['src/commerce', 2, 'commerce', ['db']],
  // Кеш профілю магазину й теми, вшиті теми (Е6б-7) — T2. Upward лише `db`
  // (тип `ActorDb`): власного каналу до Postgres модуль не відкриває.
  ['src/site', 2, 'site', ['db', 'i18n']],
  // Резолвер груп env драйверів (Е8-Р7) — T2. Чиста функція над переданим
  // оточенням: upward-винятків немає, імпортів поза `contracts` теж.
  ['src/env', 2, 'env', []],
  // Охорона серверного входу (Е8, Р23/Р27) — T2. Upward лише `env`: прод-
  // предикат і `redactUrls` беруться з нього, власного читання env тут немає.
  ['src/server-guard', 2, 'server-guard', ['env']],
  // Порт пошти (Е8, Task 9) — T2. Upward `env`: вибір драйвера за групою SMTP_* і
  // прод-предикат беруться з резолвера, власного читання груп env немає.
  // `db` і `schema` — для outbox `mail_outbox` (Task 10): запис лише через
  // `withActor`. `auth` свідомо НЕ в списку: auth кличе пошту, не навпаки.
  ['src/mail', 2, 'mail', ['env', 'db', 'schema', 'i18n']],
  // Build-time плагіни Vite (К3-Е8) — T2: Node-код збірки, жодних імпортів з
  // інших тек ядра, upward-винятків немає.
  ['src/vite', 2, 'vite', []],
  // Накат міграцій (Е8-Р2) — T2. Власне зʼєднання `pg` під власником схеми
  // (до ролей і RLS `withActor` неможливий), тож upward-винятків немає, і
  // `db` йому теж ні до чого. Єдиний виняток — ФАЙЛ `db/lock-keys` (М1, Task 2):
  // чисті константи реєстру ключів замків без жодного імпорту, тому ключ накату
  // живе в одному реєстрі з рядковими ключами, а `withActor` лишається забороненим.
  ['src/migrate', 2, 'migrate', [], [], ['db/lock-keys']],
  // Прод-старт магазину (К3-Е8, F5 рев'ю) — T2. Upward `env` (перевірка груп до
  // накату) і `migrate` (сам накат); БД актора й auth йому ні до чого.
  ['src/prod-start', 2, 'prod-start', ['env', 'migrate']],
  // Санітизація rich-HTML (Тема 9) — T2. Чиста функція над рядком: upward-
  // винятків немає; тип `SanitizedHtml` бере з T0 (`contracts`).
  ['src/sanitize', 2, 'sanitize', []],
  // Серверні переклади (Мультимовність М1, Task 3) — T2. Хеш поля джерела
  // (`node:crypto`); тека лише започаткована, серверні записи додає Task 11.
  // Чиста логіка — у `domain/translations` (T1), яку T2 імпортувати вільно.
  ['src/translations', 2, 'translations', []],
  // 🔴 `ui` — примітиви shadcn/Radix: шар T3 сам по собі не забороняє йому
  // data-теки T2, але примітив, що ходить у БД, перестає бути примітивом.
  // Факт Step 1: `ui` імпортує ЛИШЕ себе — тож заборона фіксує статус-кво.
  // `i18n` навмисно НЕ в списку: текст у примітиві — легальний випадок.
  ['src/ui', 3, 'ui', [], ['schema', 'react-query', 'storefront', 'runtime']],
  ['src/themes', 4, 'themes', []],
  ['src/plugins', 4, 'plugins', []],
  // Колекції адмінки (Е1б) — T4: над contracts/schema-типами, під
  // сторінками. Окремо від src/admin (T5): колекція — module-level стан.
  ['src/admin-data', 4, 'admin-data', []],
  ['src/plugin-sdk', 4, 'plugin-sdk', ['plugins']],
  ['src/cart-ui', 4, 'cart-ui', []],
  ['src/catalog-ui', 4, 'catalog-ui', ['core']],
  ['src/checkout-ui', 4, 'checkout-ui', ['core']],
  ['src/profile-ui', 4, 'profile-ui', ['core']],
  ['src/reviews-ui', 4, 'reviews-ui', ['core']],
  ['src/core', 5, 'core', []],
  ['src/admin', 5, 'admin', ['core']],
  ['src/storefront-routes', 5, 'storefront-routes', ['core']],
  ['routes/storefront', 5, null, ['storefront-routes']],
  ['routes/admin', 5, null, ['admin', 'storefront-routes']],
];

const TIER_LAYER = Object.fromEntries(
  TIER_ZONES.filter(([, , name]) => name).map(([, layer, name]) => [
    name,
    layer,
  ]),
);

// Тека кожного тіру — потрібна, щоб порахувати відносну форму специфікатора.
const TIER_DIR = Object.fromEntries(
  TIER_ZONES.filter(([, , name]) => name).map(([dir, , name]) => [name, dir]),
);

// Кореневий барель зсередини пакета — цикл модулів, тож заборонений скрізь.
// 🔴 Саме `paths` (точне імʼя), а не `patterns`: групи `no-restricted-imports`
// — gitignore-подібні, і запис `simplycms` там матчив би ВСЕ дерево субшляхів,
// зробивши кожну зону тотальною (перевірено ESLint-пробою).
const ROOT_BARREL = {
  name: 'simplycms',
  message:
    'Кореневий барель `simplycms` усередині самого пакета — цикл модулів. Імпортуй конкретний субшлях: simplycms/<тека>.',
};

const ZONE_MESSAGE = (dir, layer) =>
  `Тір-зона ПК3: ${dir} — шар T${layer}. Легальні лише теки НИЖЧОГО шару (плюс зафіксовані винятки статус-кво). Підняти імпорт угору — архітектурне рішення зі зміною таблиці в eslint.tier-zones.mjs, а не побічний ефект правки.`;

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Зони напрямку шарів для `eslint.config.mjs` (по одному блоку на теку). */
export const tierZoneConfigs = TIER_ZONES.map(
  ([dir, layer, name, upward, alsoForbidden = [], exemptFiles = []]) => {
    const targets = Object.entries(TIER_LAYER)
      .filter(
        ([other, otherLayer]) =>
          other !== name &&
          (otherLayer >= layer || alsoForbidden.includes(other)) &&
          !upward.includes(other),
      )
      .map(([other]) => other);

    // 🔴 Обидві форми того самого імпорту: bare-субшлях і відносний шлях.
    // Свій тір у `targets` не потрапляє ніколи, тож `../<своя тека>/…`
    // усередині зони лишається легальним.
    const formsOf = (other) => [
      `simplycms/${other}`,
      ...relativeForms(`${PKG}/${dir}`, `${PKG}/${TIER_DIR[other]}`),
    ];
    const exemptIn = (other) =>
      exemptFiles
        .filter((file) => file.startsWith(`${other}/`))
        .map((file) => file.slice(other.length + 1));
    const forbidden = targets
      .filter((other) => exemptIn(other).length === 0)
      .flatMap(formsOf);
    // 🔴 Виняток-файл gitignore-групою не виразити: пара `simplycms/db` +
    // `!simplycms/db/lock-keys` не працює (піддерево заборонене цілком, а
    // повторно ввімкнути файл у виключеній теці gitignore не дозволяє). Тому
    // тека з винятком забороняється regex-ом: сама тека і все піддерево, крім
    // названих файлів (повний збіг імені — `lock-keys-x` не проходить).
    const exemptPatterns = targets
      .filter((other) => exemptIn(other).length > 0)
      .flatMap((other) =>
        formsOf(other).map((form) => ({
          regex: `^${escapeRegex(form)}(?!/(?:${exemptIn(other).map(escapeRegex).join('|')})$)(?:/.*)?$`,
          message: ZONE_MESSAGE(dir, layer),
        })),
      );

    return {
      files: [`${PKG}/${dir}/**/*.{ts,tsx}`],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            paths: [ROOT_BARREL],
            patterns: [
              { group: forbidden, message: ZONE_MESSAGE(dir, layer) },
              ...exemptPatterns,
              // Flat config замінює опції правила цілком, тож глобальна зона
              // `simplycms/db/client` тут не діяла б: доливаємо явно. Для
              // самої теки `src/db` вона зайва (вона і є фабрика) — і саме
              // там `db` як тір-ціль у `targets` не потрапляє.
              ...(name === 'db' ? [] : [dbClientImportGroup]),
            ],
          },
        ],
      },
    };
  },
);
