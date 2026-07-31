import { createServerFn } from '@tanstack/react-start';
import { createAnonSupabaseClient } from '@simplycms/supabase/anon-client';
import type { Json } from '@simplycms/supabase';

/** Запис теми з БД */
interface ThemeRecord {
  id: string;
  name: string;
  display_name: string;
  version: string;
  description: string | null;
  author: string | null;
  preview_image: string | null;
  is_active: boolean;
  settings: Record<string, Json>;
  created_at: string;
  updated_at: string;
}

/** In-memory кеш з TTL для активної теми */
interface CacheEntry {
  data: ThemeRecord | null;
  timestamp: number;
}

const CACHE_TTL = 5 * 60 * 1000; // 5 хвилин
let themeCache: CacheEntry | null = null;

/**
 * Отримати запис активної теми з БД.
 *
 * Використовує анонімний клієнт (таблиця themes має RLS anon SELECT).
 * Результат кешується in-memory з TTL для cross-request ефективності.
 */
export const getActiveTheme = createServerFn({ method: 'GET' }).handler(
  async () => {
    const now = Date.now();

    if (themeCache && now - themeCache.timestamp < CACHE_TTL) {
      return themeCache.data;
    }

    const supabase = createAnonSupabaseClient();
    const { data, error } = await supabase
      .from('themes')
      .select('*')
      .eq('is_active', true)
      .single();

    if (error) {
      console.error(
        '[getActiveTheme] Помилка запиту до БД:',
        error.message,
        error.code,
      );
      themeCache = { data: null, timestamp: now };
      return null;
    }

    const record: ThemeRecord = {
      id: data.id,
      name: data.name,
      display_name: data.display_name,
      version: data.version,
      description: data.description,
      author: data.author,
      preview_image: data.preview_image,
      is_active: data.is_active,
      settings: (data.settings as Record<string, Json>) || {},
      created_at: data.created_at ?? new Date().toISOString(),
      updated_at: data.updated_at ?? new Date().toISOString(),
    };

    themeCache = { data: record, timestamp: now };
    return record;
  },
);

/** Скинути кеш активної теми (для зовнішніх webhook / admin) */
export function invalidateThemeCache() {
  themeCache = null;
}
