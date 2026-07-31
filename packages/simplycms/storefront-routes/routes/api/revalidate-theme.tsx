import { createFileRoute } from '@tanstack/react-router';
import { checkIsAdmin } from '@simplycms/storefront-routes/server/auth';
import { invalidateThemeCache } from '@simplycms/storefront-routes/server/themes';

/**
 * Скидання серверного кешу активної теми (TTL 5 хв) після перемикання теми
 * в адмінці. Живе поруч із кешем — адмінка б'є сюди по HTTP, тому забороненого
 * ребра `@simplycms/admin → @simplycms/storefront-routes` не виникає.
 *
 * Guard: тільки роль admin. Без сесії або без ролі → 403.
 */
export async function revalidateThemeHandler(): Promise<Response> {
  if (!(await checkIsAdmin())) {
    return Response.json(
      { error: 'Доступ лише для адміністратора' },
      { status: 403 },
    );
  }

  invalidateThemeCache();
  return Response.json({ revalidated: true }, { status: 200 });
}

export const Route = createFileRoute('/api/revalidate-theme')({
  server: {
    handlers: {
      POST: revalidateThemeHandler,
    },
  },
});
