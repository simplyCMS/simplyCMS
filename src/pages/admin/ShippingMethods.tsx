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
import { Plus, Trash2, Truck } from "lucide-react";
import { ShippingMethod } from "@/lib/shipping/types";
import { icons } from "lucide-react";

const getMethodIcon = (iconName: string | null): React.ComponentType<{ className?: string }> => {
  if (!iconName) return Truck;
  const Icon = icons[iconName as keyof typeof icons];
  return Icon || Truck;
};

const methodTypeBadge = (type: string) => {
  switch (type) {
    case "system":
      return <Badge variant="secondary">Системний</Badge>;
    case "manual":
      return <Badge variant="outline">Ручний</Badge>;
    case "plugin":
      return <Badge className="bg-purple-500">Плагін</Badge>;
    default:
      return <Badge variant="outline">{type}</Badge>;
  }
};

export default function ShippingMethods() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: methods, isLoading } = useQuery({
    queryKey: ["shipping-methods"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shipping_methods")
        .select("*")
        .order("sort_order");
      if (error) throw error;
      return data as unknown as ShippingMethod[];
    },
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("shipping_methods")
        .update({ is_active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shipping-methods"] });
      toast.success("Статус оновлено");
    },
    onError: () => {
      toast.error("Помилка оновлення статусу");
    },
  });

  const deleteMethod = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("shipping_methods")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shipping-methods"] });
      toast.success("Службу видалено");
    },
    onError: () => {
      toast.error("Помилка видалення служби");
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Служби доставки</h1>
          <p className="text-muted-foreground mt-1">
            Управління способами доставки замовлень
          </p>
        </div>
        <Button asChild>
          <Link to="/admin/shipping/methods/new">
            <Plus className="h-4 w-4 mr-2" />
            Додати службу
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Всі служби доставки</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Завантаження...
            </div>
          ) : !methods?.length ? (
            <div className="text-center py-8 text-muted-foreground">
              Служби доставки не знайдено
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12"></TableHead>
                  <TableHead>Назва</TableHead>
                  <TableHead>Код</TableHead>
                  <TableHead>Тип</TableHead>
                  <TableHead className="text-center">Активна</TableHead>
                  <TableHead className="text-right">Дії</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {methods.map((method) => {
                  const IconComponent = getMethodIcon(method.icon);
                  return (
                    <TableRow
                      key={method.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => navigate(`/admin/shipping/methods/${method.id}`)}
                    >
                      <TableCell>
                        <IconComponent className="h-5 w-5 text-muted-foreground" />
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{method.name}</div>
                          {method.description && (
                            <div className="text-sm text-muted-foreground">
                              {method.description}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <code className="text-sm bg-muted px-2 py-1 rounded">
                          {method.code}
                        </code>
                      </TableCell>
                      <TableCell>
                        {methodTypeBadge(method.type)}
                        {method.plugin_name && (
                          <span className="text-xs text-muted-foreground ml-2">
                            ({method.plugin_name})
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <Switch
                          checked={method.is_active}
                          onCheckedChange={(checked) =>
                            toggleActive.mutate({ id: method.id, is_active: checked })
                          }
                          onClick={(e) => e.stopPropagation()}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        {method.type !== "system" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm("Видалити цю службу доставки?")) {
                                deleteMethod.mutate(method.id);
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
