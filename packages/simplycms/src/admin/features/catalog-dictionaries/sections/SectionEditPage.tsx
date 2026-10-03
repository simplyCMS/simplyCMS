import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from '@tanstack/react-router';
import { useLiveQuery } from '@tanstack/react-db';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { sectionsCollection, useCollection } from 'simplycms/admin-data';
import { useT } from 'simplycms/i18n';
import { Button } from 'simplycms/ui/button';
import { Input } from 'simplycms/ui/input';
import { Label } from 'simplycms/ui/label';
import { Switch } from 'simplycms/ui/switch';
import { Separator } from 'simplycms/ui/separator';
import { Card, CardContent, CardHeader, CardTitle } from 'simplycms/ui/card';
import { ArrowLeft, Loader2, Save, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { ImageUpload } from '../../../components/ImageUpload';
import { RichTextEditor } from '../../../components/RichTextEditor';
import { adminPath } from '../../../lib/adminLinks';
import { reportTxError } from '../../../lib/report-tx-error';
import {
  sectionFormSchema,
  toSectionDraft,
  toSectionPatch,
  type SectionFormInput,
  type SectionFormValues,
} from './section-form-schema';
import { SectionDeleteDialog } from './SectionDeleteDialog';

const EMPTY: SectionFormInput = {
  name: '',
  slug: '',
  description: '',
  metaTitle: '',
  metaDescription: '',
  sortOrder: 0,
  isActive: true,
  images: [],
};

/**
 * Картка розділу (Е4, Task 7): `new` або id з URL. Рядок — жива колекція.
 * Для нового розділу id генерується НАПЕРЕД (Е0/Е4-10): `ImageUpload`
 * привʼязує файл до `entityId`, ще до першого збереження.
 */
export default function SectionEditPage() {
  const t = useT();
  const navigate = useNavigate();
  const { sectionId } = useParams({ strict: false }) as { sectionId?: string };
  const isNew = !sectionId || sectionId === 'new';
  const collection = useCollection(sectionsCollection);
  const { data: all, isLoading } = useLiveQuery({
    query: (q) => q.from({ s: collection }),
  });
  const row = isNew ? undefined : all.find((s) => s.id === sectionId);
  const [newId] = useState(() => crypto.randomUUID());
  const entityId = row?.id ?? newId;

  const form = useForm<SectionFormInput, unknown, SectionFormValues>({
    resolver: zodResolver(sectionFormSchema),
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

  useEffect(() => {
    if (row)
      reset({
        name: row.name,
        slug: row.slug,
        description: row.description ?? '',
        metaTitle: row.metaTitle ?? '',
        metaDescription: row.metaDescription ?? '',
        sortOrder: row.sortOrder,
        isActive: row.isActive,
        images: row.imageUrl ? [row.imageUrl] : [],
      });
  }, [row?.id, reset]); // eslint-disable-line react-hooks/exhaustive-deps

  const nameValue = useWatch({ control, name: 'name' });
  const description = useWatch({ control, name: 'description' });
  const images = useWatch({ control, name: 'images' });
  const [confirmOpen, setConfirmOpen] = useState(false);
  const goList = () => navigate({ to: adminPath('sections') });

  const onSubmit = async (v: SectionFormValues) => {
    const patch = toSectionPatch(v);
    const tx = row
      ? collection.update(row.id, (d) => {
          Object.assign(d, patch);
        })
      : collection.insert(toSectionDraft(v, entityId, new Date()));
    try {
      await tx.isPersisted.promise;
    } catch (e) {
      reportTxError(t, e);
      return;
    }
    toast.success(
      row ? t('admin.sections.saved') : t('admin.sections.created'),
    );
    goList();
  };

  const handleDelete = () => {
    if (!row) return;
    collection
      .delete(row.id)
      .isPersisted.promise.then(() => {
        toast.success(t('admin.sections.deleted'));
        goList();
      })
      .catch((e: unknown) => reportTxError(t, e));
  };

  if (!isNew && isLoading)
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
          <Link to={adminPath('sections')}>
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <p className="text-muted-foreground">{t('admin.sections.notFound')}</p>
      </div>
    );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to={adminPath('sections')}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold">
              {isNew
                ? t('admin.sections.new')
                : nameValue || t('admin.sections.editTitle')}
            </h1>
            <p className="text-muted-foreground">
              {isNew
                ? t('admin.sections.newSubtitle')
                : t('admin.sections.editTitle')}
            </p>
          </div>
        </div>
        {row && (
          <Button
            variant="destructive"
            size="icon"
            aria-label={t('common.delete')}
            onClick={() => setConfirmOpen(true)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>{t('common.basicInfo')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="section-name">{t('common.name')}</Label>
                    <Input
                      id="section-name"
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
                    <Label htmlFor="section-slug">
                      {t('admin.common.slug')}
                    </Label>
                    <Input
                      id="section-slug"
                      aria-invalid={!!errors.slug}
                      aria-describedby="section-slug-hint"
                      {...register('slug')}
                    />
                    <p
                      id="section-slug-hint"
                      role={errors.slug ? 'alert' : undefined}
                      className={
                        errors.slug
                          ? 'text-xs text-destructive'
                          : 'text-xs text-muted-foreground'
                      }
                    >
                      {t('admin.sections.slugHint')}
                    </p>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>{t('common.description')}</Label>
                  <RichTextEditor
                    content={description}
                    onChange={(content) =>
                      setValue('description', content, { shouldDirty: true })
                    }
                    placeholder={t('admin.sections.descriptionPlaceholder')}
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
                  <Label htmlFor="section-meta-title">
                    {t('admin.common.metaTitle')}
                  </Label>
                  <Input
                    id="section-meta-title"
                    placeholder={t('admin.sections.seoTitlePlaceholder')}
                    {...register('metaTitle')}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="section-meta-description">
                    {t('admin.common.metaDescription')}
                  </Label>
                  <Input
                    id="section-meta-description"
                    placeholder={t('common.seoDescription')}
                    {...register('metaDescription')}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>{t('admin.nav.settings')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="section-active">{t('common.activeM')}</Label>
                  <Controller
                    control={control}
                    name="isActive"
                    render={({ field }) => (
                      <Switch
                        id="section-active"
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    )}
                  />
                </div>
                <Separator />
                <div className="space-y-2">
                  <Label htmlFor="section-sort">{t('common.sortOrder')}</Label>
                  <Input
                    id="section-sort"
                    type="number"
                    min="0"
                    aria-invalid={!!errors.sortOrder}
                    {...register('sortOrder')}
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
                  images={images}
                  onImagesChange={(images) =>
                    setValue('images', images, { shouldDirty: true })
                  }
                  entityType="section"
                  entityId={entityId}
                  maxImages={1}
                />
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="flex justify-end gap-4">
          <Button variant="outline" asChild>
            <Link to={adminPath('sections')}>{t('common.cancel')}</Link>
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            {isNew ? t('common.create') : t('common.save')}
          </Button>
        </div>
      </form>
      <SectionDeleteDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        onConfirm={() => {
          setConfirmOpen(false);
          handleDelete();
        }}
      />
    </div>
  );
}
