import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { User, Mail, Phone, Package, ChevronRight, Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

interface ProfileData {
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  category: {
    name: string;
  } | null;
}

interface RecentOrder {
  id: string;
  order_number: string;
  total: number;
  created_at: string;
  status: {
    name: string;
    color: string | null;
  } | null;
}

export default function Profile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      if (!user) return;

      try {
        // Load profile
        const { data: profileData } = await supabase
          .from("profiles")
          .select("first_name, last_name, email, phone, category:user_categories(name)")
          .eq("user_id", user.id)
          .maybeSingle();

        setProfile(profileData);

        // Load recent orders
        const { data: ordersData } = await supabase
          .from("orders")
          .select("id, order_number, total, created_at, status:order_statuses(name, color)")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(3);

        setRecentOrders(ordersData || []);
      } catch (error) {
        console.error("Error loading profile data:", error);
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [user]);

  const formatPrice = (value: number) => {
    return new Intl.NumberFormat("uk-UA", {
      style: "currency",
      currency: "UAH",
      minimumFractionDigits: 0,
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return new Intl.DateTimeFormat("uk-UA", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(new Date(dateString));
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Мій профіль</h1>

      {/* Profile info card */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <User className="h-5 w-5" />
            Особисті дані
          </CardTitle>
          <Button variant="outline" size="sm" asChild>
            <Link to="/profile/settings">Редагувати</Link>
          </Button>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="flex items-center gap-3">
              <User className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Ім'я</p>
                <p className="font-medium">
                  {profile?.first_name && profile?.last_name
                    ? `${profile.first_name} ${profile.last_name}`
                    : "Не вказано"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Mail className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="font-medium">{profile?.email || user?.email || "Не вказано"}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Phone className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Телефон</p>
                <p className="font-medium">{profile?.phone || "Не вказано"}</p>
              </div>
            </div>

            {profile?.category && (
              <div className="flex items-center gap-3">
                <Package className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Категорія</p>
                  <Badge variant="secondary">{profile.category.name}</Badge>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Recent orders card */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Package className="h-5 w-5" />
            Останні замовлення
          </CardTitle>
          <Button variant="outline" size="sm" asChild>
            <Link to="/profile/orders">Всі замовлення</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {recentOrders.length === 0 ? (
            <div className="text-center py-8">
              <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">У вас ще немає замовлень</p>
              <Button className="mt-4" asChild>
                <Link to="/catalog">Перейти до каталогу</Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {recentOrders.map((order) => (
                <Link
                  key={order.id}
                  to={`/profile/orders/${order.id}`}
                  className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div>
                      <p className="font-medium">{order.order_number}</p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        {formatDate(order.created_at)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="font-semibold">{formatPrice(order.total)}</p>
                      {order.status && (
                        <Badge
                          variant="outline"
                          style={{
                            borderColor: order.status.color || undefined,
                            color: order.status.color || undefined,
                          }}
                        >
                          {order.status.name}
                        </Badge>
                      )}
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
