import { useState } from 'react';
import { useParams, useNavigate } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSupabaseClient } from 'simplycms/supabase/SupabaseProvider';
import { useT } from 'simplycms/i18n';
import { Button } from '@simplycms/ui/button';
import { Input } from '@simplycms/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@simplycms/ui/card';
import { Label } from '@simplycms/ui/label';
import { Switch } from '@simplycms/ui/switch';
import { Separator } from '@simplycms/ui/separator';
import { useToast } from '@simplycms/core/hooks/use-toast';
import { ArrowLeft, Loader2, Save } from 'lucide-react';
import { ImageUpload } from '../components/ImageUpload';
import { RichTextEditor } from '../components/RichTextEditor';
import { SectionPropertiesManager } from '../components/SectionPropertiesManager';
import { adminPath } from '../lib/adminLinks';

export default function SectionEdit() {
  const t = useT();
  const supabase = useSupabaseClient();
  const { sectionId } = useParams({ strict: false }) as { sectionId: string };
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isNew = sectionId === 'new';

  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    meta_title: '',
    meta_description: '',
    sort_order: 0,
    is_active: true,
  });
  const [sectionImage, setSectionImage] = useState<string[]>([]);

  // Fetch section data
  const { data: section, isLoading } = useQuery({
    queryKey: ['section', sectionId],
    queryFn: async () => {
      if (isNew) return null;
      const { data, error } = await supabase
        .from('sections')
        .select('*')
        .eq('id', sectionId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !isNew,
  });

  // Ініціалізація форми при завантаженні даних (adjust state during render)
  const [prevSectionId, setPrevSectionId] = useState<string | null>(null);
  if (section && section.id !== prevSectionId) {
    setPrevSectionId(section.id);
    setFormData({
      name: section.name || '',
      slug: section.slug || '',
      description: section.description || '',
      meta_title: section.meta_title || '',
      meta_description: section.meta_description || '',
      sort_order: section.sort_order || 0,
      is_active: section.is_active ?? true,
    });
    setSectionImage(section.image_url ? [section.image_url] : []);
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const data = {
        name: formData.name,
        slug: formData.slug,
        description: formData.description || null,
        meta_title: formData.meta_title || null,
        meta_description: formData.meta_description || null,
        image_url: sectionImage.length > 0 ? sectionImage[0] : null,
        is_active: formData.is_active,
        sort_order: formData.sort_order,
      };

      if (isNew) {
        const { error } = await supabase.from('sections').insert([data]);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('sections')
          .update(data)
          .eq('id', sectionId);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-sections'] });
      queryClient.invalidateQueries({ queryKey: ['section', sectionId] });
      toast({
        title: isNew ? t('admin.sections.created') : t('admin.sections.saved'),
      });
      if (isNew) {
        navigate({ to: adminPath('sections') });
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

  const handleChange = (field: string, value: string | number | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate();
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate({ to: adminPath('sections') })}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">
              {isNew
                ? t('admin.sections.new')
                : formData.name || t('admin.sections.editTitle')}
            </h1>
            <p className="text-muted-foreground">
              {isNew
                ? t('admin.sections.newSubtitle')
                : t('admin.sections.editTitle')}
            </p>
          </div>
        </div>
        <Button onClick={handleSubmit} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          {t('common.save')}
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Main Info */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
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
                    <Label htmlFor="slug">URL (slug)</Label>
                    <Input
                      id="slug"
                      value={formData.slug}
                      onChange={(e) => handleChange('slug', e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">{t('common.description')}</Label>
                  <RichTextEditor
                    content={formData.description}
                    onChange={(content) => handleChange('description', content)}
                    placeholder={t('admin.sections.descriptionPlaceholder')}
                  />
                </div>
              </CardContent>
            </Card>

            {/* SEO */}
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
                    placeholder={t('admin.sections.seoTitlePlaceholder')}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="meta_description">Meta Description</Label>
                  <Input
                    id="meta_description"
                    value={formData.meta_description}
                    onChange={(e) =>
                      handleChange('meta_description', e.target.value)
                    }
                    placeholder={t('common.seoDescription')}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>{t('admin.nav.settings')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="is_active">{t('common.activeM')}</Label>
                  <Switch
                    id="is_active"
                    checked={formData.is_active}
                    onCheckedChange={(checked) =>
                      handleChange('is_active', checked)
                    }
                  />
                </div>
                <Separator />
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
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t('common.image')}</CardTitle>
              </CardHeader>
              <CardContent>
                <ImageUpload
                  images={sectionImage}
                  onImagesChange={setSectionImage}
                  folder="sections"
                  maxImages={1}
                />
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Properties Section - only for existing sections */}
        {!isNew && sectionId && (
          <Card>
            <CardHeader>
              <CardTitle>{t('admin.properties.section.title')}</CardTitle>
              <p className="text-sm text-muted-foreground">
                {t('admin.sections.propertiesHint')}
              </p>
            </CardHeader>
            <CardContent>
              <SectionPropertiesManager sectionId={sectionId} />
            </CardContent>
          </Card>
        )}
      </form>
    </div>
  );
}
