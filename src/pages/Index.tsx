import { Battery, Zap, Sun, Wrench, ChevronRight, LogOut, User, Settings } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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

const categories = [
  {
    icon: Battery,
    title: "Акумулятори",
    description: "Літієві, гелеві та AGM акумулятори",
    color: "from-blue-500 to-blue-600",
  },
  {
    icon: Zap,
    title: "Інвертори",
    description: "Мережеві та автономні інвертори",
    color: "from-amber-500 to-orange-500",
  },
  {
    icon: Sun,
    title: "Сонячні панелі",
    description: "Моно та полікристалічні панелі",
    color: "from-green-500 to-emerald-500",
  },
  {
    icon: Wrench,
    title: "Послуги монтажу",
    description: "Професійна установка обладнання",
    color: "from-purple-500 to-violet-500",
  },
];

const advantages = [
  { value: "5+", label: "років досвіду" },
  { value: "1000+", label: "встановлених систем" },
  { value: "24/7", label: "підтримка клієнтів" },
  { value: "3", label: "роки гарантії" },
];

export default function Index() {
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
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container-fluid flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg gradient-brand">
              <Sun className="h-6 w-6 text-white" />
            </div>
            <span className="text-xl font-bold text-foreground">SolarStore</span>
          </div>
          
          <nav className="hidden md:flex items-center gap-6">
            <Link to="/catalog" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Каталог
            </Link>
            <a href="#" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Послуги
            </a>
            <a href="#" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Про нас
            </a>
            <a href="#" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Контакти
            </a>
          </nav>

          <div className="flex items-center gap-2">
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

      {/* Hero Section */}
      <section className="relative overflow-hidden py-20 md:py-32">
        <div className="absolute inset-0 gradient-brand-subtle" />
        <div className="container-fluid relative">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl md:text-6xl">
              Енергетична{" "}
              <span className="text-gradient-brand">незалежність</span>{" "}
              для вашого дому
            </h1>
            <p className="mt-6 text-lg text-muted-foreground md:text-xl">
              Професійні рішення з альтернативної енергетики: акумулятори, інвертори, 
              сонячні панелі та послуги монтажу під ключ
            </p>
            <div className="mt-10 flex flex-wrap justify-center gap-4">
              <Button size="lg" className="gradient-brand text-white border-0 h-12 px-8" asChild>
                <Link to="/catalog">
                  Переглянути каталог
                  <ChevronRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="h-12 px-8">
                Замовити консультацію
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="py-16 md:py-24">
        <div className="container-fluid">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground">Категорії товарів</h2>
            <p className="mt-3 text-muted-foreground">
              Оберіть потрібне обладнання для вашої енергосистеми
            </p>
          </div>
          
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {categories.map((category) => (
              <Card 
                key={category.title}
                className="group cursor-pointer hover-shadow transition-all duration-300 hover:-translate-y-1"
              >
                <CardContent className="p-6">
                  <div className={`inline-flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br ${category.color} mb-4`}>
                    <category.icon className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors">
                    {category.title}
                  </h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {category.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Advantages */}
      <section className="py-16 md:py-24 bg-muted/50">
        <div className="container-fluid">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground">Чому обирають нас</h2>
          </div>
          
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {advantages.map((item) => (
              <div key={item.label} className="text-center">
                <div className="text-4xl font-bold text-gradient-brand">{item.value}</div>
                <div className="mt-2 text-muted-foreground">{item.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 md:py-24">
        <div className="container-fluid">
          <Card className="overflow-hidden">
            <div className="relative p-8 md:p-12 gradient-brand">
              <div className="relative z-10 max-w-2xl">
                <h2 className="text-2xl md:text-3xl font-bold text-white">
                  Потрібна консультація?
                </h2>
                <p className="mt-4 text-white/90">
                  Наші експерти допоможуть підібрати оптимальне рішення для вашого об'єкту
                </p>
                <Button 
                  size="lg" 
                  variant="secondary"
                  className="mt-6"
                >
                  Замовити дзвінок
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-12 bg-card">
        <div className="container-fluid">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg gradient-brand">
                <Sun className="h-4 w-4 text-white" />
              </div>
              <span className="font-semibold text-foreground">SolarStore</span>
            </div>
            <p className="text-sm text-muted-foreground">
              © 2024 SolarStore. Всі права захищено.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
