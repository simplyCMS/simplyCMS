import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Search, Shield, ArrowLeft } from "lucide-react";
import { format } from "date-fns";
import { uk } from "date-fns/locale";

interface UserWithDetails {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  category_id: string | null;
  auth_provider: string | null;
  created_at: string;
  category?: {
    id: string;
    name: string;
  } | null;
  is_admin: boolean;
  total_orders: number;
  total_spent: number;
}

export default function Users() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [roleFilter, setRoleFilter] = useState<string>("all");

  // Fetch categories for filter
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

  // Fetch users with their details
  const { data: users, isLoading } = useQuery({
    queryKey: ["admin-users", search, categoryFilter, roleFilter],
    queryFn: async () => {
      // Get profiles with categories
      let query = supabase
        .from("profiles")
        .select(`
          user_id,
          first_name,
          last_name,
          email,
          phone,
          avatar_url,
          category_id,
          auth_provider,
          created_at,
          category:user_categories(id, name)
        `)
        .order("created_at", { ascending: false });

      if (categoryFilter && categoryFilter !== "all") {
        query = query.eq("category_id", categoryFilter);
      }

      const { data: profiles, error: profilesError } = await query;
      if (profilesError) throw profilesError;

      // Get admin roles
      const { data: adminRoles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin");
      if (rolesError) throw rolesError;

      const adminUserIds = new Set(adminRoles?.map((r) => r.user_id) || []);

      // Get order stats for each user
      const { data: orderStats, error: statsError } = await supabase
        .from("orders")
        .select("user_id, total")
        .not("user_id", "is", null);
      if (statsError) throw statsError;

      // Calculate stats per user
      const userStats = new Map<string, { orders: number; spent: number }>();
      orderStats?.forEach((order) => {
        if (!order.user_id) return;
        const current = userStats.get(order.user_id) || { orders: 0, spent: 0 };
        current.orders += 1;
        current.spent += Number(order.total) || 0;
        userStats.set(order.user_id, current);
      });

      // Combine all data
      let result: UserWithDetails[] = profiles?.map((profile) => ({
        ...profile,
        category: profile.category as { id: string; name: string } | null,
        is_admin: adminUserIds.has(profile.user_id),
        total_orders: userStats.get(profile.user_id)?.orders || 0,
        total_spent: userStats.get(profile.user_id)?.spent || 0,
      })) || [];

      // Apply role filter
      if (roleFilter === "admin") {
        result = result.filter((u) => u.is_admin);
      } else if (roleFilter === "user") {
        result = result.filter((u) => !u.is_admin);
      }

      // Apply search filter
      if (search) {
        const searchLower = search.toLowerCase();
        result = result.filter(
          (u) =>
            u.email?.toLowerCase().includes(searchLower) ||
            u.first_name?.toLowerCase().includes(searchLower) ||
            u.last_name?.toLowerCase().includes(searchLower) ||
            u.phone?.includes(search)
        );
      }

      return result;
    },
  });

  const getInitials = (user: UserWithDetails) => {
    const first = user.first_name?.[0] || "";
    const last = user.last_name?.[0] || "";
    return (first + last).toUpperCase() || user.email?.[0]?.toUpperCase() || "?";
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("uk-UA", {
      style: "currency",
      currency: "UAH",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/admin">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Користувачі</h1>
          <p className="text-muted-foreground">
            Управління користувачами системи
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="relative flex-1 min-w-[250px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Пошук за email, ім'ям, телефоном..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Категорія" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Всі категорії</SelectItem>
            {categories?.map((cat) => (
              <SelectItem key={cat.id} value={cat.id}>
                {cat.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Роль" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Всі ролі</SelectItem>
            <SelectItem value="admin">Адміністратори</SelectItem>
            <SelectItem value="user">Користувачі</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Users table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12"></TableHead>
              <TableHead>Користувач</TableHead>
              <TableHead>Контакти</TableHead>
              <TableHead>Категорія</TableHead>
              <TableHead className="text-center">Замовлень</TableHead>
              <TableHead className="text-right">Сума покупок</TableHead>
              <TableHead>Реєстрація</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  Завантаження...
                </TableCell>
              </TableRow>
            ) : users?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  Користувачів не знайдено
                </TableCell>
              </TableRow>
            ) : (
              users?.map((user) => (
                <TableRow
                  key={user.user_id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => navigate(`/admin/users/${user.user_id}`)}
                >
                  <TableCell>
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={user.avatar_url || undefined} />
                      <AvatarFallback>{getInitials(user)}</AvatarFallback>
                    </Avatar>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div>
                        <div className="font-medium flex items-center gap-2">
                          {user.first_name || user.last_name
                            ? `${user.first_name || ""} ${user.last_name || ""}`.trim()
                            : "Без імені"}
                          {user.is_admin && (
                            <Shield className="h-4 w-4 text-primary" />
                          )}
                        </div>
                        {user.auth_provider && (
                          <span className="text-xs text-muted-foreground">
                            via {user.auth_provider}
                          </span>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {user.email && <div>{user.email}</div>}
                      {user.phone && (
                        <div className="text-muted-foreground">{user.phone}</div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {user.category ? (
                      <Badge variant="secondary">{user.category.name}</Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {user.total_orders > 0 ? user.total_orders : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    {user.total_spent > 0 ? formatCurrency(user.total_spent) : "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {format(new Date(user.created_at), "dd MMM yyyy", {
                      locale: uk,
                    })}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
