import { createServerFn } from '@tanstack/react-start';
import {
  loadHomePageData,
  withStorefrontDb,
} from 'simplycms/storefront/loaders';

/** Отримати дані головної сторінки — однією транзакцією вітрини. */
export const getHomePageData = createServerFn({ method: 'GET' }).handler(
  async () => withStorefrontDb((db) => loadHomePageData(db)),
);
