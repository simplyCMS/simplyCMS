import { useState } from 'react';
import { useParams, useNavigate } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSupabaseClient } from '@simplycms/supabase/SupabaseProvider';
import { useT } from '@simplycms/i18n';
import { Button } from '@simplycms/ui/button';
import { Input } from '@simplycms/ui/input';
import { Label } from '@simplycms/ui/label';
import { Textarea } from '@simplycms/ui/textarea';
import { Switch } from '@simplycms/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@simplycms/ui/card';
import { Separator } from '@simplycms/ui/separator';
import { RadioGroup, RadioGroupItem } from '@simplycms/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@simplycms/ui/select';
import { useToast } from '@simplycms/core/hooks/use-toast';
import { ArrowLeft, Loader2, Save } from 'lucide-react';
import { ImageUpload } from '../components/ImageUpload';
import { RichTextEditor } from '../components/RichTextEditor';
import { ProductPropertyValues } from '../components/ProductPropertyValues';
import { ProductModifications } from '../components/ProductModifications';
import { SimpleProductFields } from '../components/SimpleProductFields';
import { AllProductProperties } from '../components/AllProductProperties';
import type { TablesInsert, TablesUpdate } from '@simplycms/supabase';
import { PluginSlot } from '@simplycms/plugins/PluginSlot';
import { adminPath } from '../lib/adminLinks';

export default function ProductEdit() {
  const t = useT();
  const supabase = useSupabaseClient();
  const { productId } = useParams({ strict: false }) as { productId: string };
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isNew = productId === 'new';

  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    short_description: '',
    description: '',
    meta_title: '',
    meta_description: '',
    section_id: '',
    is_active: true,
    is_featured: false,
    has_modifications: true,
    sku: '',
    stock_status: 'in_stock' as 'in_stock' | 'out_of_stock' | 'on_order',
  });
  const [images, setImages] = useState<string[]>([]);

  const { data: product, isLoading: productLoading } = useQuery({
    queryKey: ['product', productId],
    queryFn: async () => {
      if (isNew) return null;
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('id', productId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !isNew,
  });

  const { data: sections } = useQuery({
    queryKey: ['admin-sections-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sections')
        .select('id, name')
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  // Ініціалізація форми при завантаженні даних (adjust state during render)
  const [prevProductId, setPrevProductId] = useState<string | null>(null);
  if (product && product.id !== prevProductId) {
    setPrevProductId(product.id);
    setFormData({
      name: product.name || '',
      slug: product.slug || '',
      short_description: product.short_description || '',
      description: product.description || '',
      meta_title: product.meta_title || '',
      meta_description: product.meta_description || '',
      section_id: product.section_id || '',
      is_active: product.is_active ?? true,
      is_featured: product.is_featured ?? false,
      has_modifications: product.has_modifications ?? true,
      sku: product.sku || '',
      stock_status: product.stock_status || 'in_stock',
    });
    const productImages = product.images;
    setImages(Array.isArray(productImages) ? productImages.map(String) : []);
  }

  const createMutation = useMutation({
    mutationFn: async (data: TablesInsert<'products'>) => {
      const { data: newProduct, error } = await supabase
        .from('products')
        .insert([data])
        .select()
        .single();
      if (error) throw error;
      return newProduct;
    },
    onSuccess: (newProduct) => {
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      toast({ title: t('admin.products.created') });
      navigate({ to: adminPath(`products/${newProduct.id}`) });
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: t('common.error'),
        description: error.message,
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: TablesUpdate<'products'>) => {
      const { error } = await supabase
        .from('products')
        .update(data)
        .eq('id', productId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      queryClient.invalidateQueries({ queryKey: ['product', productId] });
      toast({ title: t('admin.products.updated') });
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
    const data: TablesInsert<'products'> = {
      name: formData.name,
      slug: formData.slug,
      short_description: formData.short_description,
      description: formData.description,
      meta_title: formData.meta_title,
      meta_description: formData.meta_description,
      section_id: formData.section_id || null,
      is_active: formData.is_active,
      is_featured: formData.is_featured,
      has_modifications: formData.has_modifications,
      images,
    };

    // Only include stock fields for simple products
    if (!formData.has_modifications) {
      data.sku = formData.sku || null;
      data.stock_status = formData.stock_status;
    } else {
      data.sku = null;
      data.stock_status = 'in_stock';
    }

    if (isNew) {
      createMutation.mutate(data);
    } else {
      updateMutation.mutate(data);
    }
  };

  const handleChange = (field: string, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  if (!isNew && productLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate({ to: adminPath('products') })}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">
              {isNew
                ? t('admin.products.new')
                : formData.name || t('admin.products.editTitle')}
            </h1>
            <p className="text-muted-foreground">
              {isNew
                ? t('admin.products.newSubtitle')
                : t('admin.products.editSubtitle')}
            </p>
          </div>
        </div>
        <Button onClick={handleSubmit} disabled={isPending}>
          {isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          {isNew ? t('common.create') : t('common.save')}
        </Button>
      </div>

      {/* Plugin slot: before product form */}
      <PluginSlot
        name="admin.product.form.before"
        context={{ product, formData, isNew, productId }}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
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
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="slug">URL (slug) *</Label>
                  <Input
                    id="slug"
                    value={formData.slug}
                    onChange={(e) => handleChange('slug', e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="short_description">
                  {t('admin.products.shortDescription')}
                </Label>
                <Input
                  id="short_description"
                  value={formData.short_description}
                  onChange={(e) =>
                    handleChange('short_description', e.target.value)
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">
                  {t('admin.products.fullDescription')}
                </Label>
                <RichTextEditor
                  content={formData.description}
                  onChange={(content) => handleChange('description', content)}
                  placeholder={t('admin.products.descriptionPlaceholder')}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('admin.products.images')}</CardTitle>
            </CardHeader>
            <CardContent>
              <ImageUpload
                images={images}
                onImagesChange={setImages}
                folder={`products/${productId || 'new'}`}
                maxImages={10}
              />
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
                  placeholder={t('admin.products.seoTitlePlaceholder')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="meta_description">Meta Description</Label>
                <Textarea
                  id="meta_description"
                  rows={3}
                  value={formData.meta_description}
                  onChange={(e) =>
                    handleChange('meta_description', e.target.value)
                  }
                  placeholder={t('common.seoDescription')}
                />
              </div>
            </CardContent>
          </Card>

          {/* Plugin slot: additional form fields from plugins */}
          <PluginSlot
            name="admin.product.form.fields"
            context={{ product, formData, isNew, productId, handleChange }}
          />

          {/* Simple product fields - only for simple products */}
          {!isNew && !formData.has_modifications && (
            <SimpleProductFields
              productId={productId!}
              sku={formData.sku}
              stockStatus={formData.stock_status}
              onSkuChange={(v) => handleChange('sku', v)}
              onStockStatusChange={(v) => handleChange('stock_status', v)}
            />
          )}

          {/* All properties - for simple products (combines product + modification level) */}
          {!isNew && formData.section_id && !formData.has_modifications && (
            <AllProductProperties
              productId={productId!}
              sectionId={formData.section_id}
            />
          )}

          {/* Property Values - only show for existing products with modifications */}
          {!isNew && formData.section_id && formData.has_modifications && (
            <ProductPropertyValues
              productId={productId!}
              sectionId={formData.section_id}
            />
          )}

          {/* Modifications - only show for products with modifications */}
          {!isNew && formData.has_modifications && (
            <ProductModifications
              productId={productId!}
              sectionId={formData.section_id}
            />
          )}

          {/* Plugin slot: after main form content */}
          <PluginSlot
            name="admin.product.form.after"
            context={{ product, formData, isNew, productId }}
          />
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('admin.nav.settings')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>{t('admin.products.sectionRequired')}</Label>
                <Select
                  value={formData.section_id}
                  onValueChange={(value) => handleChange('section_id', value)}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={t('admin.products.pickSection')}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {sections?.map((section) => (
                      <SelectItem key={section.id} value={section.id}>
                        {section.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label>{t('admin.products.type')}</Label>
                <RadioGroup
                  value={
                    formData.has_modifications ? 'with_modifications' : 'simple'
                  }
                  onValueChange={(value) =>
                    handleChange(
                      'has_modifications',
                      value === 'with_modifications',
                    )
                  }
                  className="flex flex-col gap-2"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="simple" id="type_simple" />
                    <Label
                      htmlFor="type_simple"
                      className="font-normal cursor-pointer"
                    >
                      {t('admin.products.typeSimple')}
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem
                      value="with_modifications"
                      id="type_modifications"
                    />
                    <Label
                      htmlFor="type_modifications"
                      className="font-normal cursor-pointer"
                    >
                      {t('admin.products.typeWithMods')}
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              <Separator />

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

              <div className="flex items-center justify-between">
                <Label htmlFor="is_featured">
                  {t('admin.products.featured')}
                </Label>
                <Switch
                  id="is_featured"
                  checked={formData.is_featured}
                  onCheckedChange={(checked) =>
                    handleChange('is_featured', checked)
                  }
                />
              </div>
            </CardContent>
          </Card>

          {/* Plugin slot: sidebar items from plugins */}
          <PluginSlot
            name="admin.product.form.sidebar"
            context={{ product, formData, isNew, productId }}
          />

          {!isNew && (
            <Card>
              <CardHeader>
                <CardTitle>{t('common.information')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>ID: {productId}</p>
                {product && (
                  <>
                    <p>
                      {t('admin.products.createdAt')}{' '}
                      {new Date(product.created_at).toLocaleDateString('uk-UA')}
                    </p>
                    <p>
                      {t('admin.products.updatedAt')}{' '}
                      {new Date(product.updated_at).toLocaleDateString('uk-UA')}
                    </p>
                  </>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
