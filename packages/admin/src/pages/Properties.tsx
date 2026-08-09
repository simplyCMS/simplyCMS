import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminPath } from '../lib/adminLinks';
import { useSupabaseClient } from '@simplycms/supabase/SupabaseProvider';
import { Button } from '@simplycms/ui/button';
import { Input } from '@simplycms/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@simplycms/ui/card';
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
  DialogTrigger,
} from '@simplycms/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@simplycms/ui/select';
import { Label } from '@simplycms/ui/label';
import { Switch } from '@simplycms/ui/switch';
import { useToast } from '@simplycms/core/hooks/use-toast';
import { Plus, Trash2, Loader2 } from 'lucide-react';
import type { TablesInsert, Enums } from '@simplycms/supabase';
import { useT, type MessageKey } from '@simplycms/i18n';

// Код типу приходить із БД (enum `property_type`), тож мапа лишається на рівні
// модуля й тримає КЛЮЧІ — підпис резолвиться в рендері.
const propertyTypes: { value: string; labelKey: MessageKey }[] = [
  { value: 'text', labelKey: 'admin.properties.type.text' },
  { value: 'number', labelKey: 'admin.properties.type.number' },
  { value: 'select', labelKey: 'admin.properties.type.select' },
  { value: 'multiselect', labelKey: 'admin.properties.type.multiselect' },
  { value: 'range', labelKey: 'admin.properties.type.range' },
  { value: 'color', labelKey: 'admin.properties.type.color' },
  { value: 'boolean', labelKey: 'admin.properties.type.boolean' },
];

export default function Properties() {
  const t = useT();
  const supabase = useSupabaseClient();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [propertyType, setPropertyType] =
    useState<Enums<'property_type'>>('text');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch all properties (global, not section-specific)
  const { data: properties, isLoading } = useQuery({
    queryKey: ['all-properties'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('section_properties')
        .select('*')
        .order('name', { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: TablesInsert<'section_properties'>) => {
      const { error } = await supabase
        .from('section_properties')
        .insert([data]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-properties'] });
      closeDialog();
      toast({ title: t('admin.properties.created') });
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: t('common.error'),
        description: error.message,
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('section_properties')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-properties'] });
      toast({ title: t('admin.properties.deleted') });
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: t('common.error'),
        description: error.message,
      });
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const data = {
      name: formData.get('name') as string,
      slug: formData.get('slug') as string,
      property_type: propertyType,
      is_required: formData.get('is_required') === 'on',
      is_filterable: formData.get('is_filterable') === 'on',
      has_page: formData.get('has_page') === 'on',
      sort_order: parseInt(formData.get('sort_order') as string) || 0,
      section_id: null, // Global property
    };

    createMutation.mutate(data);
  };

  const closeDialog = () => {
    setIsOpen(false);
    setPropertyType('text');
  };

  const openCreate = () => {
    setPropertyType('text');
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
          <h1 className="text-3xl font-bold">{t('admin.nav.properties')}</h1>
          <p className="text-muted-foreground">
            {t('admin.properties.subtitle')}
          </p>
        </div>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4 mr-2" />
              {t('admin.properties.add')}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{t('admin.properties.new')}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">{t('common.name')}</Label>
                  <Input
                    id="name"
                    name="name"
                    placeholder={t('admin.properties.namePlaceholder')}
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
                <Label>{t('admin.properties.typeLabel')}</Label>
                <Select
                  value={propertyType}
                  onValueChange={(v) =>
                    setPropertyType(v as Enums<'property_type'>)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {propertyTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {t(type.labelKey)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="sort_order">{t('common.sortOrder')}</Label>
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
                  <Label htmlFor="is_required">
                    {t('admin.properties.required')}
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch id="is_filterable" name="is_filterable" />
                  <Label htmlFor="is_filterable">
                    {t('admin.properties.showInFilters')}
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch id="has_page" name="has_page" />
                  <Label htmlFor="has_page">
                    {t('admin.properties.hasPage')}
                  </Label>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={closeDialog}>
                  {t('common.cancel')}
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  {t('common.create')}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('admin.properties.all')}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('common.name')}</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>{t('common.type')}</TableHead>
                <TableHead>{t('common.filter')}</TableHead>
                <TableHead className="text-right">
                  {t('common.actions')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {properties?.map((property) => (
                <TableRow
                  key={property.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() =>
                    navigate({ to: adminPath(`properties/${property.id}`) })
                  }
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
                    {(() => {
                      const type = propertyTypes.find(
                        (candidate) =>
                          candidate.value === property.property_type,
                      );
                      return type ? t(type.labelKey) : null;
                    })()}
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
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(t('admin.properties.confirmDelete'))) {
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
                  <TableCell
                    colSpan={5}
                    className="text-center text-muted-foreground"
                  >
                    {t('admin.properties.empty')}
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
