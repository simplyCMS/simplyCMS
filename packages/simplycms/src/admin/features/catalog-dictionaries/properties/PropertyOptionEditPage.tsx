import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from '@tanstack/react-router';
import { eq, useLiveQuery } from '@tanstack/react-db';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  propertyOptionsCollection,
  sectionPropertiesCollection,
  useCollection,
} from 'simplycms/admin-data';
import { useT } from 'simplycms/i18n';
import { Button } from 'simplycms/ui/button';
import { Input } from 'simplycms/ui/input';
import { Textarea } from 'simplycms/ui/textarea';
import { Label } from 'simplycms/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from 'simplycms/ui/card';
import { ArrowLeft, Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { ImageUpload } from '../../../components/ImageUpload';
import { RichTextEditor } from '../../../components/RichTextEditor';
import { adminPath } from '../../../lib/adminLinks';
import { reportTxError } from '../../../lib/report-tx-error';
import {
  optionFormSchema,
  toOptionDraft,
  toOptionPatch,
  type OptionFormInput,
  type OptionFormValues,
} from './option-form-schema';

const EMPTY: OptionFormInput = {
  name: '',
  slug: '',
  sortOrder: 0,
  description: '',
  metaTitle: '',
  metaDescription: '',
  images: [],
};

/**
 * Картка опції (Е4, Task 8): `new` або id з URL. Один зріз `where
 * propertyId` дає і сам рядок, і кількість опцій — нова опція отримує
 * `sortOrder` = цій кількості (з колекції, не `count` з БД). id нової
 * опції генерується НАПЕРЕД і йде і в `ImageUpload`, і в insert (Е4-10).
 */
export default function PropertyOptionEditPage() {
  const t = useT();
  const navigate = useNavigate();
  const { propertyId, optionId } = useParams({ strict: false }) as {
    propertyId: string;
    optionId?: string;
  };
  const isNew = !optionId || optionId === 'new';
  const optionsCol = useCollection(propertyOptionsCollection);
  const propertiesCol = useCollection(sectionPropertiesCollection);

  const { data: options, isLoading } = useLiveQuery(
    (q) =>
      q.from({ o: optionsCol }).where(({ o }) => eq(o.propertyId, propertyId)),
    [propertyId],
  );
  const { data: properties } = useLiveQuery(
    (q) => q.from({ p: propertiesCol }).where(({ p }) => eq(p.id, propertyId)),
    [propertyId],
  );
  const property = properties.find((p) => p.id === propertyId);
  const row = isNew ? undefined : options.find((o) => o.id === optionId);
  const [newId] = useState(() => crypto.randomUUID());
  const entityId = row?.id ?? newId;

  const form = useForm<OptionFormInput, unknown, OptionFormValues>({
    resolver: zodResolver(optionFormSchema),
    defaultValues: EMPTY,
  });
  const {
    register,
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = form;

  // Скидання лише при зміні рядка (id) або на першому завантаженні зрізу
  // для нової опції — не на кожен write-back (інакше затерло б введене).
  useEffect(() => {
    if (row)
      reset({
        name: row.name,
        slug: row.slug,
        sortOrder: row.sortOrder,
        description: row.description ?? '',
        metaTitle: row.metaTitle ?? '',
        metaDescription: row.metaDescription ?? '',
        images: row.imageUrl ? [row.imageUrl] : [],
      });
    else if (isNew && !isLoading)
      reset({ ...EMPTY, sortOrder: options.length });
  }, [row?.id, isNew, isLoading, reset]); // eslint-disable-line react-hooks/exhaustive-deps

  const description = useWatch({ control, name: 'description' });
  const images = useWatch({ control, name: 'images' });
  const metaTitle = useWatch({ control, name: 'metaTitle' });
  const metaDescription = useWatch({ control, name: 'metaDescription' });
  const goBack = () => navigate({ to: adminPath(`properties/${propertyId}`) });

  const onSubmit = async (v: OptionFormValues) => {
    const patch = toOptionPatch(v);
    const tx = row
      ? optionsCol.update(row.id, (d) => {
          Object.assign(d, patch);
        })
      : optionsCol.insert(toOptionDraft(v, entityId, propertyId, new Date()));
    try {
      await tx.isPersisted.promise;
    } catch (e) {
      reportTxError(t, e);
      return;
    }
    toast.success(
      row
        ? t('admin.properties.options.saved')
        : t('admin.properties.options.created'),
    );
    goBack();
  };

  if (isLoading)
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );

  // Невідомий id: без форми й без insert (інакше submit створив би новий рядок).
  if (!isNew && !row)
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to={adminPath(`properties/${propertyId}`)}>
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <p className="text-muted-foreground">
          {t('admin.properties.options.notFound')}
        </p>
      </div>
    );

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to={adminPath(`properties/${propertyId}`)}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold">
            {isNew
              ? t('admin.properties.options.new')
              : row?.name || t('admin.properties.options.fallbackTitle')}
          </h1>
          {property && (
            <p className="text-muted-foreground">
              {t('admin.properties.options.parent')} {property.name}
            </p>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>{t('common.basicInfo')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="option-name">{t('common.name')}</Label>
                <Input
                  id="option-name"
                  aria-invalid={!!errors.name}
                  {...register('name')}
                />
                {errors.name && (
                  <p role="alert" className="text-xs text-destructive">
                    {t('validation.nameRequired')}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="option-slug">{t('admin.common.slug')}</Label>
                <Input
                  id="option-slug"
                  aria-invalid={!!errors.slug}
                  aria-describedby="option-slug-hint"
                  {...register('slug')}
                />
                <p
                  id="option-slug-hint"
                  role={errors.slug ? 'alert' : undefined}
                  className={
                    errors.slug
                      ? 'text-xs text-destructive'
                      : 'text-xs text-muted-foreground'
                  }
                >
                  {t('admin.properties.options.slugHint')}
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="option-sort">{t('common.sortOrder')}</Label>
              <Input
                id="option-sort"
                type="number"
                min="0"
                className="w-32"
                aria-invalid={!!errors.sortOrder}
                {...register('sortOrder')}
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
                images={images}
                onImagesChange={(next) =>
                  setValue('images', next, { shouldDirty: true })
                }
                entityType="property_option"
                entityId={entityId}
                maxImages={1}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('common.description')}</Label>
              <RichTextEditor
                content={description}
                onChange={(content) =>
                  setValue('description', content, { shouldDirty: true })
                }
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('admin.common.seo')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="option-meta-title">
                {t('admin.common.metaTitle')}
              </Label>
              <Input
                id="option-meta-title"
                placeholder={t('admin.properties.options.seoTitlePlaceholder')}
                {...register('metaTitle')}
              />
              <p className="text-xs text-muted-foreground">
                {metaTitle.length}
                {t('admin.properties.options.titleCounter')}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="option-meta-description">
                {t('admin.common.metaDescription')}
              </Label>
              <Textarea
                id="option-meta-description"
                placeholder={t('common.seoDescription')}
                rows={3}
                {...register('metaDescription')}
              />
              <p className="text-xs text-muted-foreground">
                {metaDescription.length}
                {t('admin.properties.options.descriptionCounter')}
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Button variant="outline" asChild>
            <Link to={adminPath(`properties/${propertyId}`)}>
              {t('common.cancel')}
            </Link>
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            {isNew ? t('common.create') : t('common.save')}
          </Button>
        </div>
      </form>
    </div>
  );
}
