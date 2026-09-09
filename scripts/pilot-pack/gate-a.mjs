/**
 * Gate A — роути з `node_modules`.
 *
 * Доводить, що генератор TanStack Router зібрав ТЕ САМЕ дерево, скануючи
 * `node_modules` замість `packages`: множина route-id у скретчі має точно
 * збігатися з монорепо (set-diff в обидва боки), а import-и генерату — вести
 * в `node_modules`.
 *
 * 🔴 Роут-теки приходять із ДВОХ джерел, і рахуються вони окремо (топологія 5,
 * трек К0). Каркас вітрини й адмінки — підтеки ОДНОГО unscoped-флагмана
 * (`node_modules/simplycms/routes/{storefront,admin}`); роути адмінки плагіна
 * — з його власного scoped-пакета (`node_modules/@simplycms/plugin-faq/routes`,
 * довстановлює `install-faq.mjs`). Вимога «> 0» стоїть саме на ядрі: без неї
 * гейт зеленів би на магазині, де каркас приїхав звідкись іще, аби лишились
 * роути плагіна.
 */

import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const REPO_ROOT = resolve(import.meta.dirname, '../..');

/** Витягнути ключі `interface FileRoutesById` з generated-файлу. */
export function routeIds(routeTreeSource) {
  const block = /interface FileRoutesById \{([\s\S]*?)\n\}/.exec(
    routeTreeSource,
  );
  if (!block) throw new Error('Gate A: у генераті немає FileRoutesById');
  return new Set(
    [...block[1].matchAll(/^\s*'?([^':\s]+)'?:/gm)].map((m) => m[1]),
  );
}

/** @returns {{ ok: boolean; details: string[] }} */
export function gateRoutes(storeDir) {
  const details = [];
  const monorepo = routeIds(
    readFileSync(join(REPO_ROOT, 'src/routeTree.gen.ts'), 'utf8'),
  );
  const scratchSource = readFileSync(
    join(storeDir, 'src/routeTree.gen.ts'),
    'utf8',
  );
  const scratch = routeIds(scratchSource);

  const missing = [...monorepo].filter((id) => !scratch.has(id));
  const extra = [...scratch].filter((id) => !monorepo.has(id));
  details.push(`route-id: монорепо ${monorepo.size}, скретч ${scratch.size}`);
  if (missing.length) details.push(`бракує у скретчі: ${missing.join(', ')}`);
  if (extra.length) details.push(`зайві у скретчі: ${extra.join(', ')}`);

  // Імпорти роутів мають вести в node_modules пакетів, а не в локальні теки.
  const imports = [...scratchSource.matchAll(/^import .* from '(.+)'$/gm)].map(
    (m) => m[1],
  );
  const fromCore = imports.filter((p) => p.includes('node_modules/simplycms/'));
  const fromSatellites = imports.filter((p) =>
    p.includes('node_modules/@simplycms/'),
  );
  const suspicious = imports.filter(
    (p) => p.includes('packages/') || p.includes('/src/'),
  );
  details.push(
    `імпортів із node_modules: ядро ${fromCore.length}, ` +
      `сателіти ${fromSatellites.length}`,
  );
  if (suspicious.length) {
    details.push(`підозрілі імпорти: ${suspicious.join(', ')}`);
  }

  return {
    ok:
      missing.length === 0 &&
      extra.length === 0 &&
      suspicious.length === 0 &&
      fromCore.length > 0,
    details,
  };
}
