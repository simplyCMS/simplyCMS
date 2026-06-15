import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';
import { AdminLayout } from '@simplysoftua/admin/layouts/AdminLayout';
import { getUser, isAdmin } from '../server/auth';

/**
 * Layout-роут адмінки.
 *
 * Адмінка повністю client-only (`ssr: false`) — уся data-логіка на React Query +
 * клієнтському Supabase. `beforeLoad` виконує client-side guard для навігацій після
 * гідрації; початковий запит на `/admin` додатково перевіряється в `src/start.ts`.
 */
export const Route = createFileRoute('/admin')({
  ssr: false,
  beforeLoad: async () => {
    // Розрізняємо кейси так само, як серверний guard у start.ts:
    // немає сесії → /auth; є сесія, але не admin → / (без bounce на /auth).
    const user = await getUser();
    if (!user) {
      throw redirect({ to: '/auth' });
    }
    const ok = await isAdmin();
    if (!ok) {
      throw redirect({ to: '/' });
    }
  },
  // `ssr: false` маршруту потрібен pendingComponent: сервер рендерить його як
  // fallback, він гідрується змонтованим, і перехід pending→loaded на клієнті
  // не б'є setState по ще не змонтованому Transitioner (попередження React).
  pendingComponent: AdminPending,
  component: AdminRoot,
});

function AdminRoot() {
  return (
    <AdminLayout>
      <Outlet />
    </AdminLayout>
  );
}

/** Fallback під час client-side guard/завантаження адмінки */
function AdminPending() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-sm text-muted-foreground">Завантаження адмінки…</p>
    </div>
  );
}
