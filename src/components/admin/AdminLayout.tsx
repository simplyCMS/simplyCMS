import { Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useEffect } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AdminSidebar } from "./AdminSidebar";
import { Button } from "@/components/ui/button";
import { LogOut, Home, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ThemeToggle } from "@/components/ThemeToggle";

export function AdminLayout() {
  const { user, isLoading, isAdmin } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (!isLoading && (!user || !isAdmin)) {
      navigate("/auth");
    }
  }, [user, isLoading, isAdmin, navigate]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast({
      title: "Вихід виконано",
      description: "Ви успішно вийшли з системи",
    });
    navigate("/");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || !isAdmin) {
    return null;
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AdminSidebar />
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <header className="h-14 border-b flex items-center justify-between px-4 bg-background">
            <div className="flex items-center gap-2">
              <SidebarTrigger />
              <span className="text-sm text-muted-foreground hidden sm:inline">
                Адмін-панель
              </span>
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
                <Home className="h-4 w-4 mr-2" />
                На сайт
              </Button>
              <Button variant="ghost" size="sm" onClick={handleSignOut}>
                <LogOut className="h-4 w-4 mr-2" />
                Вийти
              </Button>
            </div>
          </header>
          
          {/* Main content */}
          <main className="flex-1 p-6 bg-muted/30">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
