import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';
import { AdminLayout } from 'simplycms/admin/layouts/AdminLayout';
import {
  I18nProvider,
  loadUiCatalog,
  resolveAdminUiLocale,
  resolveUiLocale,
  useUiCatalogs,
} from 'simplycms/i18n';
import { getAdminSession } from 'simplycms/storefront-routes/server/auth';
import { AdminError, AdminPending } from './AdminBoundaries';

/**
 * Layout-роут адмінки.
 *
 * Роут лишається client-only (`ssr: false`): адмінка працює через serverFn-и
 * `simplycms/admin-server` і TanStack DB-колекції `simplycms/admin-data` —
 * колекції живуть у браузері. `beforeLoad` виконує client-side guard
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
 * (`AdminError` з `AdminBoundaries`) за `error.name` — контракт як у К3-13
 * (`authz-request.ts`: серіалізація не зберігає прототипи, тож
 * `instanceof` на клієнті ненадійний).
 */
class InsecureContextError extends Error {
  override readonly name = 'InsecureContextError';
}

export const Route = createFileRoute('/admin')({
  ssr: false,
  beforeLoad: async ({ context }) => {
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
    const session = await getAdminSession();
    if (!session) {
      throw redirect({ to: '/auth' });
    }
    if (!session.isAdmin) {
      throw redirect({ to: '/' });
    }
    // Мова адмінки — з власного профілю, прочитаного РАЗОМ із сесією (§19.6): збережена з
    // частиною `admin` → основна з `admin` → `en`. Частини `base` і `admin` вантажимо тут,
    // до рендера: layout розгортає їх через `use` синхронно. Повторний виклик після
    // `router.invalidate()` перечитує вибір.
    const adminUi = resolveAdminUiLocale(
      session.uiLocale,
      context.locales.primary,
    );
    await Promise.all([
      loadUiCatalog(adminUi, 'base'),
      loadUiCatalog(adminUi, 'admin'),
    ]);
    // Кінцева ланка fallback плагіна/теми — пакет ОСНОВНОЇ мови магазину, а не мова адмінки:
    // інакше `en`-адмін бачить сирі ключі плагіна, що має лише `uk` (§19.4, §19.15).
    const adminFallback = resolveUiLocale(
      context.locales.primary,
      context.locales.primary,
    );
    return { adminUi, adminFallback };
  },
  // `ssr: false` маршруту потрібен pendingComponent: сервер рендерить його як
  // fallback, він гідрується змонтованим, і перехід pending→loaded на клієнті
  // не б'є setState по ще не змонтованому Transitioner (попередження React).
  pendingComponent: AdminPending,
  errorComponent: AdminError,
  component: AdminRoot,
});

const ADMIN_PARTS = ['base', 'admin'] as const;

/**
 * Вкладений провайдер: кореневий несе лише `base` вітрини, а каталог адмінки потрібен
 * тільки тут (І43 — вітрина його не тягне). Мова адмінки — з профілю, а не з мови сторінки.
 */
function AdminRoot() {
  const { adminUi, adminFallback } = Route.useRouteContext();
  const catalogs = useUiCatalogs(adminUi, ADMIN_PARTS);
  return (
    <I18nProvider locale={adminUi} fallback={adminFallback} catalogs={catalogs}>
      {/* `contents`: обгортка лише несе `lang` і не втручається в розкладку. */}
      <div lang={adminUi} className="contents">
        <AdminLayout>
          <Outlet />
        </AdminLayout>
      </div>
    </I18nProvider>
  );
}
