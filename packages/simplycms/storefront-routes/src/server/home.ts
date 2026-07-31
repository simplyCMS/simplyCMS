import { createServerFn } from '@tanstack/react-start';
import { loadHomePageData } from '@simplycms/storefront/loaders';
import { createServerSupabase } from '@simplycms/supabase/server-client';

/** Отримати дані головної сторінки */
export const getHomePageData = createServerFn({ method: 'GET' }).handler(
  async () => loadHomePageData(createServerSupabase()),
);
