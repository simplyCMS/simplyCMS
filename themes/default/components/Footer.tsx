import { Link } from '@tanstack/react-router';
import { useT } from '@simplycms/i18n';
import { useThemeT } from '@simplycms/themes/useThemeT';
import { useThemeSettings } from '@simplycms/core/hooks/useThemeSettings';
import { FacebookIcon, InstagramIcon } from './SocialIcons';
import type { DefaultThemeKey } from '../messages';

export function Footer() {
  const t = useT();
  const tt = useThemeT<DefaultThemeKey>();
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
              {t('catalog.title')}
            </h4>
            <nav className="space-y-2">
              <Link
                to="/catalog"
                className="block text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {t('catalog.allProducts')}
              </Link>
              <Link
                to="/properties"
                className="block text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {tt('theme.nav.brands')}
              </Link>
            </nav>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-foreground mb-4 uppercase tracking-wider">
              {t('common.information')}
            </h4>
            <nav className="space-y-2">
              <span className="block text-sm text-muted-foreground">
                {tt('theme.footer.shippingPayment')}
              </span>
              <span className="block text-sm text-muted-foreground">
                {tt('theme.footer.returns')}
              </span>
              <span className="block text-sm text-muted-foreground">
                {tt('theme.footer.contacts')}
              </span>
            </nav>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-foreground mb-4 uppercase tracking-wider">
              {tt('theme.footer.accountHeading')}
            </h4>
            <nav className="space-y-2">
              <Link
                to="/profile"
                className="block text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {tt('theme.footer.accountLink')}
              </Link>
              <Link
                to="/profile/orders"
                className="block text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {t('nav.orders')}
              </Link>
              <Link
                to="/cart"
                className="block text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {t('cart.title')}
              </Link>
            </nav>
          </div>
        </div>
      </div>

      <div className="border-t border-border/40">
        <div className="container mx-auto px-4 py-4 text-center">
          <p className="text-xs text-muted-foreground">
            {tt('theme.footer.copyright', {
              year: new Date().getFullYear(),
              storeName,
            })}
          </p>
        </div>
      </div>
    </footer>
  );
}
