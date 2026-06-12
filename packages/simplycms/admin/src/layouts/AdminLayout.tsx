import { useNavigate } from '@tanstack/react-router';
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@simplysoftua/ui/sidebar";
import { AdminSidebar } from "./AdminSidebar";
import { Button } from "@simplysoftua/ui/button";
import { LogOut, Home } from "lucide-react";
import { useSupabaseClient } from "@simplysoftua/core/supabase/SupabaseProvider";
import { useToast } from "@simplysoftua/core/hooks/use-toast";
import { ThemeToggle } from "@simplysoftua/core/components/ThemeToggle";

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = useSupabaseClient();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast({
      title: "Вихід виконано",
      description: "Ви успішно вийшли з системи",
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
              Адмін-панель
            </span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button variant="ghost" size="sm" onClick={() => navigate({ to: '/' })}>
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
        <div className="flex-1 p-6 bg-muted/30">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
