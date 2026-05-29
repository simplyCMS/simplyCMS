import React from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Sun, User, Search } from "lucide-react";
import { useAuth } from "@simplycms/core/hooks/useAuth";
import { useSupabaseClient } from "@simplycms/core/supabase/SupabaseProvider";
import { useToast } from "@simplycms/core/hooks/use-toast";

interface CatalogLayoutProps {
  /** Render a theme toggle button */
  renderThemeToggle?: () => React.ReactNode;
  /** Render the cart button */
  renderCartButton?: () => React.ReactNode;
  /** Render the cart drawer */
  renderCartDrawer?: () => React.ReactNode;
  /** Render a Button component */
  renderButton?: (props: Record<string, unknown>) => React.ReactNode;
  /** Render a DropdownMenu */
  renderDropdownMenu?: (props: Record<string, unknown>) => React.ReactNode;
  /** Children to render in the main content area (replaces Outlet) */
  children?: React.ReactNode;
}

export function CatalogLayout({
  renderThemeToggle,
  renderCartButton,
  renderCartDrawer,
  renderButton: _renderButton,
  renderDropdownMenu,
  children,
}: CatalogLayoutProps) {
  const supabase = useSupabaseClient();
  const { user, isLoading, isAdmin } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({
        variant: "destructive",
        title: "Помилка",
        description: "Не вдалося вийти з акаунту",
      });
    } else {
      toast({
        title: "Вихiд виконано",
        description: "До зустрiчi!",
      });
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 flex h-16 items-center justify-between">
          <div className="flex items-center gap-6">
            <Link to="/" className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg gradient-brand">
                <Sun className="h-6 w-6 text-white" />
              </div>
              <span className="text-xl font-bold text-foreground">SolarStore</span>
            </Link>

            <nav className="hidden md:flex items-center gap-6">
              <Link
                to="/catalog"
                className="text-sm font-medium text-foreground hover:text-primary transition-colors"
              >
                Каталог
              </Link>
              <Link
                to="/properties"
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Бренди
              </Link>
              <Link
                to="."
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Послуги
              </Link>
              <Link
                to="."
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Про нас
              </Link>
              <Link
                to="."
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Контакти
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-2">
            <button className="hidden sm:flex p-2 rounded-md hover:bg-accent">
              <Search className="h-5 w-5" />
            </button>
            {renderThemeToggle?.()}
            {!isLoading && (
              <>
                {user ? (
                  renderDropdownMenu ? (
                    renderDropdownMenu({ user, isAdmin, handleSignOut, navigate })
                  ) : (
                    <button
                      onClick={() => navigate({ to: "/profile" })}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-md border text-sm"
                    >
                      <User className="h-4 w-4" />
                      <span className="hidden sm:inline">{user.email?.split("@")[0]}</span>
                    </button>
                  )
                ) : (
                  <Link to="/auth" className="px-3 py-1.5 rounded-md border text-sm">
                    Увiйти
                  </Link>
                )}
              </>
            )}
            {renderCartButton?.()}
          </div>
        </div>
      </header>

      {renderCartDrawer?.()}
      {/* Content */}
      <main className="flex-1">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t py-8 bg-card">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <Link to="/" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg gradient-brand">
                <Sun className="h-4 w-4 text-white" />
              </div>
              <span className="font-semibold text-foreground">SolarStore</span>
            </Link>
            <p className="text-sm text-muted-foreground">
              &copy; 2024 SolarStore. Всi права захищено.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
