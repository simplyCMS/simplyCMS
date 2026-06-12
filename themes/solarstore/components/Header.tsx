import { useState } from "react";
import { Link, useNavigate } from '@tanstack/react-router';
import {
  Sun,
  Battery,
  Zap,
  Wrench,
  User,
  Settings,
  LogOut,
  ShoppingCart,
  Menu,
  X,
} from "lucide-react";
import { Button } from "@simplysoftua/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@simplysoftua/ui/dropdown-menu";
import { useAuth } from "@simplysoftua/core/hooks/useAuth";
import { useCart } from "@simplysoftua/core/hooks/useCart";
import { useToast } from "@simplysoftua/core/hooks/use-toast";
import { useSupabaseClient } from "@simplysoftua/core/supabase/SupabaseProvider";
import { CartDrawer } from "@simplysoftua/core/components/cart/CartDrawer";
import { useQuery } from "@tanstack/react-query";

/** Категорії з іконками для навігації */
const categoryIcons = [
  { icon: Battery, label: "Акумулятори" },
  { icon: Zap, label: "Інвертори" },
  { icon: Sun, label: "Сонячні панелі" },
  { icon: Wrench, label: "Послуги монтажу" },
];

export function Header() {
  const supabase = useSupabaseClient();
  const { user, isLoading: authLoading, isAdmin } = useAuth();
  const { totalItems, setIsOpen } = useCart();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  /** Отримати секції каталогу */
  const { data: sections } = useQuery({
    queryKey: ["sections-nav"],
    queryFn: async () => {
      const { data } = await supabase
        .from("sections")
        .select("id, name, slug, parent_id")
        .eq("is_active", true)
        .is("parent_id", null)
        .order("sort_order");
      return data || [];
    },
  });

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({
        variant: "destructive",
        title: "Помилка",
        description: "Не вдалося вийти з акаунту",
      });
    } else {
      toast({ title: "Вихід виконано", description: "До зустрічі!" });
    }
  };

  /** Отримати іконку для секції за індексом */
  const getSectionIcon = (index: number) => {
    if (index < categoryIcons.length) {
      return categoryIcons[index].icon;
    }
    return Sun;
  };

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b bg-[hsl(var(--background))]/95 backdrop-blur supports-[backdrop-filter]:bg-[hsl(var(--background))]/60">
        {/* Верхній рядок: логотип + навігація + дії */}
        <div className="container mx-auto px-4 flex h-16 items-center justify-between">
          {/* Логотип */}
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[hsl(var(--primary))]">
              <Sun className="h-6 w-6 text-white" />
            </div>
            <span className="text-xl font-bold text-[hsl(var(--foreground))]">
              SolarStore
            </span>
          </Link>

          {/* Десктопна навігація */}
          <nav className="hidden md:flex items-center gap-6">
            <Link
              to="/catalog"
              className="text-sm font-medium text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
            >
              Каталог
            </Link>
            {sections?.map((s) => (
              <Link
                key={s.id}
                to="/catalog/$sectionSlug"
                params={{ sectionSlug: s.slug }}
                className="text-sm font-medium text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
              >
                {s.name}
              </Link>
            ))}
            <a
              href="#"
              className="text-sm font-medium text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
            >
              Про нас
            </a>
            <a
              href="#"
              className="text-sm font-medium text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
            >
              Контакти
            </a>
          </nav>

          {/* Дії */}
          <div className="flex items-center gap-2">
            {/* Авторизація */}
            {!authLoading && (
              <>
                {user ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="gap-2">
                        <User className="h-4 w-4" />
                        <span className="hidden sm:inline">
                          {user.email?.split("@")[0]}
                        </span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem className="text-muted-foreground text-sm">
                        {user.email}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => navigate({ to: '/profile' })}>
                        <User className="mr-2 h-4 w-4" />
                        Мій кабінет
                      </DropdownMenuItem>
                      {isAdmin && (
                        <DropdownMenuItem
                          onClick={() => navigate({ to: '/admin' })}
                        >
                          <Settings className="mr-2 h-4 w-4" />
                          Адмін-панель
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={handleSignOut}
                        className="text-destructive"
                      >
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

            {/* Кошик */}
            <Button
              variant="ghost"
              size="icon"
              className="relative text-[hsl(var(--foreground))]"
              onClick={() => setIsOpen(true)}
            >
              <ShoppingCart className="h-5 w-5" />
              {totalItems > 0 && (
                <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] text-[10px] font-bold flex items-center justify-center">
                  {totalItems}
                </span>
              )}
            </Button>

            {/* Мобільне меню */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </Button>
          </div>
        </div>

        {/* Панель категорій з іконками — десктоп */}
        <div className="hidden md:block border-t border-[hsl(var(--border))]/40 bg-[hsl(var(--muted))]/30">
          <div className="container mx-auto px-4 flex items-center justify-center gap-8 h-12">
            {sections?.slice(0, 4).map((s, idx) => {
              const Icon = getSectionIcon(idx);
              return (
                <Link
                  key={s.id}
                  to="/catalog/$sectionSlug"
                params={{ sectionSlug: s.slug }}
                  className="flex items-center gap-2 text-sm font-medium text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--primary))] transition-colors"
                >
                  <Icon className="h-4 w-4" />
                  {s.name}
                </Link>
              );
            })}
          </div>
        </div>

        {/* Мобільне меню */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-[hsl(var(--border))]/30 bg-[hsl(var(--background))]">
            <div className="container mx-auto px-4 py-4 space-y-2">
              <Link
                to="/catalog"
                className="block py-2 text-sm font-medium text-[hsl(var(--foreground))]"
                onClick={() => setMobileMenuOpen(false)}
              >
                Каталог
              </Link>
              {sections?.map((s, idx) => {
                const Icon = getSectionIcon(idx);
                return (
                  <Link
                    key={s.id}
                    to="/catalog/$sectionSlug"
                params={{ sectionSlug: s.slug }}
                    className="flex items-center gap-2 py-2 text-sm text-[hsl(var(--muted-foreground))]"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <Icon className="h-4 w-4" />
                    {s.name}
                  </Link>
                );
              })}
              <a
                href="#"
                className="block py-2 text-sm text-[hsl(var(--muted-foreground))]"
              >
                Про нас
              </a>
              <a
                href="#"
                className="block py-2 text-sm text-[hsl(var(--muted-foreground))]"
              >
                Контакти
              </a>
            </div>
          </div>
        )}
      </header>

      <CartDrawer />
    </>
  );
}
