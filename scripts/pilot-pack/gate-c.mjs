/**
 * Gate C — bundle-guard + code splitting.
 *
 * Джерело правди — не vite-manifest (він знає лише файли чанків), а
 * `bundle-stats.client.json`, який пише міні-плагін `emitBundleStats()` у
 * `vite.config.ts` скретча: модульний граф (`modules` + статичні `imports`
 * кожного чанка). Тільки за ним видно, ЩО саме приїхало в initial-чанк.
 */

import { existsSync, readFileSync } from 'node:fs';
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
 * заглушка викидає: фабрика серверного Supabase-клієнта (читає cookie запиту)
 * і серверні лоадери даних. Саме це й перевіряємо.
 *
 * 🔴 Список розширено в 0.4.1 (severance): доки він перелічував лише
 * Supabase-фабрики й лоадери, гейт ФІЗИЧНО не бачив нового серверного графа
 * v2 — db-рантайму `simplycms/db` та його залежностей (drizzle-orm, pg).
 * Після переходу `/api/health` на Postgres витік цього графа в клієнт був би
 * невидимим: у браузері він падає не гейтом, а рантаймом.
 */
const SERVER_PAYLOAD = [
  // Legacy Supabase-шар адмінки (зникає з К3): у декларації межі його немає,
  // бо `supabase/keys` легально спільний для anon- і browser-клієнта.
  /simplycms\/dist\/supabase\/server-client/,
  // Anon-клієнт читає голий `process.env` у рантаймі (контракт серверного
  // env, спека CLI v1 §7): при витоку в клієнтський бандл він упав би вже в
  // браузері (там `process` немає) — гейт має зловити раніше.
  /simplycms\/dist\/supabase\/anon-client/,
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

/** Важкі підсистеми, яких не має бути в initial-чанку головної. */
const NOT_IN_INITIAL = [
  // 🔴 Саме `dist/admin/`, а не `dist/admin`: `dist/admin-routes/` — тонкі
  // обгортки роутів, вони в initial-чанку бути МАЮТЬ.
  { label: 'simplycms/admin', rx: /simplycms\/dist\/admin\// },
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
   * і далі на старому Supabase-шарі (`src/admin/pages/OrderStatuses.tsx`),
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
   * коміту `/admin/order-statuses` сидів на старому Supabase-шарі — жоден
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
      `OK   server-fn заглушок ${stubs}, серверного вантажу (SERVER_ONLY + legacy supabase + deps) — 0`,
    );
    details.push(`OK   admin-server stub: ${adminServerStubs} ≥ 1`);
  }

  const initial = initialChunks(stats);
  const initialModules = initial.flatMap((file) => stats[file].modules);
  details.push(
    `initial-чанків: ${initial.length}, модулів у них: ${initialModules.length}`,
  );
  for (const { label, rx } of NOT_IN_INITIAL) {
    const inBundle = allModules.filter((id) => rx.test(id)).length;
    const inInitial = initialModules.filter((id) => rx.test(id)).length;
    if (inInitial > 0) ok = false;
    details.push(
      `${inInitial === 0 ? 'OK  ' : 'FAIL'} ${label}: у бандлі ${inBundle}, в initial ${inInitial}`,
    );
  }

  return { ok, details };
}
