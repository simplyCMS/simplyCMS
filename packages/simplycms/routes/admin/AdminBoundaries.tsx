import type { ErrorComponentProps } from '@tanstack/react-router';
import { useT } from 'simplycms/i18n';
import { useStaleChunkRecovery } from 'simplycms/runtime/stale-chunk-react';

// Pending/error-межі роуту `/admin`: окремий файл, щоб `admin.tsx` лишався тонким
// описом роуту. Код `InsecureContextError` (`error.name`) кидає `beforeLoad` у `admin.tsx`.

/**
 * Fallback під час client-side guard/завантаження адмінки.
 *
 * `useT()` тут безпечний: `pendingComponent` рендериться всередині `I18nProvider` з
 * host-`__root.tsx`. Там лише частина `base`, а `admin` ще вантажиться в `beforeLoad`,
 * тож рядок — з неймспейсу `app` (оболонка), а не `admin.*`.
 */
export function AdminPending() {
  const t = useT();

  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-sm text-muted-foreground">{t('app.admin.loading')}</p>
    </div>
  );
}

/**
 * Помилки `beforeLoad`/`loader` адмінки. `useT()` тут так само безпечний, як у
 * `AdminPending` (кореневий провайдер), і з тієї ж причини — лише ключі `base`: помилка
 * могла статись до завантаження частини `admin`.
 *
 * Відомий код (`InsecureContextError`) отримує перекладений рядок; решта —
 * як кореневий `ErrorBoundary` (`src/routes/__root.tsx`): `error.message`
 * дослівно, з тим самим fallback-ключем на випадок порожнього повідомлення.
 * Розрізнення за `error.name`, не `instanceof` — той самий контракт К3-13.
 */
export function AdminError({ error }: ErrorComponentProps) {
  const t = useT();
  // Застарілий чанк після деплою: лікує перезавантаження, а не екран помилки.
  const recovering = useStaleChunkRecovery(error);
  if (recovering) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">
          {t('app.error.reloading')}
        </p>
      </div>
    );
  }
  // `error` — `unknown` (router-core ≥ 1.171): кинути можна будь-що. Поля
  // читаємо структурно, без `instanceof` — той самий контракт К3-13.
  const fields: { name?: unknown; message?: unknown } =
    typeof error === 'object' && error !== null ? error : {};
  const message =
    fields.name === 'InsecureContextError'
      ? t('app.error.insecureContext')
      : typeof fields.message === 'string'
        ? fields.message
        : t('app.error.fallback');

  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-sm text-destructive">{message}</p>
    </div>
  );
}
