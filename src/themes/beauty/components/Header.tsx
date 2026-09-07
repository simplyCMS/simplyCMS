import { Link, useNavigate } from "react-router-dom";
import { Search, User, ShoppingBag, Menu, X, Settings, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/hooks/useCart";
import { useThemeSettings } from "@/lib/themes";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { AnnouncementBar } from "./AnnouncementBar";
import { CartDrawer } from "@/components/cart/CartDrawer";
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function Header() {
  const { user, isLoading: authLoading, isAdmin } = useAuth();
  const { totalItems, setIsOpen } = useCart();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const logoUrl = useThemeSettings<string>("logoUrl");
  const storeName = useThemeSettings<string>("storeName") || "Beauty Store";

  const { data: sections } = useQuery({
    queryKey: ["beauty-sections-nav"],
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
    await supabase.auth.signOut();
    toast({ title: "Вихід виконано" });
  };

  return (
    <>
      <header className="sticky top-0 z-50 w-full bg-[hsl(var(--background))] border-b border-border/40">
        <AnnouncementBar />

        {/* Middle row: logo + icons */}
        <div className="container mx-auto px-4 flex items-center justify-between h-16">
          {/* Mobile menu toggle */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>

          {/* Logo */}
          <Link to="/" className="flex items-center gap-2">
            {logoUrl ? (
              <img src={logoUrl} alt={storeName} className="h-10 max-w-[160px] object-contain" />
            ) : (
              <span className="text-xl font-serif font-bold tracking-wide text-foreground">
                {storeName}
              </span>
            )}
          </Link>

          {/* Icons */}
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="text-foreground">
              <Search className="h-5 w-5" />
            </Button>

            {!authLoading && (
              user ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="text-foreground">
                      <User className="h-5 w-5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem className="text-muted-foreground text-xs">
                      {user.email}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => navigate("/profile")}>
                      <User className="mr-2 h-4 w-4" /> Мій кабінет
                    </DropdownMenuItem>
                    {isAdmin && (
                      <DropdownMenuItem onClick={() => navigate("/admin")}>
                        <Settings className="mr-2 h-4 w-4" /> Адмін-панель
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
                      <LogOut className="mr-2 h-4 w-4" /> Вийти
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Button variant="ghost" size="icon" className="text-foreground" asChild>
                  <Link to="/auth"><User className="h-5 w-5" /></Link>
                </Button>
              )
            )}

            <Button
              variant="ghost"
              size="icon"
              className="relative text-foreground"
              onClick={() => setIsOpen(true)}
            >
              <ShoppingBag className="h-5 w-5" />
              {totalItems > 0 && (
                <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
                  {totalItems}
                </span>
              )}
            </Button>
          </div>
        </div>

        {/* Category nav — desktop */}
        <nav className="hidden md:block border-t border-border/30">
          <div className="container mx-auto px-4 flex items-center justify-center gap-8 h-11">
            <Link
              to="/catalog"
              className="text-sm font-medium text-foreground hover:text-primary transition-colors uppercase tracking-wider"
            >
              Каталог
            </Link>
            {sections?.map((s) => (
              <Link
                key={s.id}
                to={`/catalog/${s.slug}`}
                className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors uppercase tracking-wider"
              >
                {s.name}
              </Link>
            ))}
          </div>
        </nav>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-border/30 bg-[hsl(var(--background))]">
            <div className="container mx-auto px-4 py-4 space-y-2">
              <Link
                to="/catalog"
                className="block py-2 text-sm font-medium text-foreground"
                onClick={() => setMobileMenuOpen(false)}
              >
                Каталог
              </Link>
              {sections?.map((s) => (
                <Link
                  key={s.id}
                  to={`/catalog/${s.slug}`}
                  className="block py-2 text-sm text-muted-foreground"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {s.name}
                </Link>
              ))}
            </div>
          </div>
        )}
      </header>

      <CartDrawer />
    </>
  );
}
