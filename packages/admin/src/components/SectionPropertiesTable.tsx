import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSupabaseClient } from 'simplycms/supabase/SupabaseProvider';
import { useT, type MessageKey } from 'simplycms/i18n';
import { Button } from '@simplycms/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@simplycms/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@simplycms/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@simplycms/ui/select';
import { Label } from '@simplycms/ui/label';
import { useToast } from '@simplycms/core/hooks/use-toast';
import { Plus, Trash2, Loader2 } from 'lucide-react';

/** Тип для join-результату property з section_property_assignments */
interface PropertyJoin {
  id: string;
  name: string;
  slug: string;
  property_type: string;
  is_filterable: boolean;
  is_required: boolean;
}

interface SectionPropertiesTableProps {
  sectionId: string;
}

// Мапа КЛЮЧІВ: код типу приходить із БД, тож розкладка лишається на рівні
// модуля, а підпис резолвиться в рендері.
const propertyTypes: Record<string, MessageKey> = {
  text: 'admin.properties.type.text',
  number: 'admin.properties.type.number',
  select: 'admin.properties.type.select',
  multiselect: 'admin.properties.type.multiselect',
  range: 'admin.properties.type.range',
  color: 'admin.properties.type.color',
  boolean: 'admin.properties.type.boolean',
};

export function SectionPropertiesTable({
  sectionId,
}: SectionPropertiesTableProps) {
  const t = useT();
  const supabase = useSupabaseClient();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedPropertyId, setSelectedPropertyId] = useState('');

  // Fetch assigned properties for this section
  const { data: assignments, isLoading: assignmentsLoading } = useQuery({
    queryKey: ['section-property-assignments', sectionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('section_property_assignments')
        .select(
          `
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
        `,
        )
        .eq('section_id', sectionId)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!sectionId,
  });

  // Fetch all available properties
  const { data: allProperties } = useQuery({
    queryKey: ['all-properties'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('section_properties')
        .select('id, name, slug, property_type')
        .order('name', { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  // Get properties that are not yet assigned
  const assignedIds =
    assignments?.map((a) => (a.property as PropertyJoin | null)?.id) || [];
  const availableProperties =
    allProperties?.filter((p) => !assignedIds.includes(p.id)) || [];

  const addMutation = useMutation({
    mutationFn: async (propertyId: string) => {
      const sortOrder = assignments?.length || 0;
      const { error } = await supabase
        .from('section_property_assignments')
        .insert([
          {
            section_id: sectionId,
            property_id: propertyId,
            sort_order: sortOrder,
          },
        ]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['section-property-assignments', sectionId],
      });
      setIsDialogOpen(false);
      setSelectedPropertyId('');
      toast({ title: t('admin.properties.section.added') });
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: t('common.error'),
        description: error.message,
      });
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (assignmentId: string) => {
      const { error } = await supabase
        .from('section_property_assignments')
        .delete()
        .eq('id', assignmentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['section-property-assignments', sectionId],
      });
      toast({ title: t('admin.properties.section.removed') });
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: t('common.error'),
        description: error.message,
      });
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
        <h3 className="text-lg font-semibold">
          {t('admin.properties.section.title')}
        </h3>
        <Button
          onClick={() => setIsDialogOpen(true)}
          size="sm"
          disabled={availableProperties.length === 0}
        >
          <Plus className="h-4 w-4 mr-2" />
          {t('common.add')}
        </Button>
      </div>

      {assignments && assignments.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('common.name')}</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>{t('common.type')}</TableHead>
              <TableHead>{t('common.filter')}</TableHead>
              <TableHead className="w-16"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {assignments.map((assignment) => {
              const property = assignment.property as PropertyJoin | null;
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
                    {propertyTypes[property.property_type]
                      ? t(propertyTypes[property.property_type])
                      : property.property_type}
                  </TableCell>
                  <TableCell>
                    {property.is_filterable ? (
                      <span className="text-green-600">{t('common.yes')}</span>
                    ) : (
                      <span className="text-muted-foreground">
                        {t('common.no')}
                      </span>
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
          {t('admin.properties.section.empty')}
        </p>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t('admin.properties.section.addToSection')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t('admin.properties.section.pickProperty')}</Label>
              <Select
                value={selectedPropertyId}
                onValueChange={setSelectedPropertyId}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={t(
                      'admin.properties.section.pickPropertyPlaceholder',
                    )}
                  />
                </SelectTrigger>
                <SelectContent>
                  {availableProperties.map((prop) => (
                    <SelectItem key={prop.id} value={prop.id}>
                      {prop.name} (
                      {propertyTypes[prop.property_type]
                        ? t(propertyTypes[prop.property_type])
                        : prop.property_type}
                      )
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button
                onClick={handleAdd}
                disabled={!selectedPropertyId || addMutation.isPending}
              >
                {addMutation.isPending && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                {t('common.add')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
