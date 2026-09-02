import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';
import { AdminLayout } from 'simplycms/admin/layouts/AdminLayout';
import { useT } from 'simplycms/i18n';
import { getUser, isAdmin } from 'simplycms/storefront-routes/server/auth';

/**
 * Layout-роут адмінки.
 *
 * Роут лишається client-only (`ssr: false`): більшість сторінок адмінки й
 * досі читають/пишуть напряму з браузера легасі-шаром supabase-js — для них
 * серверного шляху ще немає. Виняток під цим лейаутом — `/admin/order-statuses`:
 * він уже ходить через serverFn-и `simplycms/admin-server` і TanStack DB-колекцію,
 * решта сторінок перейде хвилями Е3–Е6. `beforeLoad` виконує client-side guard
 * для навігацій після гідрації; початковий запит на `/admin` додатково
 * перевіряється в `src/start.ts`.
 */

/**
 * К3-6: `crypto.randomUUID` існує лише в secure context — адмінка на
 * `http://` не-localhost мовчки отримала б `undefined` на кожному create.
 *
 * 🔴 Помилка ТИПІЗОВАНА і АНГЛІЙСЬКА (прецедент
 * `core/lib/user-addresses.ts:88`: «серверна діагностика, а не рядок
 * інтерфейсу»): `beforeLoad` — поза React-контекстом, локаль там
 * недосяжна, тож рядок ІНТЕРФЕЙСУ дає `errorComponent` цього ж роуту
 * (`AdminError` нижче) за `error.name` — контракт як у К3-13
 * (`authz-request.ts`: серіалізація не зберігає прототипи, тож
 * `instanceof` на клієнті ненадійний).
 */
class InsecureContextError extends Error {
  override readonly name = 'InsecureContextError';
}

export const Route = createFileRoute('/admin')({
  ssr: false,
  beforeLoad: async () => {
    // ПЕРШИЙ рядок beforeLoad: роут client-only (`ssr:false`), тож це
    // виконується рівно один раз на старті адмінки, до будь-якого запиту.
    if (
      typeof crypto === 'undefined' ||
      typeof crypto.randomUUID !== 'function'
    ) {
      throw new InsecureContextError(
        '[simplycms/admin] Secure context required (https:// or localhost): crypto.randomUUID is unavailable.',
      );
    }
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
  errorComponent: AdminError,
  component: AdminRoot,
});

function AdminRoot() {
  return (
    <AdminLayout>
      <Outlet />
    </AdminLayout>
  );
}

/**
 * Fallback під час client-side guard/завантаження адмінки.
 *
 * `useT()` тут безпечний: `pendingComponent` рендериться на тому самому місці
 * дерева, що й `component` цього ж роуту, тобто всередині `I18nProvider` з
 * host-`__root.tsx` (той самий контекст, який уже споживає `AdminLayout`).
 */
function AdminPending() {
  const t = useT();

  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-sm text-muted-foreground">
        {t('admin.common.loading')}
      </p>
    </div>
  );
}

/**
 * Помилки `beforeLoad`/`loader` адмінки. `useT()` тут так само безпечний,
 * як у `AdminPending` — той самий рівень дерева, всередині `I18nProvider`.
 *
 * Відомий код (`InsecureContextError`) отримує перекладений рядок; решта —
 * як кореневий `ErrorBoundary` (`src/routes/__root.tsx`): `error.message`
 * дослівно, з тим самим fallback-ключем на випадок порожнього повідомлення.
 * Розрізнення за `error.name`, не `instanceof` — той самий контракт К3-13.
 */
function AdminError({ error }: { error: Error }) {
  const t = useT();
  const message =
    error.name === 'InsecureContextError'
      ? t('admin.common.insecureContext')
      : (error.message ?? t('app.error.fallback'));

  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-sm text-destructive">{message}</p>
    </div>
  );
}
