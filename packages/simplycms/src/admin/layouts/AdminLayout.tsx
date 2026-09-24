import { useLocation, useNavigate } from '@tanstack/react-router';
import {
  SidebarProvider,
  SidebarTrigger,
  SidebarInset,
} from 'simplycms/ui/sidebar';
import { AdminSidebar } from './AdminSidebar';
import { LegacySupabaseBoundary } from './LegacySupabaseBoundary';
import { Button } from 'simplycms/ui/button';
import { LogOut, Home } from 'lucide-react';
import { useAuth } from 'simplycms/core/hooks/useAuth';
import { useToast } from 'simplycms/core/hooks/use-toast';
import { ThemeToggle } from 'simplycms/core/components/ThemeToggle';
import { useT } from 'simplycms/i18n';

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const t = useT();
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  // `key={pathname}`: ремаунтить межу на кожну client-side навігацію, інакше
  // стан заглушки (LegacySupabaseBoundary) пережив би перехід на живу
  // сторінку — React не скидає стан error boundary сам (К3-Е3 Step 0).
  const pathname = useLocation({ select: (l) => l.pathname });

  const handleSignOut = async () => {
    await signOut();
    toast({
      title: t('admin.common.signedOut'),
      description: t('admin.common.signedOutHint'),
    });
    navigate({ to: '/' });
  };

  return (
    <SidebarProvider>
      <AdminSidebar />
      <SidebarInset>
        {/* Header */}
        <header className="h-14 border-b flex items-center justify-between px-4 bg-background">
          <div className="flex items-center gap-2">
            <SidebarTrigger />
            <span className="text-sm text-muted-foreground hidden sm:inline">
              {t('admin.common.title')}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate({ to: '/' })}
            >
              <Home className="h-4 w-4 mr-2" />
              {t('admin.common.toSite')}
            </Button>
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              <LogOut className="h-4 w-4 mr-2" />
              {t('nav.signOut')}
            </Button>
          </div>
        </header>

        {/* Main content */}
        <div className="flex-1 p-6 bg-muted/30">
          <LegacySupabaseBoundary key={pathname}>
            {children}
          </LegacySupabaseBoundary>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
