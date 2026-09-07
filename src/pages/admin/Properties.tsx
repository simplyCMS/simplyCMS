import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Loader2 } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type SectionProperty = Tables<"section_properties">;

const propertyTypes = [
  { value: "text", label: "Текст" },
  { value: "number", label: "Число" },
  { value: "select", label: "Вибір (один)" },
  { value: "multiselect", label: "Вибір (декілька)" },
  { value: "range", label: "Діапазон" },
  { value: "color", label: "Колір" },
  { value: "boolean", label: "Так/Ні" },
];

export default function Properties() {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [propertyType, setPropertyType] = useState<string>("text");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch all properties (global, not section-specific)
  const { data: properties, isLoading } = useQuery({
    queryKey: ["all-properties"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("section_properties")
        .select("*")
        .order("name", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: Partial<SectionProperty>) => {
      const { error } = await supabase.from("section_properties").insert([data as any]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-properties"] });
      closeDialog();
      toast({ title: "Властивість створено" });
    },
    onError: (error) => {
      toast({ variant: "destructive", title: "Помилка", description: error.message });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("section_properties").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-properties"] });
      toast({ title: "Властивість видалено" });
    },
    onError: (error) => {
      toast({ variant: "destructive", title: "Помилка", description: error.message });
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const data = {
      name: formData.get("name") as string,
      slug: formData.get("slug") as string,
      property_type: propertyType as any,
      is_required: formData.get("is_required") === "on",
      is_filterable: formData.get("is_filterable") === "on",
      has_page: formData.get("has_page") === "on",
      sort_order: parseInt(formData.get("sort_order") as string) || 0,
      section_id: null, // Global property
    };

    createMutation.mutate(data);
  };

  const closeDialog = () => {
    setIsOpen(false);
    setPropertyType("text");
  };

  const openCreate = () => {
    setPropertyType("text");
    setIsOpen(true);
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
          <h1 className="text-3xl font-bold">Властивості</h1>
          <p className="text-muted-foreground">Глобальні властивості для товарів</p>
        </div>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Додати властивість
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Нова властивість</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Назва</Label>
                  <Input
                    id="name"
                    name="name"
                    placeholder="Виробник"
                    required
                  />
                </div>
              <div className="space-y-2">
                  <Label htmlFor="slug">Slug</Label>
                  <Input
                    id="slug"
                    name="slug"
                    placeholder="manufacturer"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Тип властивості</Label>
                <Select value={propertyType} onValueChange={setPropertyType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {propertyTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="sort_order">Порядок сортування</Label>
                <Input
                  id="sort_order"
                  name="sort_order"
                  type="number"
                  defaultValue={0}
                />
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Switch id="is_required" name="is_required" />
                  <Label htmlFor="is_required">Обов'язкова</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch id="is_filterable" name="is_filterable" />
                  <Label htmlFor="is_filterable">Показувати у фільтрах</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch id="has_page" name="has_page" />
                  <Label htmlFor="has_page">Створювати сторінки для значень</Label>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={closeDialog}>
                  Скасувати
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  Створити
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Всі властивості</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Назва</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Тип</TableHead>
                <TableHead>Фільтр</TableHead>
                <TableHead className="text-right">Дії</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {properties?.map((property) => (
                <TableRow 
                  key={property.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => navigate(`/admin/properties/${property.id}`)}
                >
                  <TableCell className="font-medium">
                    {property.name}
                    {property.is_required && (
                      <span className="text-destructive ml-1">*</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground font-mono text-sm">
                    {property.slug}
                  </TableCell>
                  <TableCell>
                    {propertyTypes.find(t => t.value === property.property_type)?.label}
                  </TableCell>
                  <TableCell>
                    {property.is_filterable ? (
                      <span className="text-green-600">Так</span>
                    ) : (
                      <span className="text-muted-foreground">Ні</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm("Видалити цю властивість?")) {
                          deleteMutation.mutate(property.id);
                        }
                      }}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {properties?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    Властивостей ще немає
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
