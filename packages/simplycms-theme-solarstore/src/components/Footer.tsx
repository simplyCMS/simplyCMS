import { Link } from '@tanstack/react-router';
import { useT } from 'simplycms/i18n';
import { useStoreProfile } from 'simplycms/themes/store-profile';
import { useThemeT } from 'simplycms/themes/useThemeT';
import { BrandMark } from './BrandMark';
import { FooterContacts, FooterSocials } from './FooterProfile';
import type { SolarstoreThemeKey } from '../messages';

export function Footer() {
  const t = useT();
  const tt = useThemeT<SolarstoreThemeKey>();
  const { name } = useStoreProfile();
  return (
    <footer className="border-t border-[hsl(var(--border))]/40 bg-[hsl(var(--card))]">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Бренд */}
          <div className="md:col-span-1">
            <Link to="/" className="flex items-center gap-2 mb-4">
              <BrandMark size="footer" />
            </Link>
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
              {tt('theme.footer.description')}
            </p>
            <FooterSocials />
          </div>

          {/* Каталог */}
          <div>
            <h4 className="text-sm font-semibold text-[hsl(var(--foreground))] mb-4 uppercase tracking-wider">
              {t('catalog.title')}
            </h4>
            <nav className="space-y-2">
              <Link
                to="/catalog"
                className="block text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
              >
                {t('catalog.allProducts')}
              </Link>
              <Link
                to="/properties"
                className="block text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
              >
                {tt('theme.nav.brands')}
              </Link>
            </nav>
          </div>

          {/* Інформація */}
          <div>
            <h4 className="text-sm font-semibold text-[hsl(var(--foreground))] mb-4 uppercase tracking-wider">
              {t('common.information')}
            </h4>
            <nav className="space-y-2">
              <span className="block text-sm text-[hsl(var(--muted-foreground))]">
                {tt('theme.footer.shippingPayment')}
              </span>
              <span className="block text-sm text-[hsl(var(--muted-foreground))]">
                {tt('theme.footer.warranty')}
              </span>
              <span className="block text-sm text-[hsl(var(--muted-foreground))]">
                {tt('theme.footer.returns')}
              </span>
            </nav>
          </div>

          {/* Контакти — з профілю магазину */}
          <FooterContacts />
        </div>
      </div>

      <div className="border-t border-[hsl(var(--border))]/40">
        <div className="container mx-auto px-4 py-4 text-center">
          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            {tt('theme.footer.copyright', {
              year: new Date().getFullYear(),
              name,
            })}
          </p>
        </div>
      </div>
    </footer>
  );
}
