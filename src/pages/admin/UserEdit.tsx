import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  Shield,
  Mail,
  Phone,
  Calendar,
  ShoppingCart,
  History,
  ExternalLink,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { uk } from "date-fns/locale";

export default function UserEdit() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [historyOpen, setHistoryOpen] = useState(false);

  // Fetch user profile
  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["admin-user", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select(`
          *,
          category:user_categories(id, name)
        `)
        .eq("user_id", userId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });

  // Fetch if user is admin
  const { data: isAdmin } = useQuery({
    queryKey: ["user-is-admin", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("id")
        .eq("user_id", userId)
        .eq("role", "admin")
        .maybeSingle();
      if (error) throw error;
      return !!data;
    },
    enabled: !!userId,
  });

  // Fetch categories
  const { data: categories } = useQuery({
    queryKey: ["user-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_categories")
        .select("*")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch user orders
  const { data: orders } = useQuery({
    queryKey: ["user-orders", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select(`
          id,
          order_number,
          total,
          created_at,
          status:order_statuses(name, color)
        `)
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });

  // Fetch user stats
  const { data: stats } = useQuery({
    queryKey: ["user-stats", userId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_user_stats", {
        p_user_id: userId,
      });
      if (error) throw error;
      return data?.[0] || null;
    },
    enabled: !!userId,
  });

  // Fetch category history
  const { data: categoryHistory } = useQuery({
    queryKey: ["user-category-history", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_category_history")
        .select(`
          *,
          from_category:user_categories!user_category_history_from_category_id_fkey(name),
          to_category:user_categories!user_category_history_to_category_id_fkey(name)
        `)
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!userId && historyOpen,
  });

  // Toggle admin mutation
  const toggleAdminMutation = useMutation({
    mutationFn: async (newIsAdmin: boolean) => {
      const { error } = await supabase.rpc("toggle_user_admin", {
        p_user_id: userId!,
        p_is_admin: newIsAdmin,
      });
      if (error) throw error;
    },
    onSuccess: (_, newIsAdmin) => {
      queryClient.invalidateQueries({ queryKey: ["user-is-admin", userId] });
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast({
        title: newIsAdmin ? "Адміністратора призначено" : "Роль адміністратора знято",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Помилка",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update category mutation
  const updateCategoryMutation = useMutation({
    mutationFn: async (categoryId: string) => {
      const { error } = await supabase.rpc("admin_update_user_category", {
        target_user_id: userId!,
        new_category_id: categoryId,
      });
      if (error) throw error;

      // Record history
      const { error: historyError } = await supabase
        .from("user_category_history")
        .insert({
          user_id: userId!,
          from_category_id: profile?.category_id,
          to_category_id: categoryId,
          reason: "Ручна зміна адміністратором",
          changed_by: (await supabase.auth.getUser()).data.user?.id,
        });
      if (historyError) console.error("History error:", historyError);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-user", userId] });
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast({ title: "Категорію змінено" });
    },
    onError: (error: Error) => {
      toast({
        title: "Помилка",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("uk-UA", {
      style: "currency",
      currency: "UAH",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const getInitials = () => {
    const first = profile?.first_name?.[0] || "";
    const last = profile?.last_name?.[0] || "";
    return (first + last).toUpperCase() || profile?.email?.[0]?.toUpperCase() || "?";
  };

  if (profileLoading) {
    return <div className="p-8 text-center">Завантаження...</div>;
  }

  if (!profile) {
    return (
      <div className="p-8 text-center">
        <p>Користувача не знайдено</p>
        <Button asChild className="mt-4">
          <Link to="/admin/users">Назад до списку</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/admin/users">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">Картка користувача</h1>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main info */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Основна інформація</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-start gap-6">
              <Avatar className="h-24 w-24">
                <AvatarImage src={profile.avatar_url || undefined} />
                <AvatarFallback className="text-2xl">{getInitials()}</AvatarFallback>
              </Avatar>
              <div className="flex-1 space-y-3">
                <div>
                  <h2 className="text-2xl font-semibold flex items-center gap-2">
                    {profile.first_name || profile.last_name
                      ? `${profile.first_name || ""} ${profile.last_name || ""}`.trim()
                      : "Без імені"}
                    {isAdmin && <Shield className="h-5 w-5 text-primary" />}
                  </h2>
                  {profile.auth_provider && (
                    <Badge variant="outline" className="mt-1">
                      Авторизація: {profile.auth_provider}
                    </Badge>
                  )}
                </div>
                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                  {profile.email && (
                    <div className="flex items-center gap-1">
                      <Mail className="h-4 w-4" />
                      {profile.email}
                    </div>
                  )}
                  {profile.phone && (
                    <div className="flex items-center gap-1">
                      <Phone className="h-4 w-4" />
                      {profile.phone}
                    </div>
                  )}
                  <div className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    Зареєстровано:{" "}
                    {format(new Date(profile.created_at), "dd MMMM yyyy", {
                      locale: uk,
                    })}
                  </div>
                </div>
              </div>
            </div>

            {profile.registration_utm && Object.keys(profile.registration_utm).length > 0 && (
              <>
                <Separator />
                <div>
                  <h3 className="font-medium mb-2">UTM мітки при реєстрації</h3>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(profile.registration_utm as Record<string, string>).map(
                      ([key, value]) =>
                        value && (
                          <Badge key={key} variant="secondary">
                            {key}: {value}
                          </Badge>
                        )
                    )}
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Category & Role */}
        <Card>
          <CardHeader>
            <CardTitle>Категорія та роль</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>Категорія користувача</Label>
              <div className="flex items-center gap-2">
                <Select
                  value={profile.category_id || ""}
                  onValueChange={(value) => updateCategoryMutation.mutate(value)}
                  disabled={updateCategoryMutation.isPending}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Оберіть категорію" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories?.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="icon">
                      <History className="h-4 w-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-lg">
                    <DialogHeader>
                      <DialogTitle>Історія змін категорії</DialogTitle>
                    </DialogHeader>
                    <div className="max-h-[400px] overflow-auto">
                      {categoryHistory?.length === 0 ? (
                        <p className="text-center text-muted-foreground py-4">
                          Історія порожня
                        </p>
                      ) : (
                        <div className="space-y-3">
                          {categoryHistory?.map((item) => (
                            <div
                              key={item.id}
                              className="border rounded-lg p-3 text-sm"
                            >
                              <div className="flex items-center justify-between mb-1">
                                <span className="font-medium">
                                  {item.from_category?.name || "—"} →{" "}
                                  {item.to_category?.name}
                                </span>
                                <span className="text-muted-foreground">
                                  {format(
                                    new Date(item.created_at),
                                    "dd.MM.yyyy HH:mm"
                                  )}
                                </span>
                              </div>
                              {item.reason && (
                                <p className="text-muted-foreground">
                                  {item.reason}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Адміністратор</Label>
                <p className="text-sm text-muted-foreground">
                  Доступ до адмін-панелі
                </p>
              </div>
              <Switch
                checked={isAdmin}
                onCheckedChange={(checked) => toggleAdminMutation.mutate(checked)}
                disabled={toggleAdminMutation.isPending}
              />
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        <Card>
          <CardHeader>
            <CardTitle>Статистика</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <div className="text-2xl font-bold">
                  {stats?.orders_count || 0}
                </div>
                <div className="text-sm text-muted-foreground">Замовлень</div>
              </div>
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <div className="text-2xl font-bold">
                  {formatCurrency(stats?.total_purchases || 0)}
                </div>
                <div className="text-sm text-muted-foreground">Сума покупок</div>
              </div>
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <div className="text-2xl font-bold">
                  {stats?.registration_days || 0}
                </div>
                <div className="text-sm text-muted-foreground">
                  Днів з реєстрації
                </div>
              </div>
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <div className="text-lg font-medium truncate">
                  {stats?.email_domain || "—"}
                </div>
                <div className="text-sm text-muted-foreground">Домен email</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent orders */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              Останні замовлення
            </CardTitle>
          </CardHeader>
          <CardContent>
            {orders?.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">
                Замовлень ще немає
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Номер</TableHead>
                    <TableHead>Статус</TableHead>
                    <TableHead className="text-right">Сума</TableHead>
                    <TableHead>Дата</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders?.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium">
                        {order.order_number}
                      </TableCell>
                      <TableCell>
                        <Badge
                          style={{
                            backgroundColor: order.status?.color || undefined,
                          }}
                        >
                          {order.status?.name}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(order.total)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(order.created_at), "dd.MM.yyyy", {
                          locale: uk,
                        })}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" asChild>
                          <Link to={`/admin/orders/${order.id}`}>
                            <ExternalLink className="h-4 w-4" />
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
