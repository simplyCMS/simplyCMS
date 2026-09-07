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
import { Plus, Trash2, Loader2 } from "lucide-react";

interface SectionPropertiesTableProps {
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

export function SectionPropertiesTable({ sectionId }: SectionPropertiesTableProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedPropertyId, setSelectedPropertyId] = useState("");

  // Fetch assigned properties for this section
  const { data: assignments, isLoading: assignmentsLoading } = useQuery({
    queryKey: ["section-property-assignments", sectionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("section_property_assignments")
        .select(`
          id,
          sort_order,
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

  // Get properties that are not yet assigned
  const assignedIds = assignments?.map(a => (a.property as any)?.id) || [];
  const availableProperties = allProperties?.filter(p => !assignedIds.includes(p.id)) || [];

  const addMutation = useMutation({
    mutationFn: async (propertyId: string) => {
      const sortOrder = assignments?.length || 0;
      const { error } = await supabase
        .from("section_property_assignments")
        .insert([{ section_id: sectionId, property_id: propertyId, sort_order: sortOrder }]);
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
      addMutation.mutate(selectedPropertyId);
    }
  };

  if (assignmentsLoading) {
    return (
      <div className="flex justify-center py-4">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Властивості розділу</h3>
        <Button onClick={() => setIsDialogOpen(true)} size="sm" disabled={availableProperties.length === 0}>
          <Plus className="h-4 w-4 mr-2" />
          Додати
        </Button>
      </div>

      {assignments && assignments.length > 0 ? (
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
            {assignments.map((assignment) => {
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
        <p className="text-muted-foreground text-center py-4">
          Властивостей ще немає. Додайте властивості до розділу.
        </p>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Додати властивість до розділу</DialogTitle>
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
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Скасувати
              </Button>
              <Button onClick={handleAdd} disabled={!selectedPropertyId || addMutation.isPending}>
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
