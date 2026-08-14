/**
 * Gate C — bundle-guard + code splitting.
 *
 * Джерело правди — не vite-manifest (він знає лише файли чанків), а
 * `bundle-stats.client.json`, який пише міні-плагін `emitBundleStats()` у
 * `vite.config.ts` скретча: модульний граф (`modules` + статичні `imports`
 * кожного чанка). Тільки за ним видно, ЩО саме приїхало в initial-чанк.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Серверний ВАНТАЖ, якому в клієнтському бандлі не місце.
 *
 * 🔴 Уточнення до формулювання плану: самі модулі `dist/server/*.js` пакетів у
 * клієнтських чанках Є — і так і має бути. Це `createServerFn`-модулі, які
 * Start на клієнті перетворює на RPC-заглушки (роути мусять на них
 * посилатися). Справжній інваріант — щоб разом із ними НЕ приїхало те, що
 * заглушка викидає: фабрика серверного Supabase-клієнта (читає cookie запиту)
 * і серверні лоадери даних. Саме це й перевіряємо.
 */
const SERVER_PAYLOAD = [
  /@simplycms\/supabase\/dist\/server-client/,
  // Anon-клієнт читає голий `process.env` у рантаймі (контракт серверного
  // env, спека CLI v1 §7): при витоку в клієнтський бандл він упав би вже в
  // браузері (там `process` немає) — гейт має зловити раніше.
  /@simplycms\/supabase\/dist\/anon-client/,
  /@simplycms\/storefront\/dist\/loaders\//,
];

/** Маркер того, що заглушки server-fn у бандлі взагалі є (гейт не вхолосту). */
const SERVER_FN_STUB = /@simplycms\/[^/]+\/dist\/server\//;

/** Важкі підсистеми, яких не має бути в initial-чанку головної. */
const NOT_IN_INITIAL = [
  { label: '@simplycms/admin', rx: /@simplycms\/admin\// },
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
  if (leaked.length || stubs === 0) {
    ok = false;
    details.push(
      leaked.length
        ? `FAIL серверний вантаж у клієнті: ${leaked.join(', ')}`
        : 'FAIL заглушок server-fn у бандлі немає — перевіряти нема чого',
    );
  } else {
    details.push(
      `OK   server-fn заглушок ${stubs}, серверного вантажу (server-client, loaders) — 0`,
    );
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
