import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Package, Calendar, ChevronRight, Filter } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

interface Order {
  id: string;
  order_number: string;
  total: number;
  created_at: string;
  status_id: string | null;
  status: {
    id: string;
    name: string;
    color: string | null;
  } | null;
  items: {
    id: string;
    name: string;
    quantity: number;
  }[];
}

interface OrderStatus {
  id: string;
  name: string;
  color: string | null;
}

export default function ProfileOrders() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [statuses, setStatuses] = useState<OrderStatus[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadStatuses() {
      const { data } = await supabase
        .from("order_statuses")
        .select("id, name, color")
        .order("sort_order");
      setStatuses(data || []);
    }
    loadStatuses();
  }, []);

  useEffect(() => {
    async function loadOrders() {
      if (!user) return;
      setIsLoading(true);

      try {
        let query = supabase
          .from("orders")
          .select(`
            id, order_number, total, created_at, status_id,
            status:order_statuses(id, name, color),
            items:order_items(id, name, quantity)
          `)
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });

        if (selectedStatus !== "all") {
          query = query.eq("status_id", selectedStatus);
        }

        const { data } = await query;
        setOrders(data || []);
      } catch (error) {
        console.error("Error loading orders:", error);
      } finally {
        setIsLoading(false);
      }
    }

    loadOrders();
  }, [user, selectedStatus]);

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
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(dateString));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Мої замовлення</h1>
        
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={selectedStatus} onValueChange={setSelectedStatus}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Всі статуси" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Всі статуси</SelectItem>
              {statuses.map((status) => (
                <SelectItem key={status.id} value={status.id}>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: status.color || "#gray" }}
                    />
                    {status.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">
              {selectedStatus === "all"
                ? "У вас ще немає замовлень"
                : "Замовлень з таким статусом не знайдено"}
            </h2>
            <p className="text-muted-foreground mb-4">
              {selectedStatus === "all"
                ? "Перегляньте наш каталог та оформіть перше замовлення"
                : "Спробуйте обрати інший фільтр"}
            </p>
            {selectedStatus === "all" && (
              <Button asChild>
                <Link to="/catalog">Перейти до каталогу</Link>
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <Link
              key={order.id}
              to={`/profile/orders/${order.id}`}
              className="block"
            >
              <Card className="hover:border-primary/50 transition-colors">
                <CardContent className="p-4 sm:p-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <span className="font-semibold text-lg">
                          {order.order_number}
                        </span>
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
                      
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        {formatDate(order.created_at)}
                      </div>

                      <div className="text-sm text-muted-foreground">
                        {order.items.slice(0, 2).map((item, i) => (
                          <span key={item.id}>
                            {i > 0 && ", "}
                            {item.name} ×{item.quantity}
                          </span>
                        ))}
                        {order.items.length > 2 && (
                          <span> та ще {order.items.length - 2} позицій</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">Сума</p>
                        <p className="text-xl font-bold text-primary">
                          {formatPrice(order.total)}
                        </p>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground hidden sm:block" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
