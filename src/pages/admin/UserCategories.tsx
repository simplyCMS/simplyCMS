import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ArrowLeft, Plus, Settings, Star } from "lucide-react";

export default function UserCategories() {
  const navigate = useNavigate();

  const { data: categories, isLoading } = useQuery({
    queryKey: ["user-categories-with-counts"],
    queryFn: async () => {
      const { data: cats, error } = await supabase
        .from("user_categories")
        .select("*, price_types:price_type_id(name)")
        .order("name");
      if (error) throw error;

      const { data: profiles } = await supabase.from("profiles").select("category_id");
      const counts = new Map<string, number>();
      profiles?.forEach((p) => {
        if (p.category_id) counts.set(p.category_id, (counts.get(p.category_id) || 0) + 1);
      });

      return cats.map((cat) => ({
        ...cat,
        user_count: counts.get(cat.id) || 0,
        price_type_name: (cat.price_types as any)?.name || null,
      }));
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild><Link to="/admin"><ArrowLeft className="h-5 w-5" /></Link></Button>
          <div>
            <h1 className="text-3xl font-bold">Категорії користувачів</h1>
            <p className="text-muted-foreground">Управління категоріями та правилами переходу</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild><Link to="/admin/user-categories/rules"><Settings className="h-4 w-4 mr-2" />Правила переходу</Link></Button>
          <Button asChild><Link to="/admin/user-categories/new"><Plus className="h-4 w-4 mr-2" />Додати категорію</Link></Button>
        </div>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Назва</TableHead>
              <TableHead>Код</TableHead>
              <TableHead>Вид ціни</TableHead>
              <TableHead className="text-center">Користувачів</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8">Завантаження...</TableCell></TableRow>
            ) : categories?.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8">Категорій не знайдено</TableCell></TableRow>
            ) : (
              categories?.map((cat) => (
                <TableRow key={cat.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/admin/user-categories/${cat.id}`)}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{cat.name}</span>
                      {cat.is_default && <Star className="h-4 w-4 text-warning fill-warning" />}
                    </div>
                    {cat.description && <p className="text-sm text-muted-foreground">{cat.description}</p>}
                  </TableCell>
                  <TableCell><code className="text-sm bg-muted px-2 py-1 rounded">{cat.code}</code></TableCell>
                  <TableCell>
                    {cat.price_type_name ? (
                      <Badge variant="outline">{cat.price_type_name}</Badge>
                    ) : (
                      <span className="text-muted-foreground">За замовч.</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center"><Badge variant="outline">{cat.user_count}</Badge></TableCell>
                  <TableCell className="text-right"><Button variant="ghost" size="sm">Редагувати</Button></TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
