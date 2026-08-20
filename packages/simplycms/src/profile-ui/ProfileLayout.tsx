import { Link, useLocation } from '@tanstack/react-router';
import { User, Package, Settings, LogOut } from 'lucide-react';
import { cn } from 'simplycms/ui/utils';
import { useAuth } from '@simplycms/core/hooks/useAuth';
import { useT, type MessageKey } from 'simplycms/i18n';

const navItems: {
  to: string;
  icon: typeof User;
  labelKey: MessageKey;
  end?: boolean;
}[] = [
  { to: '/profile', icon: User, labelKey: 'nav.profile', end: true },
  { to: '/profile/orders', icon: Package, labelKey: 'nav.orders' },
  { to: '/profile/settings', icon: Settings, labelKey: 'nav.settings' },
];

interface ProfileLayoutProps {
  children?: React.ReactNode;
}

export function ProfileLayout({ children }: ProfileLayoutProps) {
  const t = useT();
  const { user, isLoading, signOut } = useAuth();
  const { pathname } = useLocation();

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex gap-8">
          <div className="w-64 space-y-2">
            <div className="animate-pulse h-10 w-full bg-muted rounded" />
            <div className="animate-pulse h-10 w-full bg-muted rounded" />
            <div className="animate-pulse h-10 w-full bg-muted rounded" />
          </div>
          <div className="flex-1">
            <div className="animate-pulse h-64 w-full bg-muted rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    // TODO: Auth guard moves to beforeLoad in route definition
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row gap-8">
        {/* Sidebar */}
        <aside className="w-full md:w-64 shrink-0">
          <nav className="space-y-1">
            {navItems.map((item) => {
              const isActive = item.end
                ? pathname === item.to
                : pathname.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors',
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

            <button
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-destructive hover:text-destructive hover:bg-destructive/10 transition-colors"
              onClick={signOut}
            >
              <LogOut className="h-5 w-5" />
              {t('nav.signOut')}
            </button>
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}
