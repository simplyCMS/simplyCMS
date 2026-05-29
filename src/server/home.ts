import { createServerFn } from '@tanstack/react-start';
import { loadHomePageData } from '@simplycms/storefront/loaders';
import { createServerSupabase } from './supabase';

/** Отримати дані головної сторінки */
export const getHomePageData = createServerFn({ method: 'GET' }).handler(
  async () => loadHomePageData(createServerSupabase()),
);
