import { NavLink, Outlet, Navigate } from "react-router-dom";
import { User, Package, Settings, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

const navItems = [
  { to: "/profile", icon: User, label: "Профіль", end: true },
  { to: "/profile/orders", icon: Package, label: "Мої замовлення" },
  { to: "/profile/settings", icon: Settings, label: "Налаштування" },
];

export function ProfileLayout() {
  const { user, isLoading, signOut } = useAuth();

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex gap-8">
          <div className="w-64 space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
          <div className="flex-1">
            <Skeleton className="h-64 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row gap-8">
        {/* Sidebar */}
        <aside className="w-full md:w-64 shrink-0">
          <nav className="space-y-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )
                }
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </NavLink>
            ))}
            
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 px-4 py-3 h-auto text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={signOut}
            >
              <LogOut className="h-5 w-5" />
              Вийти
            </Button>
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
