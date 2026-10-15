import { Link } from '@tanstack/react-router';
import type { ErrorComponentProps } from '@tanstack/react-router';
import { useStaleChunkRecovery } from 'simplycms/runtime/stale-chunk-react';
import { describePublicError } from 'simplycms/contracts/masked-error';
import { useRequestTranslator } from 'simplycms/storefront-routes/locale/useRequestTranslator';

/**
 * Єдиний екран помилки вітрини: корінь (`errorComponent`) і всі дочірні роути
 * (`defaultErrorComponent` у `getRouter()`).
 *
 * 🔴 Р23: текст помилки показуємо лише коли він безпечний — доменна помилка з
 * кодом або не-прод. Предикат той самий, що на сервері (`isProductionRuntime`:
 * `NODE_ENV === 'production'`); Vite підставляє його літералом в обох збірках. Інакше (непередбачена помилка в проді) — загальна фраза
 * й ідентифікатор для звернення до власника: справжній текст міг бути SQL чи
 * `host:port`. Без цього дочірні роути друкували б `error.message` як є.
 */
export function RouteError({ error }: ErrorComponentProps) {
  // 🔴 Не `useT()`: екран помилки рендериться замість `RootComponent`, тобто
  // поза `I18nProvider`, і `useT()` там кинув би — помилка всередині обробника
  // помилок. Мова — з адреси запиту (`/en/x` → англійська), основна — з контексту
  // роутера.
  const t = useRequestTranslator();
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
  const { message, ref } = describePublicError(
    error,
    process.env.NODE_ENV !== 'production',
  );
  return (
    <div className="flex min-h-screen flex-col items-center justify-center">
      <h1 className="text-4xl font-bold">{t('app.error.title')}</h1>
      <p className="mt-4 text-muted-foreground">
        {message ?? t('app.error.fallback')}
      </p>
      {ref && (
        <p className="mt-2 text-xs text-muted-foreground">
          {t('app.error.reference', { id: ref })}
        </p>
      )}
      <Link to="/" className="mt-8 underline hover:text-foreground">
        {t('app.backHome')}
      </Link>
    </div>
  );
}
