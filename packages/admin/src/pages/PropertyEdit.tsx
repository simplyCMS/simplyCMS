import { useState } from 'react';
import { useParams, useNavigate } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSupabaseClient } from 'simplycms/supabase/SupabaseProvider';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@simplycms/ui/select';
import { Label } from '@simplycms/ui/label';
import { Switch } from '@simplycms/ui/switch';
import { useToast } from '@simplycms/core/hooks/use-toast';
import {
  ArrowLeft,
  Save,
  Loader2,
  Plus,
  Trash2,
  GripVertical,
} from 'lucide-react';
import { adminPath } from '../lib/adminLinks';
import type { Tables } from 'simplycms/supabase';
import { useT, type MessageKey } from 'simplycms/i18n';

type SectionProperty = Tables<'section_properties'>;

interface PropertyOption {
  id: string;
  property_id: string;
  name: string;
  slug: string;
  sort_order: number;
  description: string | null;
  image_url: string | null;
  meta_title: string | null;
  meta_description: string | null;
  created_at: string;
}

// Мапа ключів — та сама розкладка, що у списку властивостей.
const propertyTypes: { value: string; labelKey: MessageKey }[] = [
  { value: 'text', labelKey: 'admin.properties.type.text' },
  { value: 'number', labelKey: 'admin.properties.type.number' },
  { value: 'select', labelKey: 'admin.properties.type.select' },
  { value: 'multiselect', labelKey: 'admin.properties.type.multiselect' },
  { value: 'range', labelKey: 'admin.properties.type.range' },
  { value: 'color', labelKey: 'admin.properties.type.color' },
  { value: 'boolean', labelKey: 'admin.properties.type.boolean' },
];

export default function PropertyEdit() {
  const t = useT();
  const supabase = useSupabaseClient();
  const { propertyId } = useParams({ strict: false }) as { propertyId: string };
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    property_type: 'text' as string,
    is_required: false,
    is_filterable: false,
    has_page: false,
    sort_order: 0,
  });

  // Fetch property
  const { data: property, isLoading: propertyLoading } = useQuery({
    queryKey: ['property', propertyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('section_properties')
        .select('*')
        .eq('id', propertyId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!propertyId,
  });

  // Fetch options
  const { data: options, isLoading: optionsLoading } = useQuery({
    queryKey: ['property-options', propertyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('property_options')
        .select('*')
        .eq('property_id', propertyId!)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return data as PropertyOption[];
    },
    enabled: !!propertyId,
  });

  // Ініціалізація форми при завантаженні даних (adjust state during render)
  const [prevPropertyId, setPrevPropertyId] = useState<string | null>(null);
  if (property && property.id !== prevPropertyId) {
    setPrevPropertyId(property.id);
    setFormData({
      name: property.name || '',
      slug: property.slug || '',
      property_type: property.property_type || 'text',
      is_required: property.is_required ?? false,
      is_filterable: property.is_filterable ?? false,
      has_page: property.has_page ?? false,
      sort_order: property.sort_order || 0,
    });
  }

  // Property mutations
  const updatePropertyMutation = useMutation({
    mutationFn: async (data: Partial<SectionProperty>) => {
      const { error } = await supabase
        .from('section_properties')
        .update(data)
        .eq('id', propertyId!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['property', propertyId] });
      queryClient.invalidateQueries({ queryKey: ['all-properties'] });
      toast({ title: t('admin.properties.saved') });
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: t('common.error'),
        description: error.message,
      });
    },
  });

  const deleteOptionMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('property_options')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['property-options', propertyId],
      });
      toast({ title: t('admin.properties.options.deleted') });
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: t('common.error'),
        description: error.message,
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updatePropertyMutation.mutate({
      ...formData,
      property_type: formData.property_type as SectionProperty['property_type'],
    });
  };

  const handleChange = (
    field: keyof typeof formData,
    value: string | number | boolean,
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const showOptions =
    formData.property_type === 'select' ||
    formData.property_type === 'multiselect';

  if (propertyLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate({ to: adminPath('properties') })}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">
            {property?.name || t('admin.properties.fallbackTitle')}
          </h1>
          <p className="text-muted-foreground">
            {t('admin.properties.editTitle')}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>{t('common.basicInfo')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">{t('common.name')}</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="slug">Slug</Label>
                <Input
                  id="slug"
                  value={formData.slug}
                  onChange={(e) => handleChange('slug', e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('admin.properties.typeLabel')}</Label>
                <Select
                  value={formData.property_type}
                  onValueChange={(v) => handleChange('property_type', v)}
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
                  type="number"
                  value={formData.sort_order}
                  onChange={(e) =>
                    handleChange('sort_order', parseInt(e.target.value) || 0)
                  }
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-6 pt-2">
              <div className="flex items-center gap-2">
                <Switch
                  id="is_required"
                  checked={formData.is_required}
                  onCheckedChange={(v) => handleChange('is_required', v)}
                />
                <Label htmlFor="is_required">
                  {t('admin.properties.required')}
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="is_filterable"
                  checked={formData.is_filterable}
                  onCheckedChange={(v) => handleChange('is_filterable', v)}
                />
                <Label htmlFor="is_filterable">
                  {t('admin.properties.showInFilters')}
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="has_page"
                  checked={formData.has_page}
                  onCheckedChange={(v) => handleChange('has_page', v)}
                />
                <Label htmlFor="has_page">
                  {t('admin.properties.hasPage')}
                </Label>
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <Button type="submit" disabled={updatePropertyMutation.isPending}>
                {updatePropertyMutation.isPending && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                <Save className="h-4 w-4 mr-2" />
                {t('common.save')}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>

      {showOptions && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{t('admin.properties.options.title')}</CardTitle>
            <Button
              onClick={() =>
                navigate({
                  to: adminPath(`properties/${propertyId}/options/new`),
                })
              }
              size="sm"
            >
              <Plus className="h-4 w-4 mr-2" />
              {t('admin.properties.options.add')}
            </Button>
          </CardHeader>
          <CardContent>
            {optionsLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <TableHead>{t('common.name')}</TableHead>
                    <TableHead>Slug</TableHead>
                    <TableHead>{t('admin.properties.options.page')}</TableHead>
                    <TableHead className="text-right w-16">
                      {t('common.actions')}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {options?.map((option) => (
                    <TableRow
                      key={option.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() =>
                        navigate({
                          to: adminPath(
                            `properties/${propertyId}/options/${option.id}`,
                          ),
                        })
                      }
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <GripVertical className="h-4 w-4 text-muted-foreground" />
                      </TableCell>
                      <TableCell className="font-medium">
                        {option.name}
                      </TableCell>
                      <TableCell className="text-muted-foreground font-mono text-sm">
                        {option.slug}
                      </TableCell>
                      <TableCell>
                        {option.description || option.image_url ? (
                          <span className="text-xs px-2 py-1 bg-primary/10 text-primary rounded">
                            {t('admin.properties.options.filled')}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            —
                          </span>
                        )}
                      </TableCell>
                      <TableCell
                        className="text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            if (
                              confirm(
                                t('admin.properties.options.confirmDelete'),
                              )
                            ) {
                              deleteOptionMutation.mutate(option.id);
                            }
                          }}
                          disabled={deleteOptionMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {options?.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="text-center text-muted-foreground"
                      >
                        {t('admin.properties.options.empty')}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
