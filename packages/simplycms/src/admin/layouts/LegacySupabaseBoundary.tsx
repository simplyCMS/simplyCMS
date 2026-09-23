import { Component, type ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import { adminPath } from '../lib/adminLinks';
import { useT } from 'simplycms/i18n';

/**
 * Ім'я помилки, яким `simplycms/supabase/keys.ts` позначає відсутність
 * `VITE_SUPABASE_*` в env (контракт розрізнення за `.name`, як К3-13/AdminError,
 * а не `instanceof` — прототипи через серіалізацію не гарантовані).
 */
const LEGACY_ENV_ERROR_NAME = 'SupabaseEnvMissingError';

interface BoundaryState {
  readonly hasLegacyError: boolean;
}

/**
 * ЄДИНА точка перехоплення легасі-крашу супабейз-шару адмінки (К3-Е3 Step 0).
 *
 * ~36 сторінок `admin/pages/**` досі йдуть через `useSupabaseClient()`, а
 * контракт env магазину (0.4.1) `VITE_SUPABASE_*` не містить — без цього
 * гварда виклик кидав би `SupabaseEnvMissingError` під час рендера і зносив
 * би АДМІНКУ ЦІЛКОМ (`errorComponent` роуту `/admin` заміняє й сайдбар).
 * Тут — заглушка на місці КОНТЕНТУ, сайдбар і навігація лишаються живі.
 *
 * `AdminLayout` монтує це з `key={pathname}`: без ремаунта на кожну
 * client-side навігацію стан "заглушки" пережив би перехід на живу
 * сторінку (React не скидає стан error boundary автоматично).
 *
 * Будь-яка ІНША помилка — не наша: `getDerivedStateFromError` перекидає її
 * далі, до `errorComponent` роуту `/admin` (`AdminError`), без регресії
 * наявної поведінки.
 */
export class LegacySupabaseBoundary extends Component<
  { children: ReactNode },
  BoundaryState
> {
  override state: BoundaryState = { hasLegacyError: false };

  static getDerivedStateFromError(error: unknown): BoundaryState {
    if (error instanceof Error && error.name === LEGACY_ENV_ERROR_NAME) {
      return { hasLegacyError: true };
    }
    throw error;
  }

  override render(): ReactNode {
    if (this.state.hasLegacyError) {
      return <LegacyNotMigratedNotice />;
    }
    return this.props.children;
  }
}

/** Заглушка легасі-розділу: посилання ведуть на живі сторінки К3. */
function LegacyNotMigratedNotice() {
  const t = useT();

  return (
    <div className="rounded-lg border border-dashed p-6 text-center space-y-4">
      <p className="text-muted-foreground">{t('admin.legacy.notMigrated')}</p>
      <div className="flex justify-center gap-4 text-sm">
        <Link to={adminPath('products')} className="underline">
          {t('admin.nav.products')}
        </Link>
        <Link to={adminPath('order-statuses')} className="underline">
          {t('admin.nav.orderStatuses')}
        </Link>
      </div>
    </div>
  );
}
