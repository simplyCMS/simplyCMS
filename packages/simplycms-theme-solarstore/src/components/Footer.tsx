import { Link } from '@tanstack/react-router';
import { Sun, Phone, Mail, MapPin } from 'lucide-react';
import { useT } from '@simplycms/i18n';
import { useThemeT } from '@simplycms/themes/useThemeT';
import type { SolarstoreThemeKey } from '../messages';

export function Footer() {
  const t = useT();
  const tt = useThemeT<SolarstoreThemeKey>();
  return (
    <footer className="border-t border-[hsl(var(--border))]/40 bg-[hsl(var(--card))]">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Бренд */}
          <div className="md:col-span-1">
            <Link to="/" className="flex items-center gap-2 mb-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[hsl(var(--primary))]">
                <Sun className="h-4 w-4 text-white" />
              </div>
              <span className="font-semibold text-[hsl(var(--foreground))]">
                SolarStore
              </span>
            </Link>
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
              {tt('theme.footer.description')}
            </p>
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

          {/* Контакти */}
          <div>
            <h4 className="text-sm font-semibold text-[hsl(var(--foreground))] mb-4 uppercase tracking-wider">
              {tt('theme.nav.contacts')}
            </h4>
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-[hsl(var(--muted-foreground))]">
                <Phone className="h-4 w-4 shrink-0" />
                <span>+380 (XX) XXX-XX-XX</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-[hsl(var(--muted-foreground))]">
                <Mail className="h-4 w-4 shrink-0" />
                <span>info@solarstore.ua</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-[hsl(var(--muted-foreground))]">
                <MapPin className="h-4 w-4 shrink-0" />
                <span>{tt('theme.footer.country')}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-[hsl(var(--border))]/40">
        <div className="container mx-auto px-4 py-4 text-center">
          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            {tt('theme.footer.copyright', { year: new Date().getFullYear() })}
          </p>
        </div>
      </div>
    </footer>
  );
}
