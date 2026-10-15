import { Link } from '@tanstack/react-router';
import { useRequestTranslator } from './useRequestTranslator';

/**
 * 404 кореня вітрини. Рендериться замість `RootComponent`, тобто поза
 * `I18nProvider`, тому мову бере з адреси запиту (`useRequestTranslator`):
 * `/en/x` без маршруту показує англійською, а не мовою магазину.
 */
export function RootNotFound() {
  const t = useRequestTranslator();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center">
      <h1 className="text-6xl font-bold">{t('app.notFound.title')}</h1>
      <p className="mt-4 text-xl text-muted-foreground">
        {t('app.notFound.message')}
      </p>
      <Link to="/" className="mt-8 underline hover:text-foreground">
        {t('app.backHome')}
      </Link>
    </div>
  );
}
