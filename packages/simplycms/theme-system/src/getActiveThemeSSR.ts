import { cache } from 'react';
import { createAnonSupabaseClient } from '@simplycms/supabase/anon-client';
import { ThemeRegistry } from './ThemeRegistry';
import type { ActiveThemeSSR, ThemeRecord } from './types';

const DEFAULT_THEME = 'default';

/**
 * Отримати запис активної теми з БД.
 * Обгорнуто в unstable_cache для cross-request кешування.
 * Використовує анонімний клієнт (без cookies) для сумісності з cache.
 */
// TODO: Додати cross-request кешування через TanStack Start API
const getCachedActiveThemeRecord = async (): Promise<ThemeRecord | null> => {
  const supabase = createAnonSupabaseClient();
  const { data, error } = await supabase
    .from('themes')
    .select('*')
    .eq('is_active', true)
    .single();

  if (error) {
    console.error(
      '[getActiveThemeSSR] Помилка запиту до БД:',
      error.message,
      error.code,
    );
    return null;
  }

  if (!data) {
    console.error(
      '[getActiveThemeSSR] Немає активної теми в БД (themes.is_active = true)',
    );
    return null;
  }

  return {
    id: data.id,
    name: data.name,
    display_name: data.display_name,
    version: data.version,
    description: data.description,
    author: data.author,
    preview_image: data.preview_image,
    is_active: data.is_active,
    settings: (data.settings as Record<string, unknown>) || {},
    created_at: data.created_at ?? new Date().toISOString(),
    updated_at: data.updated_at ?? new Date().toISOString(),
  };
};

/**
 * SSR-резолюція активної теми.
 *
 * Читає активну тему з БД (кешовано через unstable_cache),
 * резолвить ThemeModule через ThemeRegistry.
 *
 * ВАЖЛИВО: перед викликом потрібно зареєструвати теми через
 * import "app/theme-registry.server.ts" у layout.tsx
 *
 * Обгорнуто в React cache() для per-request deduplication —
 * кілька викликів у layout + page в одному запиті виконають
 * логіку лише один раз.
 */
export const getActiveThemeSSR = cache(async (): Promise<ActiveThemeSSR> => {
  // Перевірка що теми зареєстровані
  if (!ThemeRegistry.has(DEFAULT_THEME)) {
    throw new Error(
      '[getActiveThemeSSR] ThemeRegistry порожній. ' +
        'Імпортуйте "app/theme-registry.server.ts" у layout.tsx перед викликом getActiveThemeSSR().',
    );
  }

  const record = await getCachedActiveThemeRecord();

  // Визначити назву активної теми
  const dbThemeName = record?.name ?? DEFAULT_THEME;

  // Fallback на default якщо тема не зареєстрована в Registry
  const resolvedName = ThemeRegistry.has(dbThemeName)
    ? dbThemeName
    : DEFAULT_THEME;

  const theme = await ThemeRegistry.load(resolvedName);

  // Нормалізація themeRecord:
  // - Якщо запису немає — створити з manifest
  // - Якщо тема впала на fallback — повертаємо record від default
  let themeRecord: ThemeRecord;

  if (record && resolvedName === dbThemeName) {
    // Тема з БД знайдена в Registry — використовуємо as-is
    themeRecord = record;
  } else {
    // Fallback або відсутність запису — формуємо з manifest
    themeRecord = {
      id: record?.id ?? '',
      name: resolvedName,
      display_name: theme.manifest.displayName,
      version: theme.manifest.version,
      // Опис і автор — редакційні поля рядка `themes`, у паспорті теми
      // (контракт v2) їх немає: коли рядка в БД нема, лишаються порожніми.
      description: null,
      author: null,
      preview_image: null,
      is_active: true,
      settings: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  return { theme, themeName: resolvedName, themeRecord };
});
