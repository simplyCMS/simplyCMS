import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StarRating } from "@/components/reviews/StarRating";
import { Loader2, MessageSquare } from "lucide-react";
import { format } from "date-fns";
import { uk } from "date-fns/locale";

const statusLabels: Record<string, string> = {
  pending: "На модерації",
  approved: "Затверджено",
  rejected: "Відхилено",
};
const statusVariants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "outline",
  approved: "default",
  rejected: "destructive",
};

export default function AdminReviews() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: reviews = [], isLoading } = useQuery({
    queryKey: ["admin-reviews", statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("product_reviews")
        .select("*")
        .order("created_at", { ascending: false });

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Fetch product names and profiles
      const productIds = [...new Set((data || []).map((r: any) => r.product_id))];
      const userIds = [...new Set((data || []).map((r: any) => r.user_id))];

      let productsMap: Record<string, string> = {};
      let profilesMap: Record<string, any> = {};

      if (productIds.length > 0) {
        const { data: products } = await supabase
          .from("products")
          .select("id, name")
          .in("id", productIds);
        products?.forEach((p: any) => { productsMap[p.id] = p.name; });
      }

      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, first_name, last_name, email")
          .in("user_id", userIds);
        profiles?.forEach((p: any) => { profilesMap[p.user_id] = p; });
      }

      return (data || []).map((r: any) => ({
        ...r,
        productName: productsMap[r.product_id] || "—",
        profile: profilesMap[r.user_id] || null,
      }));
    },
  });

  const pendingCount = reviews.filter((r: any) => r.status === "pending").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <MessageSquare className="h-6 w-6" /> Відгуки
            {pendingCount > 0 && (
              <Badge variant="destructive">{pendingCount}</Badge>
            )}
          </h1>
          <p className="text-muted-foreground">Модерація відгуків товарів</p>
        </div>
      </div>

      <div className="flex gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Фільтр за статусом" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Всі</SelectItem>
            <SelectItem value="pending">На модерації</SelectItem>
            <SelectItem value="approved">Затверджені</SelectItem>
            <SelectItem value="rejected">Відхилені</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : reviews.length === 0 ? (
        <p className="text-muted-foreground text-center py-8">Відгуків не знайдено</p>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Товар</TableHead>
                  <TableHead>Автор</TableHead>
                  <TableHead>Рейтинг</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead>Дата</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reviews.map((r: any) => {
                  const authorName = r.profile
                    ? [r.profile.first_name, r.profile.last_name].filter(Boolean).join(" ") || r.profile.email || "—"
                    : "—";
                  return (
                    <TableRow
                      key={r.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => navigate(`/admin/reviews/${r.id}`)}
                    >
                      <TableCell className="font-medium max-w-[200px] truncate">{r.productName}</TableCell>
                      <TableCell>{authorName}</TableCell>
                      <TableCell><StarRating value={r.rating} readonly size="sm" /></TableCell>
                      <TableCell>
                        <Badge variant={statusVariants[r.status] || "outline"}>
                          {statusLabels[r.status] || r.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {format(new Date(r.created_at), "d MMM yyyy HH:mm", { locale: uk })}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
