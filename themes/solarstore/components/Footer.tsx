import { Link } from '@tanstack/react-router';
import { Sun, Phone, Mail, MapPin } from 'lucide-react';

export function Footer() {
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
              Професійні рішення з альтернативної енергетики для вашого дому та
              бізнесу.
            </p>
          </div>

          {/* Каталог */}
          <div>
            <h4 className="text-sm font-semibold text-[hsl(var(--foreground))] mb-4 uppercase tracking-wider">
              Каталог
            </h4>
            <nav className="space-y-2">
              <Link
                to="/catalog"
                className="block text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
              >
                Усі товари
              </Link>
              <Link
                to="/properties"
                className="block text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
              >
                Бренди
              </Link>
            </nav>
          </div>

          {/* Інформація */}
          <div>
            <h4 className="text-sm font-semibold text-[hsl(var(--foreground))] mb-4 uppercase tracking-wider">
              Інформація
            </h4>
            <nav className="space-y-2">
              <span className="block text-sm text-[hsl(var(--muted-foreground))]">
                Доставка і оплата
              </span>
              <span className="block text-sm text-[hsl(var(--muted-foreground))]">
                Гарантія
              </span>
              <span className="block text-sm text-[hsl(var(--muted-foreground))]">
                Повернення
              </span>
            </nav>
          </div>

          {/* Контакти */}
          <div>
            <h4 className="text-sm font-semibold text-[hsl(var(--foreground))] mb-4 uppercase tracking-wider">
              Контакти
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
                <span>Україна</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-[hsl(var(--border))]/40">
        <div className="container mx-auto px-4 py-4 text-center">
          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            &copy; {new Date().getFullYear()} SolarStore. Всі права захищено.
          </p>
        </div>
      </div>
    </footer>
  );
}
