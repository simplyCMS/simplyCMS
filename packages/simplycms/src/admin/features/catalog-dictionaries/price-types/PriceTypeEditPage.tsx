import { useEffect } from 'react';
import { useParams, useNavigate, Link } from '@tanstack/react-router';
import { useLiveQuery } from '@tanstack/react-db';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { priceTypesCollection, useCollection } from 'simplycms/admin-data';
import { useT } from 'simplycms/i18n';
import { Button } from 'simplycms/ui/button';
import { Input } from 'simplycms/ui/input';
import { Label } from 'simplycms/ui/label';
import { Switch } from 'simplycms/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from 'simplycms/ui/card';
import { ArrowLeft, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { adminPath } from '../../../lib/adminLinks';
import { reportTxError } from '../../../lib/report-tx-error';
import {
  priceTypeFormSchema,
  type PriceTypeFormInput,
  type PriceTypeFormValues,
} from './price-type-form-schema';
import { usePriceTypeDefault } from './usePriceTypeDefault';

const EMPTY: PriceTypeFormInput = {
  name: '',
  code: '',
  sortOrder: 0,
  isDefault: false,
};

/**
 * Картка типу ціни (Е4, Task 6): `new` або id з URL. Рядок — жива
 * колекція. Збереження — `insert`/`update` (без `isDefault`: readonly), а
 * дефолт — окремою фазою `setDefaultPriceType` ПІСЛЯ персисту. Двофазність
 * чесна: падіння дефолту не маскується під «не збережено» — рядок уже є.
 */
export default function PriceTypeEditPage() {
  const t = useT();
  const navigate = useNavigate();
  const { priceTypeId } = useParams({ strict: false }) as {
    priceTypeId?: string;
  };
  const isNew = !priceTypeId || priceTypeId === 'new';
  const collection = useCollection(priceTypesCollection);
  const applyDefault = usePriceTypeDefault();
  const { data: all, isLoading } = useLiveQuery({
    query: (q) => q.from({ p: collection }),
  });
  const row = isNew ? undefined : all.find((p) => p.id === priceTypeId);

  const form = useForm<PriceTypeFormInput, unknown, PriceTypeFormValues>({
    resolver: zodResolver(priceTypeFormSchema),
    defaultValues: EMPTY,
  });
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = form;

  useEffect(() => {
    if (row)
      reset({
        name: row.name,
        code: row.code,
        sortOrder: row.sortOrder,
        isDefault: row.isDefault,
      });
  }, [row?.id, row?.isDefault, reset]); // eslint-disable-line react-hooks/exhaustive-deps

  const goList = () => navigate({ to: adminPath('price-types') });

  const onSubmit = async (v: PriceTypeFormValues) => {
    const id = row?.id ?? crypto.randomUUID(); // Е0: ключ генерує клієнт
    const tx = row
      ? collection.update(id, (d) => {
          d.name = v.name;
          d.code = v.code;
          d.sortOrder = v.sortOrder;
        })
      : collection.insert({
          id,
          name: v.name,
          code: v.code,
          sortOrder: v.sortOrder,
          isDefault: false,
          createdAt: new Date(),
        });
    try {
      await tx.isPersisted.promise;
    } catch (e) {
      reportTxError(t, e);
      return;
    }
    toast.success(row ? t('common.changesSaved') : t('admin.prices.created'));
    if (v.isDefault && !row?.isDefault) {
      try {
        await applyDefault(id);
      } catch (e) {
        reportTxError(t, e);
      }
    }
    goList();
  };

  const handleDelete = () => {
    if (!row) return;
    collection
      .delete(row.id)
      .isPersisted.promise.then(() => {
        toast.success(t('admin.prices.deleted'));
        goList();
      })
      .catch((e: unknown) => reportTxError(t, e));
  };

  if (!isNew && isLoading)
    return <div className="p-8 text-center">{t('common.loading')}</div>;

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to={adminPath('price-types')}>
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <h1 className="text-3xl font-bold">
            {isNew ? t('admin.prices.new') : t('admin.prices.editTitle')}
          </h1>
        </div>
        {row && (
          <Button
            variant="destructive"
            size="icon"
            disabled={row.isDefault}
            title={row.isDefault ? t('admin.prices.defaultLocked') : undefined}
            aria-label={t('common.delete')}
            onClick={() =>
              confirm(t('admin.prices.deleteTitle')) && handleDelete()
            }
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('common.information')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="pt-name">{t('common.name')}</Label>
              <Input
                id="pt-name"
                placeholder={t('admin.prices.namePlaceholder')}
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
              <Label htmlFor="pt-code">{t('common.code')}</Label>
              <Input
                id="pt-code"
                placeholder="retail"
                aria-invalid={!!errors.code}
                {...register('code')}
              />
              <p className="text-xs text-muted-foreground">
                {t('admin.prices.codeHint')}
              </p>
              {errors.code && (
                <p role="alert" className="text-xs text-destructive">
                  {t('admin.prices.codeFormat')}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="pt-sort">{t('common.sortOrder')}</Label>
              <Input
                id="pt-sort"
                type="number"
                min="0"
                aria-invalid={!!errors.sortOrder}
                {...register('sortOrder')}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label htmlFor="pt-default" className="text-base">
                  {t('common.byDefault')}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {t('admin.prices.defaultHint')}
                </p>
              </div>
              <Controller
                control={control}
                name="isDefault"
                render={({ field }) => (
                  <Switch
                    id="pt-default"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    // Нуль дефолтів заборонений: зняти можна лише призначивши
                    // дефолтним ІНШИЙ тип.
                    disabled={!!row?.isDefault}
                    title={
                      row?.isDefault ? t('admin.prices.defaultKeep') : undefined
                    }
                  />
                )}
              />
            </div>
            <div className="flex justify-end gap-4">
              <Button variant="outline" asChild>
                <Link to={adminPath('price-types')}>{t('common.cancel')}</Link>
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {isNew ? t('common.create') : t('common.save')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
