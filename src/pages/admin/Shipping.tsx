import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Truck, MapPin, Map, Building, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";

export default function Shipping() {
  const { data: methods, isLoading: methodsLoading } = useQuery({
    queryKey: ["shipping-methods"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shipping_methods")
        .select("*")
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const { data: zones, isLoading: zonesLoading } = useQuery({
    queryKey: ["shipping-zones"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shipping_zones")
        .select("*")
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const { data: pickupPoints, isLoading: pointsLoading } = useQuery({
    queryKey: ["pickup-points"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pickup_points")
        .select("*")
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const activeMethods = methods?.filter((m) => m.is_active).length || 0;
  const activeZones = zones?.filter((z) => z.is_active).length || 0;
  const activePoints = pickupPoints?.filter((p) => p.is_active).length || 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Доставка</h1>
        <p className="text-muted-foreground mt-1">
          Управління службами доставки, зонами та точками самовивозу
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Служби доставки
            </CardTitle>
            <Truck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {methodsLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-2xl font-bold">{activeMethods}</div>
                <p className="text-xs text-muted-foreground">
                  активних з {methods?.length || 0}
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Зони доставки</CardTitle>
            <Map className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {zonesLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-2xl font-bold">{activeZones}</div>
                <p className="text-xs text-muted-foreground">
                  активних з {zones?.length || 0}
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Точки самовивозу
            </CardTitle>
            <Building className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {pointsLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-2xl font-bold">{activePoints}</div>
                <p className="text-xs text-muted-foreground">
                  активних з {pickupPoints?.length || 0}
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Links */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Link to="/admin/shipping/methods">
          <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Truck className="h-5 w-5" />
                Служби доставки
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Налаштуйте способи доставки: самовивіз, кур'єр, плагіни
                перевізників
              </p>
              <Button variant="ghost" size="sm" className="gap-1">
                Перейти <ArrowRight className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        </Link>

        <Link to="/admin/shipping/zones">
          <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Map className="h-5 w-5" />
                Зони доставки
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Створіть географічні зони з різними тарифами доставки
              </p>
              <Button variant="ghost" size="sm" className="gap-1">
                Перейти <ArrowRight className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        </Link>

        <Link to="/admin/shipping/pickup-points">
          <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Building className="h-5 w-5" />
                Точки самовивозу
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Додайте адреси магазинів та пунктів видачі замовлень
              </p>
              <Button variant="ghost" size="sm" className="gap-1">
                Перейти <ArrowRight className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        </Link>

        <Link to="/admin/shipping/locations">
          <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Локації
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Довідник країн, областей та міст для зон доставки
              </p>
              <Button variant="ghost" size="sm" className="gap-1">
                Перейти <ArrowRight className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
