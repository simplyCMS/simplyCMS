import type { ReactNode } from 'react';
import { Link, useLocation } from '@tanstack/react-router';
import { User, Package, Settings, LogOut, type LucideIcon } from 'lucide-react';
import { cn } from '@simplycms/core/lib/utils';
import { useAuth } from '@simplycms/core/hooks/useAuth';
import { Button } from '@simplycms/ui/button';
import { useT, type MessageKey } from 'simplycms/i18n';
import { useActiveThemeModule } from './useActiveThemeModule';
import { ThemeTokens } from './ThemeTokens';
import { ThemeFonts } from './ThemeFonts';

type NavItem = {
  href: string;
  icon: LucideIcon;
  labelKey: MessageKey;
  exact?: boolean;
};

const navItems: NavItem[] = [
  { href: '/profile', icon: User, labelKey: 'nav.profile', exact: true },
  { href: '/profile/orders', icon: Package, labelKey: 'nav.orders' },
  { href: '/profile/settings', icon: Settings, labelKey: 'nav.settings' },
];

/**
 * Канонічний каркас профілю — заміна `theme.ProfileLayout`.
 *
 * Header/Footer беруться з теми, бічна навігація і вихід — з ядра:
 * структура профілю однакова для всіх тем.
 */
export function ProtectedShell({ children }: { children?: ReactNode }) {
  const theme = useActiveThemeModule();
  const { Header, Footer } = theme.components;
  const { signOut } = useAuth();
  const pathname = useLocation({ select: (l) => l.pathname });
  const t = useT();

  return (
    <div className="min-h-screen bg-[hsl(var(--background))] flex flex-col">
      <ThemeTokens tokens={theme.tokens} />
      <ThemeFonts fonts={theme.fonts} />
      <Header />
      <div className="container mx-auto px-4 py-8 flex-1">
        <div className="flex flex-col md:flex-row gap-8">
          <aside className="w-full md:w-64 shrink-0">
            <nav className="space-y-1">
              {navItems.map((item) => {
                const isActive = item.exact
                  ? pathname === item.href
                  : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    className={cn(
                      'flex items-center gap-3 px-4 py-3 rounded-md text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                    )}
                  >
                    <item.icon className="h-5 w-5" />
                    {t(item.labelKey)}
                  </Link>
                );
              })}
              <Button
                variant="ghost"
                className="w-full justify-start gap-3 px-4 py-3 h-auto text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={signOut}
              >
                <LogOut className="h-5 w-5" />
                {t('nav.signOut')}
              </Button>
            </nav>
          </aside>
          <main className="flex-1 min-w-0">{children}</main>
        </div>
      </div>
      <Footer />
    </div>
  );
}
