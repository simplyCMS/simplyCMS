import { physical, rootRoute } from '@tanstack/virtual-file-routes';

/**
 * Віртуальна конфігурація роутів скретч-магазину.
 *
 * Ключова відмінність від монорепо: теки роутів беруться з `node_modules`,
 * куди їх поклав справжній `npm install` із tarball-ів. Жодних
 * workspace-аліасів на `packages/**` тут немає — у цьому суть пілота.
 *
 * Шляхи в `physical()` відносні до `routesDirectory` (`src/routes`).
 */
export const routes = rootRoute('__root.tsx', [
  physical('', '../../node_modules/@simplycms/storefront-routes/routes'),
  physical('', '../../node_modules/@simplycms/admin-routes/routes'),
  // Кастомні роути конкретного магазину (у скретчі — порожня тека).
  physical('', 'my'),
]);
