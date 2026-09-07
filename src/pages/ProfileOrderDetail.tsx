import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Package,
  Calendar,
  MapPin,
  CreditCard,
  User,
  XCircle,
  Loader2,
   UserPlus,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
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
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface OrderDetails {
  id: string;
  order_number: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  delivery_method: string | null;
  delivery_city: string | null;
  delivery_address: string | null;
  payment_method: string;
  notes: string | null;
  subtotal: number;
  total: number;
  created_at: string;
   has_different_recipient: boolean;
   recipient_first_name: string | null;
   recipient_last_name: string | null;
   recipient_phone: string | null;
   recipient_email: string | null;
  status: {
    id: string;
    name: string;
    code: string;
    color: string | null;
  } | null;
  items: {
    id: string;
    name: string;
    price: number;
    base_price: number | null;
    discount_data: any | null;
    quantity: number;
    total: number;
  }[];
}

const deliveryLabels: Record<string, string> = {
  pickup: "Самовивіз",
  nova_poshta: "Нова Пошта",
  courier: "Кур'єр",
};

const paymentLabels: Record<string, string> = {
  cash: "Оплата при отриманні",
  online: "Онлайн оплата",
};

export default function ProfileOrderDetail() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [order, setOrder] = useState<OrderDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCancelling, setIsCancelling] = useState(false);

  useEffect(() => {
    async function loadOrder() {
      if (!orderId || !user) return;

      try {
        const { data, error } = await supabase
          .from("orders")
          .select(`
            *,
            status:order_statuses(id, name, code, color),
            items:order_items(id, name, price, base_price, discount_data, quantity, total)
          `)
          .eq("id", orderId)
          .eq("user_id", user.id)
          .maybeSingle();

        if (error) throw error;
        setOrder(data);
      } catch (error) {
        console.error("Error loading order:", error);
      } finally {
        setIsLoading(false);
      }
    }

    loadOrder();
  }, [orderId, user]);

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

  const canCancel = order?.status?.code === "new";

  const handleCancel = async () => {
    if (!order) return;
    setIsCancelling(true);

    try {
      // Get cancelled status
      const { data: cancelledStatus } = await supabase
        .from("order_statuses")
        .select("id")
        .eq("code", "cancelled")
        .maybeSingle();

      if (!cancelledStatus) {
        throw new Error("Статус 'Скасовано' не знайдено");
      }

      const { error } = await supabase
        .from("orders")
        .update({ status_id: cancelledStatus.id })
        .eq("id", order.id)
        .eq("user_id", user?.id);

      if (error) throw error;

      toast({
        title: "Замовлення скасовано",
        description: `Замовлення ${order.order_number} успішно скасовано`,
      });

      navigate("/profile/orders");
    } catch (error: any) {
      console.error("Error cancelling order:", error);
      toast({
        title: "Помилка",
        description: error.message || "Не вдалось скасувати замовлення",
        variant: "destructive",
      });
    } finally {
      setIsCancelling(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!order) {
    return (
      <Card className="text-center py-12">
        <CardContent>
          <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Замовлення не знайдено</h2>
          <p className="text-muted-foreground mb-4">
            Можливо, воно було видалено або ви не маєте до нього доступу
          </p>
          <Button asChild>
            <Link to="/profile/orders">Мої замовлення</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/profile/orders">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{order.order_number}</h1>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              {formatDate(order.created_at)}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {order.status && (
            <Badge
              variant="outline"
              className="text-sm py-1 px-3"
              style={{
                borderColor: order.status.color || undefined,
                color: order.status.color || undefined,
              }}
            >
              {order.status.name}
            </Badge>
          )}

          {canCancel && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  <XCircle className="h-4 w-4 mr-2" />
                  Скасувати
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Скасувати замовлення?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Ви впевнені, що хочете скасувати замовлення {order.order_number}?
                    Цю дію неможливо буде відмінити.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Ні, залишити</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleCancel}
                    disabled={isCancelling}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {isCancelling ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Скасування...
                      </>
                    ) : (
                      "Так, скасувати"
                    )}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      {/* Order items */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Package className="h-5 w-5" />
            Товари замовлення
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {order.items.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between py-3 border-b last:border-0"
            >
              <div>
                <p className="font-medium">{item.name}</p>
                <p className="text-sm text-muted-foreground">
                  {item.quantity} × {formatPrice(item.price)}
                </p>
                {item.base_price && item.base_price > item.price && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    <span className="line-through">{formatPrice(item.base_price)}</span>
                  </p>
                )}
              </div>
              <p className="font-semibold">{formatPrice(item.total)}</p>
            </div>
          ))}

          <Separator />

          <div className="flex justify-between text-lg font-semibold">
            <span>Разом</span>
            <span className="text-primary">{formatPrice(order.total)}</span>
          </div>
        </CardContent>
      </Card>

      {/* Delivery & Payment */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Доставка
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-sm text-muted-foreground">Спосіб доставки</p>
              <p className="font-medium">
                {deliveryLabels[order.delivery_method || ""] || order.delivery_method || "Не вказано"}
              </p>
            </div>
            {order.delivery_city && (
              <div>
                <p className="text-sm text-muted-foreground">Місто</p>
                <p className="font-medium">{order.delivery_city}</p>
              </div>
            )}
            {order.delivery_address && (
              <div>
                <p className="text-sm text-muted-foreground">Адреса</p>
                <p className="font-medium">{order.delivery_address}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Оплата
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div>
              <p className="text-sm text-muted-foreground">Спосіб оплати</p>
              <p className="font-medium">
                {paymentLabels[order.payment_method] || order.payment_method}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Contact info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <User className="h-5 w-5" />
             Замовник
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
               <p className="text-sm text-muted-foreground">Ім'я</p>
              <p className="font-medium">
                {order.first_name} {order.last_name}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Телефон</p>
              <p className="font-medium">{order.phone}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Email</p>
              <p className="font-medium">{order.email}</p>
            </div>
          </div>
        </CardContent>
      </Card>
 
       {/* Recipient info - if different from customer */}
       {order.has_different_recipient && (
         <Card className="border-primary/30 bg-primary/5">
           <CardHeader>
             <CardTitle className="text-lg flex items-center gap-2">
               <UserPlus className="h-5 w-5" />
               Отримувач
             </CardTitle>
           </CardHeader>
           <CardContent>
             <div className="grid sm:grid-cols-2 gap-4">
               <div>
                 <p className="text-sm text-muted-foreground">Ім'я</p>
                 <p className="font-medium">
                   {order.recipient_first_name} {order.recipient_last_name}
                 </p>
               </div>
               {order.recipient_phone && (
                 <div>
                   <p className="text-sm text-muted-foreground">Телефон</p>
                   <p className="font-medium">{order.recipient_phone}</p>
                 </div>
               )}
               {order.recipient_email && (
                 <div>
                   <p className="text-sm text-muted-foreground">Email</p>
                   <p className="font-medium">{order.recipient_email}</p>
                 </div>
               )}
             </div>
           </CardContent>
         </Card>
       )}
 
       {/* Notes */}
       {order.notes && (
         <Card>
           <CardHeader>
             <CardTitle className="text-lg">Коментар до замовлення</CardTitle>
           </CardHeader>
           <CardContent>
             <p className="text-muted-foreground">{order.notes}</p>
           </CardContent>
         </Card>
       )}
    </div>
  );
}
