import { createServerFn } from '@tanstack/react-start';
import { loadActiveTheme } from './theme-record';

/**
 * Отримати запис активної теми (serverFn для лоадерів роутів).
 *
 * 🔴 Модуль тримає РІВНО один експорт, і саме serverFn: його імпортує
 * `__root.tsx`, тобто клієнтський контур. Тіло serverFn Start вирізає з
 * клієнтського бандла — а от будь-який звичайний експорт поруч затягнув би
 * сюди `./theme-record` разом із пулом Postgres.
 */
export const getActiveTheme = createServerFn({ method: 'GET' }).handler(
  async () => loadActiveTheme(),
);
