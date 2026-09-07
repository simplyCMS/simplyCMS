import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Loader2, Image } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type Product = Tables<"products">;

export default function Products() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: products, isLoading } = useQuery({
    queryKey: ["admin-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*, sections(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      toast({ title: "Товар видалено" });
    },
    onError: (error) => {
      toast({ variant: "destructive", title: "Помилка", description: error.message });
    },
  });

  const handleRowClick = (productId: string) => {
    navigate(`/admin/products/${productId}`);
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm("Видалити цей товар?")) {
      deleteMutation.mutate(id);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Товари</h1>
          <p className="text-muted-foreground">Керування каталогом товарів</p>
        </div>
        <Button onClick={() => navigate("/admin/products/new")}>
          <Plus className="h-4 w-4 mr-2" />
          Додати товар
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Всі товари</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16"></TableHead>
                <TableHead>Назва</TableHead>
                <TableHead>Розділ</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products?.map((product) => {
                const images = (product as any).images;
                const firstImage = Array.isArray(images) && images.length > 0 ? images[0] : null;
                return (
                  <TableRow
                    key={product.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleRowClick(product.id)}
                  >
                    <TableCell>
                      {firstImage ? (
                        <img
                          src={firstImage}
                          alt={product.name}
                          className="h-10 w-10 object-cover rounded"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = "/placeholder.svg";
                          }}
                        />
                      ) : (
                        <div className="h-10 w-10 bg-muted rounded flex items-center justify-center">
                          <Image className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{product.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {(product as any).sections?.name || "—"}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          product.is_active
                            ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                            : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400"
                        }`}
                      >
                        {product.is_active ? "Активний" : "Неактивний"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => handleDelete(e, product.id)}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {products?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    Товарів ще немає
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
