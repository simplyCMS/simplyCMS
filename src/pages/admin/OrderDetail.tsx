import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
 import { ArrowLeft, Trash2, Save, Loader2, UserPlus } from "lucide-react";
import { format } from "date-fns";
import { uk } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { AddProductToOrder } from "@/components/admin/AddProductToOrder";

interface OrderItem {
  id: string;
  name: string;
  price: number;
  base_price: number | null;
  discount_data: any | null;
  quantity: number;
  total: number;
  product_id: string | null;
  modification_id: string | null;
}

export default function OrderDetail() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [editedItems, setEditedItems] = useState<Record<string, number>>({});
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  // Fetch order details
  const { data: order, isLoading: orderLoading } = useQuery({
    queryKey: ["admin-order", orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, order_statuses(id, name, color, code)")
        .eq("id", orderId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!orderId,
  });

  // Fetch order items
  const { data: orderItems, isLoading: itemsLoading } = useQuery({
    queryKey: ["admin-order-items", orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_items")
        .select("*")
        .eq("order_id", orderId!)
        .order("created_at");
      if (error) throw error;
      return data as OrderItem[];
    },
    enabled: !!orderId,
  });

  // Fetch available statuses
  const { data: statuses } = useQuery({
    queryKey: ["order-statuses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_statuses")
        .select("*")
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  // Initialize selected status when order loads
  useEffect(() => {
    if (order?.status_id && selectedStatus === null) {
      setSelectedStatus(order.status_id);
    }
  }, [order?.status_id, selectedStatus]);

  // Update order mutation
  const updateOrderMutation = useMutation({
    mutationFn: async () => {
      // Update items with changed quantities
      for (const [itemId, newQuantity] of Object.entries(editedItems)) {
        const item = orderItems?.find((i) => i.id === itemId);
        if (item) {
          const newTotal = item.price * newQuantity;
          const { error } = await supabase
            .from("order_items")
            .update({ quantity: newQuantity, total: newTotal })
            .eq("id", itemId);
          if (error) throw error;
        }
      }

      // Recalculate order totals
      const { data: updatedItems } = await supabase
        .from("order_items")
        .select("total")
        .eq("order_id", orderId!);

      const newSubtotal = updatedItems?.reduce((sum, item) => sum + item.total, 0) || 0;

      // Update order with new totals and status
      const { error } = await supabase
        .from("orders")
        .update({
          subtotal: newSubtotal,
          total: newSubtotal,
          status_id: selectedStatus,
        })
        .eq("id", orderId!);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-order", orderId] });
      queryClient.invalidateQueries({ queryKey: ["admin-order-items", orderId] });
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      setEditedItems({});
      setHasChanges(false);
      toast({
        title: "Замовлення оновлено",
        description: "Зміни успішно збережено",
      });
    },
    onError: (error) => {
      toast({
        title: "Помилка",
        description: "Не вдалося оновити замовлення",
        variant: "destructive",
      });
      console.error("Update error:", error);
    },
  });

  // Delete item mutation
  const deleteItemMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase
        .from("order_items")
        .delete()
        .eq("id", itemId);
      if (error) throw error;

      // Recalculate order totals
      const { data: remainingItems } = await supabase
        .from("order_items")
        .select("total")
        .eq("order_id", orderId!);

      const newSubtotal = remainingItems?.reduce((sum, item) => sum + item.total, 0) || 0;

      const { error: updateError } = await supabase
        .from("orders")
        .update({
          subtotal: newSubtotal,
          total: newSubtotal,
        })
        .eq("id", orderId!);

      if (updateError) throw updateError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-order", orderId] });
      queryClient.invalidateQueries({ queryKey: ["admin-order-items", orderId] });
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      toast({
        title: "Товар видалено",
        description: "Товар успішно видалено з замовлення",
      });
    },
    onError: () => {
      toast({
        title: "Помилка",
        description: "Не вдалося видалити товар",
        variant: "destructive",
      });
    },
  });

  // Add item mutation
  const addItemMutation = useMutation({
    mutationFn: async (newItem: {
      name: string;
      price: number;
      quantity: number;
      product_id: string | null;
      modification_id: string | null;
    }) => {
      const total = newItem.price * newItem.quantity;
      const { error } = await supabase.from("order_items").insert({
        order_id: orderId!,
        name: newItem.name,
        price: newItem.price,
        quantity: newItem.quantity,
        total,
        product_id: newItem.product_id,
        modification_id: newItem.modification_id,
      });
      if (error) throw error;

      // Recalculate order totals
      const { data: updatedItems } = await supabase
        .from("order_items")
        .select("total")
        .eq("order_id", orderId!);

      const newSubtotal = updatedItems?.reduce((sum, item) => sum + item.total, 0) || 0;

      const { error: updateError } = await supabase
        .from("orders")
        .update({
          subtotal: newSubtotal,
          total: newSubtotal,
        })
        .eq("id", orderId!);

      if (updateError) throw updateError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-order", orderId] });
      queryClient.invalidateQueries({ queryKey: ["admin-order-items", orderId] });
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      toast({
        title: "Товар додано",
        description: "Товар успішно додано до замовлення",
      });
    },
    onError: () => {
      toast({
        title: "Помилка",
        description: "Не вдалося додати товар",
        variant: "destructive",
      });
    },
  });

  const handleQuantityChange = (itemId: string, newQuantity: number) => {
    if (newQuantity < 1) return;
    setEditedItems((prev) => ({ ...prev, [itemId]: newQuantity }));
    setHasChanges(true);
  };

  const handleStatusChange = (statusId: string) => {
    setSelectedStatus(statusId);
    setHasChanges(true);
  };

  const getItemQuantity = (item: OrderItem) => {
    return editedItems[item.id] ?? item.quantity;
  };

  const getItemTotal = (item: OrderItem) => {
    const quantity = getItemQuantity(item);
    return item.price * quantity;
  };

  const calculateNewTotal = () => {
    if (!orderItems) return 0;
    return orderItems.reduce((sum, item) => sum + getItemTotal(item), 0);
  };

  if (orderLoading || itemsLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Замовлення не знайдено</p>
        <Button variant="link" onClick={() => navigate("/admin/orders")}>
          Повернутися до списку
        </Button>
      </div>
    );
  }

  const currentStatus = statuses?.find((s) => s.id === selectedStatus);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin/orders")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Замовлення {order.order_number}</h1>
            <p className="text-sm text-muted-foreground">
              від {format(new Date(order.created_at), "dd MMMM yyyy, HH:mm", { locale: uk })}
            </p>
          </div>
        </div>
        <Button
          onClick={() => updateOrderMutation.mutate()}
          disabled={!hasChanges || updateOrderMutation.isPending}
        >
          {updateOrderMutation.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Зберегти зміни
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Order Items */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle>Товари замовлення</CardTitle>
              <AddProductToOrder
                onAddProduct={(product) => addItemMutation.mutate(product)}
                isAdding={addItemMutation.isPending}
              />
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Назва</TableHead>
                    <TableHead className="w-28 text-right">Базова ціна</TableHead>
                    <TableHead className="w-24 text-right">Ціна</TableHead>
                    <TableHead className="w-32 text-center">Кількість</TableHead>
                    <TableHead className="w-28 text-right">Сума</TableHead>
                    <TableHead className="w-16"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orderItems?.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div className="font-medium">{item.name}</div>
                        {item.discount_data?.appliedDiscounts?.length > 0 && (
                          <div className="mt-1">
                            {item.discount_data.appliedDiscounts.map((d: any, i: number) => (
                              <span key={i} className="inline-block text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded px-1.5 py-0.5 mr-1 mb-0.5">
                                {d.name}: -{d.calculatedAmount.toLocaleString()} ₴
                              </span>
                            ))}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {item.base_price && item.base_price > item.price ? (
                          <span className="text-muted-foreground line-through">
                            {item.base_price.toLocaleString()} ₴
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {item.price.toLocaleString()} ₴
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() =>
                              handleQuantityChange(item.id, getItemQuantity(item) - 1)
                            }
                            disabled={getItemQuantity(item) <= 1}
                          >
                            -
                          </Button>
                          <Input
                            type="number"
                            min="1"
                            value={getItemQuantity(item)}
                            onChange={(e) =>
                              handleQuantityChange(item.id, parseInt(e.target.value) || 1)
                            }
                            className="w-14 h-8 text-center"
                          />
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() =>
                              handleQuantityChange(item.id, getItemQuantity(item) + 1)
                            }
                          >
                            +
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {getItemTotal(item).toLocaleString()} ₴
                      </TableCell>
                      <TableCell>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              disabled={orderItems.length <= 1}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Видалити товар?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Ви впевнені, що хочете видалити "{item.name}" з замовлення?
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Скасувати</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteItemMutation.mutate(item.id)}
                              >
                                Видалити
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="mt-4 pt-4 border-t flex justify-between items-center">
                <span className="font-medium">Загальна сума:</span>
                <span className="text-xl font-bold">
                  {calculateNewTotal().toLocaleString()} ₴
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Status */}
          <Card>
            <CardHeader>
              <CardTitle>Статус замовлення</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Select value={selectedStatus || ""} onValueChange={handleStatusChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Виберіть статус">
                    {currentStatus && (
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: currentStatus.color || "#6B7280" }}
                        />
                        {currentStatus.name}
                      </div>
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {statuses?.map((status) => (
                    <SelectItem key={status.id} value={status.id}>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: status.color || "#6B7280" }}
                        />
                        {status.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {currentStatus && (
                <Badge
                  className="w-full justify-center py-1"
                  style={{ backgroundColor: currentStatus.color || "#6B7280" }}
                >
                  {currentStatus.name}
                </Badge>
              )}
            </CardContent>
          </Card>

          {/* Customer Info */}
          <Card>
            <CardHeader>
              <CardTitle>Інформація про клієнта</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <span className="text-muted-foreground">Ім'я:</span>
                <p className="font-medium">
                  {order.first_name} {order.last_name}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Email:</span>
                <p className="font-medium">{order.email}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Телефон:</span>
                <p className="font-medium">{order.phone}</p>
              </div>
            </CardContent>
          </Card>

           {/* Recipient Info - if different from customer */}
           {order.has_different_recipient && (
             <Card className="border-primary/30 bg-primary/5">
               <CardHeader>
                 <CardTitle className="flex items-center gap-2">
                   <UserPlus className="h-4 w-4" />
                   Отримувач
                 </CardTitle>
               </CardHeader>
               <CardContent className="space-y-3 text-sm">
                 <div>
                   <span className="text-muted-foreground">Ім'я:</span>
                   <p className="font-medium">
                     {order.recipient_first_name} {order.recipient_last_name}
                   </p>
                 </div>
                 {order.recipient_phone && (
                   <div>
                     <span className="text-muted-foreground">Телефон:</span>
                     <p className="font-medium">{order.recipient_phone}</p>
                   </div>
                 )}
                 {order.recipient_email && (
                   <div>
                     <span className="text-muted-foreground">Email:</span>
                     <p className="font-medium">{order.recipient_email}</p>
                   </div>
                 )}
               </CardContent>
             </Card>
           )}
 
          {/* Delivery */}
          <Card>
            <CardHeader>
              <CardTitle>Доставка</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <span className="text-muted-foreground">Спосіб:</span>
                <p className="font-medium">
                  {order.delivery_method === "pickup"
                    ? "Самовивіз"
                    : order.delivery_method === "nova_poshta"
                    ? "Нова Пошта"
                    : order.delivery_method === "courier"
                    ? "Кур'єр"
                    : order.delivery_method}
                </p>
              </div>
              {order.delivery_city && (
                <div>
                  <span className="text-muted-foreground">Місто:</span>
                  <p className="font-medium">{order.delivery_city}</p>
                </div>
              )}
              {order.delivery_address && (
                <div>
                  <span className="text-muted-foreground">Адреса:</span>
                  <p className="font-medium">{order.delivery_address}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Payment */}
          <Card>
            <CardHeader>
              <CardTitle>Оплата</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <span className="text-muted-foreground">Спосіб:</span>
                <p className="font-medium">
                  {order.payment_method === "cash" ? "Оплата при отриманні" : order.payment_method}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Notes */}
          {order.notes && (
            <Card>
              <CardHeader>
                <CardTitle>Коментар</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm">{order.notes}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
