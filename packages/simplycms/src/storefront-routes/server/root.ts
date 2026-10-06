import { createServerFn } from '@tanstack/react-start';
import {
  loadActiveTheme,
  loadStoreProfile,
} from 'simplycms/storefront/loaders';

/**
 * Дані кореня вітрини для host-а (Е6б-10): активна тема, профіль магазину й
 * публічна адреса сайту. Host доповнює їх локаллю і віддає як
 * `StorefrontRootData` (`simplycms/storefront-routes/head/head`).
 *
 * 🔴 Модуль тримає РІВНО один експорт, і саме serverFn: його імпортує
 * `__root.tsx`, тобто клієнтський контур. Тіло serverFn Start вирізає з
 * клієнтського бандла — а будь-який звичайний експорт поруч затягнув би сюди
 * лоадери разом із пулом Postgres.
 *
 * `siteUrl` — з `process.env` у рантаймі (контракт серверного env): модульна
 * константа запеклася б у білд. Порожній рядок — «адреса не задана»; хто
 * будує абсолютні URL, сам вирішує, що тоді опустити.
 */
export const getStorefrontRoot = createServerFn({ method: 'GET' }).handler(
  async () => {
    const [record, storeProfile] = await Promise.all([
      loadActiveTheme(),
      loadStoreProfile(),
    ]);
    return {
      activeThemeName: record?.name ?? 'default',
      storeProfile,
      siteUrl: process.env.VITE_SITE_URL ?? '',
    };
  },
);
