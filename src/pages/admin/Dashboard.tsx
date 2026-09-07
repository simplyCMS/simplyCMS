import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Package, FolderTree, ShoppingCart, Users, Wrench, FileText } from "lucide-react";
import { PluginSlot } from "@/components/plugins/PluginSlot";

export default function Dashboard() {
  const { data: stats } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const [products, sections, orders, profiles, services, serviceRequests] = await Promise.all([
        supabase.from("products").select("id", { count: "exact", head: true }),
        supabase.from("sections").select("id", { count: "exact", head: true }),
        supabase.from("orders").select("id", { count: "exact", head: true }),
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("services").select("id", { count: "exact", head: true }),
        supabase.from("service_requests").select("id", { count: "exact", head: true }).eq("status", "new"),
      ]);

      return {
        products: products.count || 0,
        sections: sections.count || 0,
        orders: orders.count || 0,
        users: profiles.count || 0,
        services: services.count || 0,
        newRequests: serviceRequests.count || 0,
      };
    },
  });

  const statCards = [
    { title: "Товари", value: stats?.products || 0, icon: Package, color: "text-blue-500" },
    { title: "Розділи", value: stats?.sections || 0, icon: FolderTree, color: "text-green-500" },
    { title: "Замовлення", value: stats?.orders || 0, icon: ShoppingCart, color: "text-orange-500" },
    { title: "Користувачі", value: stats?.users || 0, icon: Users, color: "text-purple-500" },
    { title: "Послуги", value: stats?.services || 0, icon: Wrench, color: "text-cyan-500" },
    { title: "Нові заявки", value: stats?.newRequests || 0, icon: FileText, color: "text-red-500" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Дашборд</h1>
        <p className="text-muted-foreground">Огляд основних показників системи</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {statCards.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <stat.icon className={`h-5 w-5 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
        
        {/* Plugin slot: additional stat cards from plugins */}
        <PluginSlot 
          name="admin.dashboard.stats" 
          context={{ stats }}
          wrapper={(children) => <>{children}</>}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Швидкі дії</CardTitle>
            <CardDescription>Часто використовувані функції</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <a href="/admin/products" className="block p-3 rounded-lg hover:bg-muted transition-colors">
              <div className="flex items-center gap-3">
                <Package className="h-5 w-5 text-muted-foreground" />
                <div>
                  <div className="font-medium">Додати товар</div>
                  <div className="text-sm text-muted-foreground">Створити новий товар в каталозі</div>
                </div>
              </div>
            </a>
            <a href="/admin/sections" className="block p-3 rounded-lg hover:bg-muted transition-colors">
              <div className="flex items-center gap-3">
                <FolderTree className="h-5 w-5 text-muted-foreground" />
                <div>
                  <div className="font-medium">Керувати розділами</div>
                  <div className="text-sm text-muted-foreground">Редагувати структуру каталогу</div>
                </div>
              </div>
            </a>
            <a href="/admin/orders" className="block p-3 rounded-lg hover:bg-muted transition-colors">
              <div className="flex items-center gap-3">
                <ShoppingCart className="h-5 w-5 text-muted-foreground" />
                <div>
                  <div className="font-medium">Переглянути замовлення</div>
                  <div className="text-sm text-muted-foreground">Обробка нових замовлень</div>
                </div>
              </div>
            </a>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Інформація</CardTitle>
            <CardDescription>Про систему управління</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 text-sm">
              <p>
                Ласкаво просимо до адмін-панелі SolarStore CMS. Тут ви можете керувати
                каталогом товарів, обробляти замовлення та налаштовувати систему.
              </p>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Версія CMS:</span>
                  <span className="font-medium">1.0.0</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Статус:</span>
                  <span className="text-green-500 font-medium">Активний</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Plugin slot: dashboard widgets from plugins */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <PluginSlot 
          name="admin.dashboard.widgets" 
          context={{ stats }}
          wrapper={(children) => <>{children}</>}
        />
      </div>
    </div>
  );
}
