import { createFileRoute } from '@tanstack/react-router';
import { revalidateTheme } from '@simplycms/storefront-routes/server/revalidate-theme';

/**
 * POST `/api/revalidate-theme` — скидає серверний кеш активної теми.
 * Адмінка б'є сюди по HTTP, тому забороненого ребра
 * `@simplycms/admin → @simplycms/storefront-routes` не виникає.
 *
 * 🔴 Файл лишає ЄДИНИЙ export — `Route`. Named export звідси пережив би
 * стрипінг властивості `server` і затягнув серверний Supabase-клієнт у
 * клієнтський бандл, тому guard і логіка живуть у
 * `src/server/revalidate-theme.ts` (спіймано Gate C пілота).
 */
export const Route = createFileRoute('/api/revalidate-theme')({
  server: {
    handlers: {
      POST: revalidateTheme,
    },
  },
});
