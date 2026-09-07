import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
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
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Loader2, Package, Layers } from "lucide-react";

interface SectionPropertiesManagerProps {
  sectionId: string;
}

const propertyTypes: Record<string, string> = {
  text: "Текст",
  number: "Число",
  select: "Вибір (один)",
  multiselect: "Вибір (декілька)",
  range: "Діапазон",
  color: "Колір",
  boolean: "Так/Ні",
};

export function SectionPropertiesManager({ sectionId }: SectionPropertiesManagerProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedPropertyId, setSelectedPropertyId] = useState("");
  const [appliesTo, setAppliesTo] = useState<"product" | "modification">("product");

  // Fetch assigned properties for this section
  const { data: assignments, isLoading } = useQuery({
    queryKey: ["section-property-assignments", sectionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("section_property_assignments")
        .select(`
          id,
          sort_order,
          applies_to,
          property:property_id (
            id,
            name,
            slug,
            property_type,
            is_filterable,
            is_required
          )
        `)
        .eq("section_id", sectionId)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!sectionId,
  });

  // Fetch all available properties
  const { data: allProperties } = useQuery({
    queryKey: ["all-properties"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("section_properties")
        .select("id, name, slug, property_type")
        .order("name", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  // Separate assignments by type
  const productAssignments = assignments?.filter(a => a.applies_to === "product") || [];
  const modificationAssignments = assignments?.filter(a => a.applies_to === "modification") || [];

  // Get properties that are not yet assigned for the selected type
  const assignedIdsForType = (appliesTo === "product" ? productAssignments : modificationAssignments)
    .map(a => (a.property as any)?.id) || [];
  const availableProperties = allProperties?.filter(p => !assignedIdsForType.includes(p.id)) || [];

  const addMutation = useMutation({
    mutationFn: async ({ propertyId, type }: { propertyId: string; type: string }) => {
      const relevantAssignments = type === "product" ? productAssignments : modificationAssignments;
      const sortOrder = relevantAssignments.length;
      const { error } = await supabase
        .from("section_property_assignments")
        .insert([{ 
          section_id: sectionId, 
          property_id: propertyId, 
          sort_order: sortOrder,
          applies_to: type 
        }]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["section-property-assignments", sectionId] });
      setIsDialogOpen(false);
      setSelectedPropertyId("");
      toast({ title: "Властивість додано" });
    },
    onError: (error) => {
      toast({ variant: "destructive", title: "Помилка", description: error.message });
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (assignmentId: string) => {
      const { error } = await supabase
        .from("section_property_assignments")
        .delete()
        .eq("id", assignmentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["section-property-assignments", sectionId] });
      toast({ title: "Властивість видалено з розділу" });
    },
    onError: (error) => {
      toast({ variant: "destructive", title: "Помилка", description: error.message });
    },
  });

  const handleAdd = () => {
    if (selectedPropertyId) {
      addMutation.mutate({ propertyId: selectedPropertyId, type: appliesTo });
    }
  };

  const openAddDialog = (type: "product" | "modification") => {
    setAppliesTo(type);
    setSelectedPropertyId("");
    setIsDialogOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const renderPropertiesTable = (
    title: string,
    icon: React.ReactNode,
    items: typeof assignments,
    type: "product" | "modification"
  ) => (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          {icon}
          <h4 className="font-semibold">{title}</h4>
          <span className="text-sm text-muted-foreground">({items?.length || 0})</span>
        </div>
        <Button onClick={() => openAddDialog(type)} size="sm" variant="outline">
          <Plus className="h-4 w-4 mr-2" />
          Додати
        </Button>
      </div>

      {items && items.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Назва</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Тип</TableHead>
              <TableHead>Фільтр</TableHead>
              <TableHead className="w-16"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((assignment) => {
              const property = assignment.property as any;
              if (!property) return null;
              return (
                <TableRow key={assignment.id}>
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
                    {propertyTypes[property.property_type] || property.property_type}
                  </TableCell>
                  <TableCell>
                    {property.is_filterable ? (
                      <span className="text-green-600">Так</span>
                    ) : (
                      <span className="text-muted-foreground">Ні</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeMutation.mutate(assignment.id)}
                      disabled={removeMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      ) : (
        <div className="text-center py-6 border rounded-lg bg-muted/30">
          <p className="text-muted-foreground">
            Властивостей ще немає
          </p>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Product Properties */}
        <div className="space-y-4">
          {renderPropertiesTable(
            "Властивості товару",
            <Package className="h-5 w-5 text-primary" />,
            productAssignments,
            "product"
          )}
        </div>

        {/* Modification Properties */}
        <div className="space-y-4">
          {renderPropertiesTable(
            "Властивості модифікацій",
            <Layers className="h-5 w-5 text-orange-500" />,
            modificationAssignments,
            "modification"
          )}
        </div>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Додати властивість для {appliesTo === "product" ? "товарів" : "модифікацій"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Виберіть властивість</Label>
              <Select value={selectedPropertyId} onValueChange={setSelectedPropertyId}>
                <SelectTrigger>
                  <SelectValue placeholder="Оберіть властивість..." />
                </SelectTrigger>
                <SelectContent>
                  {availableProperties.map((prop) => (
                    <SelectItem key={prop.id} value={prop.id}>
                      {prop.name} ({propertyTypes[prop.property_type] || prop.property_type})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {availableProperties.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Всі властивості вже додано
                </p>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Скасувати
              </Button>
              <Button 
                onClick={handleAdd} 
                disabled={!selectedPropertyId || addMutation.isPending}
              >
                {addMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Додати
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
