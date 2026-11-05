/**
 * Gate C — bundle-guard + code splitting.
 *
 * Джерело правди — не vite-manifest (він знає лише файли чанків), а
 * `bundle-stats.client.json`, який пише міні-плагін `emitBundleStats()` у
 * `vite.config.ts` скретча: модульний граф (`modules` + статичні `imports`
 * кожного чанка). Тільки за ним видно, ЩО саме приїхало в initial-чанк.
 */

import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
// 🔴 Розширення `.ts`: скрипт виконує Node без транспіляції.
import {
  escapeRegExp,
  SERVER_ONLY,
  SERVER_ONLY_DEPS,
} from '../../packages/simplycms/src/contracts/server-only.ts';

/**
 * Серверний ВАНТАЖ, якому в клієнтському бандлі не місце.
 *
 * 🔴 Уточнення до формулювання плану: самі модулі `dist/<тека>/server/` пакета
 * у клієнтських чанках Є — і так і має бути. Це `createServerFn`-модулі, які
 * Start на клієнті перетворює на RPC-заглушки (роути мусять на них
 * посилатися). Справжній інваріант — щоб разом із ними НЕ приїхало те, що
 * заглушка викидає: серверні лоадери даних, db-рантайм `simplycms/db` та його
 * залежності (drizzle-orm, pg). Саме це й перевіряємо; у браузері такий витік
 * падає не гейтом, а рантаймом.
 */
const SERVER_PAYLOAD = [
  // 🔴 Похідне від ЄДИНОЇ декларації межі (contracts/server-only.ts): кожен
  // server-only субшлях — і це читач списку, а не його копія. Гілок у регексі
  // дві, бо форма в `dist` задається КОНФІГОМ збірки, а не декларацією: на
  // чинному tsdown усі шість субшляхів емітяться теками (перевірено на dist
  // 2026-09-02: `dist/admin-server/impl/…`, `dist/storefront/loaders/…`), а
  // гілка `\.js` тримає пласку форму (`dist/db.js`) — щоб зміна розкладки
  // entry мовчки не знімала гейт із субшляху.
  ...SERVER_ONLY.map((sub) => new RegExp(`simplycms/dist/${sub}(/|\\.js)`)),
  // Серверні залежності — сегментом шляху або цілим специфікатором, але НЕ
  // підрядком (інакше `pg` збігся б із будь-яким `…jpg…`). Окремо від
  // субшляхів, бо витекти вони можуть і без модулів ядра — прямим імпортом
  // із роут-файлу чи теми.
  //
  // 🔴 Лише залежності БЕЗ `clientSafe`: там весь пакет server-only, тож один
  // патерн по шляху коректний. Для `better-auth` (клієнтський SDK живе
  // субшляхом `/react`) id-перевірки НЕМАЄ свідомо — module id у
  // bundle-stats не несе субшляху, тож відрізнити `better-auth/react` від
  // кореня на цьому рівні неможливо, і патерн давав би хибне спрацювання на
  // законному клієнтському SDK. Корінь better-auth може приїхати в клієнт
  // лише двома шляхами, і обидва перекриті: через `simplycms/auth` — це
  // server-only субшлях декларації, його ловить блок вище; прямим імпортом
  // із магазину — його ловить Import Protection специфікатором
  // (`serverOnlyDepSpecifier`, лукахед на `clientSafe`).
  ...SERVER_ONLY_DEPS.filter((dep) => !dep.clientSafe?.length).map(
    // Екранування — хелпером декларації, не власною копією: імʼя з крапкою
    // (`socket.io`) інакше зробило б патерн ширшим за намір.
    (dep) => new RegExp(`(^|[/"'])${escapeRegExp(dep.name)}([/"']|$)`),
  ),
];

/**
 * Маркер того, що заглушки server-fn у бандлі взагалі є (гейт не вхолосту).
 *
 * 🔴 `simplycms/dist/<тека>/server/` — форма ОДНОГО unscoped-пакета (топологія
 * 5): `<тека>` тут `storefront-routes`. Вона ж навмисно не збігається з
 * сателітами: у module-id `@simplycms/plugin-faq/dist/…` підрядка
 * `simplycms/dist/` немає, тож заглушка плагіна за ядро не зарахується.
 */
const SERVER_FN_STUB = /simplycms\/dist\/[^/]+\/server\//;

/**
 * Окремий стаб-маркер: форма `dist/admin-server/` не матчить
 * `SERVER_FN_STUB` (той вимагає сегмент `/server/` ПІСЛЯ теки).
 * 🔴 `index`, НЕ `impl`: наявність index-стаба легальна й обовʼязкова —
 * саме заглушку клієнт мусить отримати, а не нутрощі (див. SERVER_PAYLOAD).
 */
const ADMIN_SERVER_STUB = /simplycms\/dist\/admin-server\/index/;

/** Модуль каталогу ядра за ІМЕНЕМ у id клієнтського бандла (форми `dist` — у коментарі правила нижче). */
const CATALOG_MODULE =
  /simplycms\/dist\/(?:i18n\/catalogs\/|(?:base|admin|mail)-[A-Za-z0-9_-]{8}\.js$)/;

/**
 * Той самий модуль за ВМІСТОМ: статичний імпорт каталогу з пакета мови Rolldown вбудовує в
 * чанк імпортера (`dist/i18n/index.js`), і за іменем файла його не видно. Надійне джерело —
 * `sources` зі сорсмапи чанка (`sourcemap: true` у `tsdown.config.ts`, мапи їдуть у пакеті):
 * вона перелічує всі вбудовані вихідні модулі й переживає мініфікацію, яка прибрала б
 * коментарі `//#region`. Коментар лишається запасним шляхом для чанка без мапи.
 * Файл читається лише з `simplycms/dist` і лише якщо id — реальний шлях (синтетичні id
 * тестів — ні).
 */
const CATALOG_SOURCE = /(?:^|\/)src\/i18n\/catalogs\//;
const CATALOG_REGION = /^\/\/#region .*\bi18n\/catalogs\//m;
/** id -> { mapped: чанк має читабельні вихідні шляхи, catalog: серед них є каталог ядра } */
const inspectCache = new Map();
function inspectDist(id) {
  if (!/simplycms\/dist\//.test(id)) return { mapped: false, catalog: false };
  if (inspectCache.has(id)) return inspectCache.get(id);
  let result = { mapped: false, catalog: false };
  try {
    if (statSync(id).isFile()) {
      let sources = null;
      try {
        sources = JSON.parse(readFileSync(`${id}.map`, 'utf8')).sources;
      } catch {
        // Мапи немає — лишається коментар `//#region`.
      }
      if (Array.isArray(sources)) {
        result = {
          mapped: sources.some((src) => /(?:^|\/)src\//.test(src)),
          catalog: sources.some((src) => CATALOG_SOURCE.test(src)),
        };
      } else {
        const code = readFileSync(id, 'utf8');
        result = {
          mapped: /^\/\/#region src\//m.test(code),
          catalog: CATALOG_REGION.test(code),
        };
      }
    }
  } catch {
    // id без файла на диску — нема що читати.
  }
  inspectCache.set(id, result);
  return result;
}
const isCatalogModule = (id) =>
  CATALOG_MODULE.test(id) || inspectDist(id).catalog;

/** Важкі підсистеми, яких не має бути в initial-чанку головної. */
const NOT_IN_INITIAL = [
  // 🔴 Саме `dist/admin/`, а не `dist/admin`: `dist/admin-routes/` — тонкі
  // обгортки роутів, вони в initial-чанку бути МАЮТЬ.
  { label: 'simplycms/admin', rx: /simplycms\/dist\/admin\// },
  // 🔴 Каталоги ядра — лише через `import()` (І43, спека §19.4): клієнт тягне ОДНУ частину
  // ОДНІЄЇ мови, а статичний імпорт з пакета мови повернув би в початковий чанк усі мови
  // й частини `admin`/`mail`. У `dist` пакета каталоги — не теки, а чанки `base|admin|mail`
  // з 8-символьним хешем (`dist/base-C2UX6O0_.js`; `admin-error-<хеш>` під шаблон не
  // потрапляє), тож id модуля в bundle-stats несе саме таку форму; гілка `i18n/catalogs/`
  // тримає розкладку теками; каталог, вбудований статичним імпортом у чанк імпортера, ловить
  // перевірка вмісту (`hasCatalogRegion`). `mustExist`: правило, що нічого не знайшло в бандлі, — не
  // доказ, а зламана назва чанка, тому це FAIL.
  {
    label: 'каталоги ядра (i18n/catalogs)',
    test: isCatalogModule,
    mustExist: true,
  },
  { label: '@tiptap/*', rx: /@tiptap\// },
  { label: 'recharts', rx: /\/recharts\// },
];

/** Транзитивне замикання по СТАТИЧНИХ імпортах від entry-чанків. */
function initialChunks(stats) {
  const queue = Object.keys(stats).filter((file) => stats[file].isEntry);
  const seen = new Set(queue);
  while (queue.length) {
    for (const next of stats[queue.pop()].imports) {
      if (stats[next] && !seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  return [...seen];
}

/** @returns {{ ok: boolean; details: string[] }} */
export function gateBundle(storeDir) {
  const stats = JSON.parse(
    readFileSync(join(storeDir, 'bundle-stats.client.json'), 'utf8'),
  );
  const details = [];
  let ok = true;

  const allModules = Object.values(stats).flatMap((chunk) => chunk.modules);
  details.push(
    `клієнтських чанків: ${Object.keys(stats).length}, модулів: ${allModules.length}`,
  );

  const leaked = [
    ...new Set(
      allModules.filter((id) => SERVER_PAYLOAD.some((rx) => rx.test(id))),
    ),
  ];
  const stubs = allModules.filter((id) => SERVER_FN_STUB.test(id)).length;
  const adminServerStubs = allModules.filter((id) =>
    ADMIN_SERVER_STUB.test(id),
  ).length;
  /**
   * 🔴 ВІДХИЛЕННЯ ВІД БРИФА Task 8 (знахідка живого прогону `pilot:pack`,
   * не компілятора): брифовий код асертував присутність
   * `ADMIN_SERVER_STUB` у `allModules` — тобто вимагав, щоб стаб РЕАЛЬНО
   * приїхав у клієнтський чанк скретч-стора. Емпірично: жоден роут стора
   * СЬОГОДНІ не імпортує `simplycms/admin-server` — `/admin/order-statuses`
   * і далі на старому легасі-шарі (`src/admin/pages/OrderStatuses.tsx`),
   * Task 9/10 щойно переводять сторінку на ці serverFn. Vite не тягне в
   * бандл модуль, якого ніхто не імпортує, тож `allModules` СТРУКТУРНО не
   * може містити admin-server до Task 9/10 — і це узгоджується з власним
   * DoD Частини 2 в плані: «серверний шар доводиться test:schema і
   * юнітами БЕЗ жодного клієнтського коду». Буквальна вимога брифа й DoD
   * Частини 2 тут суперечать одна одній.
   *
   * Мінімальний чесний замінник, який доводить САМЕ те, за що відповідає
   * Task 8 (коректний спліт entry index/impl у ЗІБРАНОМУ dist), не
   * чіпаючи жодного клієнтського файлу: перевірка існування ОБОХ файлів
   * у dist упакованого й встановленого в скретч-сторі пакета. Це не
   * послаблює головний захист — leak-перевірка `impl` у SERVER_PAYLOAD
   * лишається БЕЗУМОВНОЮ (вище, незалежно від того, юзається дана
   * заглушка чи ні). `adminServerStubs` лишається інформаційним: 0
   * ОЧІКУВАНО на цій межі, стане ненульовим після Task 9/10 — тоді
   * презенс у bundle-stats можна повернути як твердий гейт (гейт не
   * вхолосту), як і задумував бриф.
   */
  const adminServerDist = join(
    storeDir,
    'node_modules/simplycms/dist/admin-server',
  );
  const adminServerSplitOk =
    existsSync(join(adminServerDist, 'index.js')) &&
    existsSync(join(adminServerDist, 'impl/index.js'));
  /**
   * 🔴 Task 10 (Е1б, Step 4б, R10): суворий assert повернуто. До цього
   * коміту `/admin/order-statuses` сидів на старому легасі-шарі — жоден
   * роут стора не імпортував `simplycms/admin-server`, тож Vite СТРУКТУРНО
   * не міг покласти стаб у клієнтський чанк (він не тягне в бандл модуль,
   * якого ніхто не імпортує) — звідси тимчасовий INFO-лічильник у Task 8.
   * Тепер `OrderStatuses.tsx` імпортує `setDefaultOrderStatus` і
   * `reorderOrderStatus` напряму, а `admin-data`-колекція — решту чотирьох
   * serverFn: стаб МУСИТЬ приїхати в клієнт, і 0 тут — реальний регрес
   * спліту (не «ще не встигли перевести сторінку»).
   */
  if (
    leaked.length ||
    stubs === 0 ||
    adminServerStubs === 0 ||
    !adminServerSplitOk
  ) {
    ok = false;
    details.push(
      leaked.length
        ? `FAIL серверний вантаж у клієнті: ${leaked.join(', ')}`
        : stubs === 0
          ? 'FAIL заглушок server-fn у бандлі немає — перевіряти нема чого'
          : adminServerStubs === 0
            ? 'FAIL admin-server stub відсутній у клієнтських чанках — сторінка мала б його імпортувати (Task 10)'
            : 'FAIL dist/admin-server у встановленому пакеті не має пари index.js (стаб) + impl/index.js (нутрощі)',
    );
  } else {
    details.push(
      `OK   server-fn заглушок ${stubs}, серверного вантажу (SERVER_ONLY + deps) — 0`,
    );
    details.push(`OK   admin-server stub: ${adminServerStubs} ≥ 1`);
  }

  const initial = initialChunks(stats);
  const initialModules = initial.flatMap((file) => stats[file].modules);
  details.push(
    `initial-чанків: ${initial.length}, модулів у них: ${initialModules.length}`,
  );
  // Канарка: перевірка вмісту має що читати. Якщо жоден чанк `simplycms/dist` не віддає
  // вихідних шляхів (мініфікація без сорсмап, інший формат), правило каталогів сліпе за
  // побудовою — тож це FAIL, а не тихий OK.
  if (!allModules.some((id) => inspectDist(id).mapped)) {
    ok = false;
    details.push(
      'FAIL канарка вмісту: жоден чанк simplycms/dist не віддає вихідних шляхів (сорсмапа чи //#region src/) — ' +
        'перевірка вбудованих каталогів сліпа, бандл зібрано без мап або з мініфікацією',
    );
  }
  for (const {
    label,
    rx,
    test = (id) => rx.test(id),
    mustExist,
  } of NOT_IN_INITIAL) {
    const inBundle = allModules.filter(test).length;
    const inInitial = initialModules.filter(test).length;
    if (inInitial > 0 || (mustExist && inBundle === 0)) ok = false;
    details.push(
      `${inInitial === 0 && !(mustExist && inBundle === 0) ? 'OK  ' : 'FAIL'} ${label}: у бандлі ${inBundle}, в initial ${inInitial}`,
    );
  }

  return { ok, details };
}
