import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from '@tanstack/react-router';
import { eq, useLiveQuery } from '@tanstack/react-db';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  sectionPropertiesCollection,
  useCollection,
} from 'simplycms/admin-data';
import { useT } from 'simplycms/i18n';
import { Button } from 'simplycms/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from 'simplycms/ui/card';
import { ArrowLeft, Loader2, Plus, Save, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { adminPath } from '../../../lib/adminLinks';
import { reportTxError } from '../../../lib/report-tx-error';
import { DeleteConfirmDialog } from './DeleteConfirmDialog';
import { PropertyFields } from './PropertyFields';
import { PropertyOptionsTable } from './PropertyOptionsTable';
import {
  EMPTY_PROPERTY,
  hasOptions,
  propertyFormSchema,
  toPropertyPatch,
  type PropertyFormInput,
  type PropertyFormValues,
} from './property-form-schema';

/**
 * Картка властивості (Е4, Task 8): зріз on-demand колекції `where id`.
 * Тип незмінний (Е4-5) — показаний текстом, update його не несе. Блок
 * опцій — лише для `select`/`multiselect`. Створення — діалогом у списку,
 * тож `new` у цьому роуті немає.
 */
export default function PropertyEditPage() {
  const t = useT();
  const navigate = useNavigate();
  const { propertyId } = useParams({ strict: false }) as { propertyId: string };
  const collection = useCollection(sectionPropertiesCollection);
  const { data: rows, isLoading } = useLiveQuery(
    (q) => q.from({ p: collection }).where(({ p }) => eq(p.id, propertyId)),
    [propertyId],
  );
  const row = rows.find((p) => p.id === propertyId);

  const form = useForm<PropertyFormInput, unknown, PropertyFormValues>({
    resolver: zodResolver(propertyFormSchema),
    defaultValues: EMPTY_PROPERTY,
  });
  const {
    handleSubmit,
    reset,
    control,
    formState: { isSubmitting },
  } = form;

  // Скидання форми лише при зміні РЯДКА (id), а не на кожен write-back:
  // інакше відповідь сервера перетерла б незбережене введення.
  useEffect(() => {
    if (row)
      reset({
        name: row.name,
        slug: row.slug,
        propertyType: row.propertyType,
        isRequired: row.isRequired,
        isFilterable: row.isFilterable,
        hasPage: row.hasPage,
        sortOrder: row.sortOrder,
      });
  }, [row?.id, reset]); // eslint-disable-line react-hooks/exhaustive-deps

  const nameValue = useWatch({ control, name: 'name' });
  const [confirmOpen, setConfirmOpen] = useState(false);
  // Поки видалення в дорозі, оптимістично рядка вже немає — без прапорця
  // сторінка блимнула б станом «не знайдено» перед переходом на список.
  const [deleting, setDeleting] = useState(false);
  const goList = () => navigate({ to: adminPath('properties') });

  const onSubmit = async (v: PropertyFormValues) => {
    if (!row) return;
    const patch = toPropertyPatch(v);
    const tx = collection.update(row.id, (d) => {
      Object.assign(d, patch);
    });
    try {
      await tx.isPersisted.promise;
    } catch (e) {
      reportTxError(t, e);
      return;
    }
    toast.success(t('admin.properties.saved'));
  };

  const handleDelete = () => {
    if (!row) return;
    setDeleting(true);
    collection
      .delete(row.id)
      .isPersisted.promise.then(() => {
        toast.success(t('admin.properties.deleted'));
        goList();
      })
      .catch((e: unknown) => {
        // Бібліотека вже повернула рядок — користувач лишається на картці.
        setDeleting(false);
        reportTxError(t, e);
      });
  };

  if (isLoading || (deleting && !row))
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );

  if (!row)
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to={adminPath('properties')}>
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <p className="text-muted-foreground">
          {t('admin.properties.notFound')}
        </p>
      </div>
    );

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to={adminPath('properties')}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold">
              {nameValue || t('admin.properties.fallbackTitle')}
            </h1>
            <p className="text-muted-foreground">
              {t('admin.properties.editTitle')}
            </p>
          </div>
        </div>
        <Button
          variant="destructive"
          size="icon"
          aria-label={t('admin.properties.delete')}
          onClick={() => setConfirmOpen(true)}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <Card>
          <CardHeader>
            <CardTitle>{t('common.basicInfo')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <PropertyFields
              form={form}
              idPrefix="property"
              typeEditable={false}
            />
            <div className="flex justify-end pt-4">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                {t('common.save')}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>

      {hasOptions(row.propertyType) && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{t('admin.properties.options.title')}</CardTitle>
            <Button
              size="sm"
              onClick={() =>
                navigate({
                  to: adminPath(`properties/${row.id}/options/new`),
                })
              }
            >
              <Plus className="h-4 w-4 mr-2" />
              {t('admin.properties.options.add')}
            </Button>
          </CardHeader>
          <CardContent>
            <PropertyOptionsTable propertyId={row.id} />
          </CardContent>
        </Card>
      )}

      <DeleteConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        onConfirm={() => {
          setConfirmOpen(false);
          handleDelete();
        }}
        title={t('admin.properties.deleteTitle')}
        warning={t('admin.properties.deleteWarning')}
      />
    </div>
  );
}
