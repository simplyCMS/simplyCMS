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
  physical('', '../../packages/simplycms/storefront-routes/routes'),
  physical('', '../../packages/simplycms/admin-routes/routes'),
  // Транзитивний запис: роути, які ще не переїхали в пакети, лишаються в
  // `src/routes`. Скан теки `.` уже покриває і `src/routes/my/`, тож окремий
  // `physical('', 'my')` тут навмисно відсутній — інакше `my/` сканувався б
  // двічі й будь-який файл у ньому дав би дубль роуту.
  // Замінюється на `physical('', 'my')` у Task 9, коли `src/routes` порожніє.
  physical('', '.'),
]);
