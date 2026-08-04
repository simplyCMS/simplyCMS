import { Link } from '@tanstack/react-router';
import { useThemeSettings } from '@simplycms/core/hooks/useThemeSettings';
import { FacebookIcon, InstagramIcon } from './SocialIcons';

export function Footer() {
  const storeName = useThemeSettings<string>('storeName') || 'Beauty Store';
  const storeSlogan = useThemeSettings<string>('storeSlogan') || '';
  const logoUrl = useThemeSettings<string>('logoUrl');
  const fbUrl = useThemeSettings<string>('socialFacebook');
  const igUrl = useThemeSettings<string>('socialInstagram');

  return (
    <footer className="border-t border-border/40 bg-[hsl(var(--card))]">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="md:col-span-1">
            <Link to="/" className="inline-block mb-3">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt={storeName}
                  width={160}
                  height={40}
                  loading="lazy"
                  decoding="async"
                  className="h-8 object-contain"
                />
              ) : (
                <span className="text-lg font-serif font-bold text-foreground">
                  {storeName}
                </span>
              )}
            </Link>
            {storeSlogan && (
              <p className="text-sm text-muted-foreground">{storeSlogan}</p>
            )}
            <div className="flex gap-3 mt-4">
              {fbUrl && (
                <a
                  href={fbUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-primary transition-colors"
                >
                  <FacebookIcon className="h-5 w-5" />
                </a>
              )}
              {igUrl && (
                <a
                  href={igUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-primary transition-colors"
                >
                  <InstagramIcon className="h-5 w-5" />
                </a>
              )}
            </div>
          </div>

          {/* Links */}
          <div>
            <h4 className="text-sm font-semibold text-foreground mb-4 uppercase tracking-wider">
              Каталог
            </h4>
            <nav className="space-y-2">
              <Link
                to="/catalog"
                className="block text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Усі товари
              </Link>
              <Link
                to="/properties"
                className="block text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Бренди
              </Link>
            </nav>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-foreground mb-4 uppercase tracking-wider">
              Інформація
            </h4>
            <nav className="space-y-2">
              <span className="block text-sm text-muted-foreground">
                Доставка і оплата
              </span>
              <span className="block text-sm text-muted-foreground">
                Повернення
              </span>
              <span className="block text-sm text-muted-foreground">
                Контакти
              </span>
            </nav>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-foreground mb-4 uppercase tracking-wider">
              Мій акаунт
            </h4>
            <nav className="space-y-2">
              <Link
                to="/profile"
                className="block text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Кабінет
              </Link>
              <Link
                to="/profile/orders"
                className="block text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Мої замовлення
              </Link>
              <Link
                to="/cart"
                className="block text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Кошик
              </Link>
            </nav>
          </div>
        </div>
      </div>

      <div className="border-t border-border/40">
        <div className="container mx-auto px-4 py-4 text-center">
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} {storeName}. Усі права захищено.
          </p>
        </div>
      </div>
    </footer>
  );
}
