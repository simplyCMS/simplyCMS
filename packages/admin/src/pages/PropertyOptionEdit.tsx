import { useState } from 'react';
import { useParams, useNavigate } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSupabaseClient } from 'simplycms/supabase/SupabaseProvider';
import { Button } from '@simplycms/ui/button';
import { Input } from '@simplycms/ui/input';
import { Textarea } from '@simplycms/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@simplycms/ui/card';
import { Label } from '@simplycms/ui/label';
import { useToast } from '@simplycms/core/hooks/use-toast';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';
import { ImageUpload } from '../components/ImageUpload';
import { RichTextEditor } from '../components/RichTextEditor';
import { adminPath } from '../lib/adminLinks';
import { useT } from 'simplycms/i18n';

function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9а-яіїєґ\s-]/gi, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

export default function PropertyOptionEdit() {
  const t = useT();
  const supabase = useSupabaseClient();
  const { propertyId, optionId } = useParams({ strict: false }) as {
    propertyId: string;
    optionId: string;
  };
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const isNew = optionId === 'new';

  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    sort_order: 0,
    description: '',
    image_url: '',
    meta_title: '',
    meta_description: '',
  });

  // Fetch property info
  const { data: property } = useQuery({
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

  // Fetch existing option
  const { data: option, isLoading: optionLoading } = useQuery({
    queryKey: ['property-option', optionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('property_options')
        .select('*')
        .eq('id', optionId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !isNew && !!optionId,
  });

  // Get next sort order for new options
  const { data: optionsCount } = useQuery({
    queryKey: ['property-options-count', propertyId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('property_options')
        .select('*', { count: 'exact', head: true })
        .eq('property_id', propertyId!);
      if (error) throw error;
      return count || 0;
    },
    enabled: isNew && !!propertyId,
  });

  // Ініціалізація форми при завантаженні даних (adjust state during render)
  const [prevOptionId, setPrevOptionId] = useState<string | null>(null);
  const [prevOptionsCount, setPrevOptionsCount] = useState<number | undefined>(
    undefined,
  );
  if (option && option.id !== prevOptionId) {
    setPrevOptionId(option.id);
    setFormData({
      name: option.name || '',
      slug: option.slug || '',
      sort_order: option.sort_order || 0,
      description: option.description || '',
      image_url: option.image_url || '',
      meta_title: option.meta_title || '',
      meta_description: option.meta_description || '',
    });
  } else if (
    isNew &&
    optionsCount !== undefined &&
    optionsCount !== prevOptionsCount
  ) {
    setPrevOptionsCount(optionsCount);
    setFormData((prev) => ({ ...prev, sort_order: optionsCount }));
  }

  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const payload = {
        name: data.name,
        slug: data.slug || generateSlug(data.name),
        sort_order: data.sort_order,
        description: data.description || null,
        image_url: data.image_url || null,
        meta_title: data.meta_title || null,
        meta_description: data.meta_description || null,
      };

      // Check if this is a new option - optionId is "new" string from URL params
      const isCreating = !optionId || optionId === 'new';

      if (isCreating) {
        const { data: newOption, error } = await supabase
          .from('property_options')
          .insert([{ ...payload, property_id: propertyId }])
          .select()
          .single();
        if (error) throw error;
        return newOption;
      } else {
        const { error } = await supabase
          .from('property_options')
          .update(payload)
          .eq('id', optionId);
        if (error) throw error;
        return { id: optionId };
      }
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({
        queryKey: ['property-options', propertyId],
      });
      const wasCreating = !optionId || optionId === 'new';
      if (!wasCreating) {
        queryClient.invalidateQueries({
          queryKey: ['property-option', optionId],
        });
      }
      toast({
        title: t(
          wasCreating
            ? 'admin.properties.options.created'
            : 'admin.properties.options.saved',
        ),
      });

      if (wasCreating && result?.id) {
        navigate({
          to: adminPath(`properties/${propertyId}/options/${result.id}`),
          replace: true,
        });
      }
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
    saveMutation.mutate(formData);
  };

  const handleChange = (
    field: keyof typeof formData,
    value: string | number,
  ) => {
    setFormData((prev) => {
      const newData = { ...prev, [field]: value };
      if (field === 'name' && isNew) {
        newData.slug = generateSlug(value as string);
      }
      return newData;
    });
  };

  const goBack = () => {
    navigate({ to: adminPath(`properties/${propertyId}`) });
  };

  if (optionLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={goBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">
            {isNew
              ? t('admin.properties.options.new')
              : option?.name || t('admin.properties.options.fallbackTitle')}
          </h1>
          {property && (
            <p className="text-muted-foreground">
              {t('admin.properties.options.parent')} {property.name}
            </p>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>{t('common.basicInfo')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">{t('common.nameRequiredLabel')}</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  placeholder="Samsung"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="slug">Slug (URL)</Label>
                <Input
                  id="slug"
                  value={formData.slug}
                  onChange={(e) => handleChange('slug', e.target.value)}
                  placeholder="samsung"
                />
                <p className="text-xs text-muted-foreground">
                  {t('admin.properties.options.slugHint')}
                </p>
              </div>
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
                className="w-32"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('admin.properties.options.pageSection')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>{t('common.image')}</Label>
              <ImageUpload
                images={formData.image_url ? [formData.image_url] : []}
                onImagesChange={(urls) =>
                  handleChange('image_url', urls[0] || '')
                }
                maxImages={1}
              />
            </div>

            <div className="space-y-2">
              <Label>{t('common.description')}</Label>
              <RichTextEditor
                content={formData.description}
                onChange={(value) => handleChange('description', value)}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>SEO</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="meta_title">Meta Title</Label>
              <Input
                id="meta_title"
                value={formData.meta_title}
                onChange={(e) => handleChange('meta_title', e.target.value)}
                placeholder={t('admin.properties.options.seoTitlePlaceholder')}
              />
              <p className="text-xs text-muted-foreground">
                {formData.meta_title.length}
                {t('admin.properties.options.titleCounter')}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="meta_description">Meta Description</Label>
              <Textarea
                id="meta_description"
                value={formData.meta_description}
                onChange={(e) =>
                  handleChange('meta_description', e.target.value)
                }
                placeholder={t('common.seoDescription')}
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                {formData.meta_description.length}
                {t('admin.properties.options.descriptionCounter')}
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={goBack}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" disabled={saveMutation.isPending}>
            {saveMutation.isPending && (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            )}
            <Save className="h-4 w-4 mr-2" />
            {t('common.save')}
          </Button>
        </div>
      </form>
    </div>
  );
}
