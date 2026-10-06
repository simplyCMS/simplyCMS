import { createServerFn } from '@tanstack/react-start';
import { loadActiveTheme } from 'simplycms/storefront/loaders';

/**
 * Отримати запис активної теми (serverFn для лоадерів роутів).
 *
 * 🔴 Модуль тримає РІВНО один експорт, і саме serverFn: його імпортують
 * каркасні роути `_storefront.tsx` і `_protected.tsx`, тобто клієнтський
 * контур (корінь host-а з Е6б-10 бере тему через `server/root`). Тіло serverFn Start вирізає з
 * клієнтського бандла — а от будь-який звичайний експорт поруч затягнув би
 * сюди `storefront/loaders/theme-record` разом із пулом Postgres.
 */
export const getActiveTheme = createServerFn({ method: 'GET' }).handler(
  async () => loadActiveTheme(),
);
