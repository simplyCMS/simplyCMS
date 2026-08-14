import { physical, rootRoute } from '@tanstack/virtual-file-routes';

/**
 * Віртуальна конфігурація роутів (`router.virtualRouteConfig` у `vite.config.ts`).
 *
 * Дерево збирається з кількох фізичних тек, змерджених на ОДНОМУ рівні:
 * префікс `''` означає «без додаткового сегмента шляху», тож id роутів
 * лишаються такими самими, як при звичайному файловому скані.
 *
 * Шляхи в `physical()` відносні до `routesDirectory` (`src/routes`),
 * звідси `../../` для виходу в `packages/`.
 */
export const routes = rootRoute('__root.tsx', [
  physical('', '../../packages/storefront-routes/routes'),
  physical('', '../../packages/admin-routes/routes'),
  // plugin admin routes — місце монтажу роутів адмінки плагінів: додай сюди
  // рядок physical() після встановлення плагіна з adminRoutes (автоматичну
  // вставку через `simplycms add` відкладено — див. cli.md §9). Файли самі
  // несуть запечені id /admin/<slug>/* і стають дітьми layout /admin.
  physical('', '../../packages/simplycms-plugin-faq/routes'),
  // Кастомні роути конкретного магазину. Після переїзду ядра в пакети це
  // єдина тека роутів, що лишається в host — саме вона, а не весь
  // `src/routes`: інакше будь-який файл, покладений поруч із `__root.tsx`,
  // мовчки ставав би роутом.
  physical('', 'my'),
]);
