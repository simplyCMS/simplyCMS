import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Plus, Trash2, Star, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function PriceTypes() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: priceTypes, isLoading } = useQuery({
    queryKey: ["admin-price-types"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("price_types")
        .select("*")
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("price_types").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-price-types"] });
      toast({ title: "Вид ціни видалено" });
    },
    onError: (error) => {
      toast({ variant: "destructive", title: "Помилка", description: error.message });
    },
  });

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Види цін</h1>
          <p className="text-muted-foreground">Управління видами цін для товарів</p>
        </div>
        <Button onClick={() => navigate("/admin/price-types/new")}>
          <Plus className="h-4 w-4 mr-2" />
          Додати вид ціни
        </Button>
      </div>
      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Назва</TableHead>
                <TableHead>Код</TableHead>
                <TableHead>Порядок</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {priceTypes?.map((pt) => (
                <TableRow key={pt.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/admin/price-types/${pt.id}`)}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{pt.name}</span>
                      {pt.is_default && <Star className="h-4 w-4 text-warning fill-warning" />}
                    </div>
                  </TableCell>
                  <TableCell><code className="text-sm bg-muted px-2 py-1 rounded">{pt.code}</code></TableCell>
                  <TableCell>{pt.sort_order}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" disabled={pt.is_default || deleteMutation.isPending} onClick={(e) => { e.stopPropagation(); if (confirm("Видалити цей вид ціни?")) deleteMutation.mutate(pt.id); }}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {priceTypes?.length === 0 && (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Видів цін ще немає</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
