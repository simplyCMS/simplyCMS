import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";
import { uk } from "date-fns/locale";

export default function Orders() {
  const navigate = useNavigate();

  const { data: orders, isLoading } = useQuery({
    queryKey: ["admin-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, order_statuses(name, color)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Замовлення</h1>
        <p className="text-muted-foreground">Перегляд та обробка замовлень</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Всі замовлення</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>№ Замовлення</TableHead>
                <TableHead>Клієнт</TableHead>
                <TableHead>Сума</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead>Дата</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders?.map((order) => (
                <TableRow
                  key={order.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => navigate(`/admin/orders/${order.id}`)}
                >
                  <TableCell className="font-medium">{order.order_number}</TableCell>
                  <TableCell>
                    <div>
                      <div>{order.first_name} {order.last_name}</div>
                      <div className="text-sm text-muted-foreground">{order.email}</div>
                    </div>
                  </TableCell>
                  <TableCell>{order.total.toLocaleString()} ₴</TableCell>
                  <TableCell>
                    <Badge
                      style={{
                        backgroundColor: (order as any).order_statuses?.color || "#6B7280",
                      }}
                    >
                      {(order as any).order_statuses?.name || "Новий"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {format(new Date(order.created_at), "dd MMM yyyy, HH:mm", { locale: uk })}
                  </TableCell>
                </TableRow>
              ))}
              {orders?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    Замовлень ще немає
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
