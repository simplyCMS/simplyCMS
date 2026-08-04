import { physical, rootRoute } from '@tanstack/virtual-file-routes';

/**
 * Віртуальна конфігурація роутів магазину.
 *
 * Каркас (вітрина + адмінка) приходить теками роутів із `node_modules` —
 * пакетами ядра, а не файлами магазину. Файлове сканування `src/routes`
 * вимкнене: у роутер потрапляє лише явно змонтоване нижче.
 *
 * Шляхи в `physical()` відносні до `routesDirectory` (`src/routes`).
 */
export const routes = rootRoute('__root.tsx', [
  physical('', '../../node_modules/@simplycms/storefront-routes/routes'),
  physical('', '../../node_modules/@simplycms/admin-routes/routes'),
  // Кастомні роути цього магазину (спочатку — порожня тека).
  physical('', 'my'),
]);
