import { Link, useNavigate, Outlet } from "react-router-dom";
import { Sun, User, Settings, LogOut, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { CartButton } from "@/components/cart/CartButton";
import { CartDrawer } from "@/components/cart/CartDrawer";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function CatalogLayout() {
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
        title: "Вихід виконано",
        description: "До зустрічі!",
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
                to="#" 
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Послуги
              </Link>
              <Link 
                to="#" 
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Про нас
              </Link>
              <Link 
                to="#" 
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Контакти
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="hidden sm:flex">
              <Search className="h-5 w-5" />
            </Button>
            <ThemeToggle />
            {!isLoading && (
              <>
                {user ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="gap-2">
                        <User className="h-4 w-4" />
                        <span className="hidden sm:inline">{user.email?.split("@")[0]}</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem className="text-muted-foreground text-sm">
                        {user.email}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => navigate("/profile")}>
                        <User className="mr-2 h-4 w-4" />
                        Мій кабінет
                      </DropdownMenuItem>
                      {isAdmin && (
                        <DropdownMenuItem onClick={() => navigate("/admin")}>
                          <Settings className="mr-2 h-4 w-4" />
                          Адмін-панель
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
                        <LogOut className="mr-2 h-4 w-4" />
                        Вийти
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : (
                  <Button variant="outline" size="sm" asChild>
                    <Link to="/auth">Увійти</Link>
                  </Button>
                )}
              </>
            )}
            <CartButton />
          </div>
        </div>
      </header>

      <CartDrawer />
      {/* Content */}
      <main className="flex-1">
        <Outlet />
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
              © 2024 SolarStore. Всі права захищено.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
