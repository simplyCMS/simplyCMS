import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { Plus, Trash2, Building, Shield } from "lucide-react";

export default function PickupPoints() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: points, isLoading } = useQuery({
    queryKey: ["pickup-points"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pickup_points")
        .select(`*, zone:shipping_zones(name)`)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("pickup_points")
        .update({ is_active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pickup-points"] });
      toast.success("Статус оновлено");
    },
    onError: () => {
      toast.error("Помилка оновлення статусу");
    },
  });

  const deletePoint = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("pickup_points")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pickup-points"] });
      toast.success("Точку видалено");
    },
    onError: () => {
      toast.error("Помилка видалення точки");
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Точки самовивозу</h1>
          <p className="text-muted-foreground mt-1">
            Адреси магазинів та пунктів видачі замовлень
          </p>
        </div>
        <Button asChild>
          <Link to="/admin/shipping/pickup-points/new">
            <Plus className="h-4 w-4 mr-2" />
            Додати точку
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Всі точки самовивозу</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Завантаження...
            </div>
          ) : !points?.length ? (
            <div className="text-center py-8 text-muted-foreground">
              Точки самовивозу не знайдено
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Назва</TableHead>
                  <TableHead>Місто</TableHead>
                  <TableHead>Адреса</TableHead>
                  <TableHead>Зона</TableHead>
                  <TableHead className="text-center">Активна</TableHead>
                  <TableHead className="text-right">Дії</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {points.map((point: any) => (
                  <TableRow
                    key={point.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => navigate(`/admin/shipping/pickup-points/${point.id}`)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Building className="h-4 w-4 text-muted-foreground" />
                        <div className="font-medium">{point.name}</div>
                        {point.is_system && (
                          <Badge variant="secondary" className="gap-1">
                            <Shield className="h-3 w-3" />
                            Системна
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{point.city}</TableCell>
                    <TableCell>
                      <div className="max-w-[200px] truncate" title={point.address}>
                        {point.address}
                      </div>
                    </TableCell>
                    <TableCell>
                      {point.zone?.name ? (
                        <Badge variant="outline">{point.zone.name}</Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={point.is_active}
                        onCheckedChange={(checked) =>
                          toggleActive.mutate({ id: point.id, is_active: checked })
                        }
                        onClick={(e) => e.stopPropagation()}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      {!point.is_system && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm("Видалити цю точку самовивозу?")) {
                              deletePoint.mutate(point.id);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
