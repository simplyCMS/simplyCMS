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
//  додатково заборонені теки НИЖЧОГО шару — там, де шар не єдиний критерій]
const TIER_ZONES = [
  ['src/contracts', 0, 'contracts', []],
  ['src/domain', 1, 'domain', []],
  ['src/schema', 1, 'schema', []],
  ['src/supabase', 2, 'supabase', []],
  ['src/data-supabase', 2, 'data-supabase', []],
  ['src/react-query', 2, 'react-query', []],
  ['src/runtime', 2, 'runtime', []],
  ['src/i18n', 2, 'i18n', []],
  ['src/storefront', 2, 'storefront', []],
  // 🔴 `ui` — примітиви shadcn/Radix: шар T3 сам по собі не забороняє йому
  // data-теки T2, але примітив, що ходить у БД, перестає бути примітивом.
  // Факт Step 1: `ui` імпортує ЛИШЕ себе — тож заборона фіксує статус-кво.
  // `i18n` навмисно НЕ в списку: текст у примітиві — легальний випадок.
  [
    'src/ui',
    3,
    'ui',
    [],
    [
      'schema',
      'supabase',
      'data-supabase',
      'react-query',
      'storefront',
      'runtime',
    ],
  ],
  ['src/themes', 4, 'themes', []],
  ['src/plugins', 4, 'plugins', []],
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

/** Зони напрямку шарів для `eslint.config.mjs` (по одному блоку на теку). */
export const tierZoneConfigs = TIER_ZONES.map(
  ([dir, layer, name, upward, alsoForbidden = []]) => {
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
    const forbidden = targets.flatMap((other) => [
      `simplycms/${other}`,
      ...relativeForms(`${PKG}/${dir}`, `${PKG}/${TIER_DIR[other]}`),
    ]);

    return {
      files: [`${PKG}/${dir}/**/*.{ts,tsx}`],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            paths: [ROOT_BARREL],
            patterns: [
              {
                group: forbidden,
                message: `Тір-зона ПК3: ${dir} — шар T${layer}. Легальні лише теки НИЖЧОГО шару (плюс зафіксовані винятки статус-кво). Підняти імпорт угору — архітектурне рішення зі зміною таблиці в eslint.tier-zones.mjs, а не побічний ефект правки.`,
              },
            ],
          },
        ],
      },
    };
  },
);
