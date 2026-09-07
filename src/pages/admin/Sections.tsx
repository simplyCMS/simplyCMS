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

export default function Sections() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: sections, isLoading } = useQuery({
    queryKey: ["admin-sections"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sections")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("sections").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-sections"] });
      toast({ title: "Розділ видалено" });
    },
    onError: (error) => {
      toast({ variant: "destructive", title: "Помилка", description: error.message });
    },
  });

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
          <h1 className="text-3xl font-bold">Розділи</h1>
          <p className="text-muted-foreground">Керування розділами каталогу</p>
        </div>
        <Button onClick={() => navigate("/admin/sections/new")}>
          <Plus className="h-4 w-4 mr-2" />
          Додати розділ
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Всі розділи</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16"></TableHead>
                <TableHead>Назва</TableHead>
                <TableHead>URL</TableHead>
                <TableHead>Порядок</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead className="text-right">Дії</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sections?.map((section) => (
                <TableRow 
                  key={section.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => navigate(`/admin/sections/${section.id}`)}
                >
                  <TableCell>
                    {section.image_url ? (
                      <img
                        src={section.image_url}
                        alt={section.name}
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
                  <TableCell className="font-medium">{section.name}</TableCell>
                  <TableCell className="text-muted-foreground">{section.slug}</TableCell>
                  <TableCell>{section.sort_order}</TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        section.is_active
                          ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                          : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400"
                      }`}
                    >
                      {section.is_active ? "Активний" : "Неактивний"}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm("Видалити цей розділ?")) {
                          deleteMutation.mutate(section.id);
                        }
                      }}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {sections?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    Розділів ще немає
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
