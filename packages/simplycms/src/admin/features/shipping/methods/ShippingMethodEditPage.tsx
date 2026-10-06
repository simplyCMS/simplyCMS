import { useState } from 'react';
import { useParams, Link } from '@tanstack/react-router';
import { useT } from 'simplycms/i18n';
import { Button } from 'simplycms/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from 'simplycms/ui/card';
import { Trash2 } from 'lucide-react';
import { adminPath } from '../../../lib/adminLinks';
import {
  CardPageHeader,
  SubmitButton,
} from '../../catalog-dictionaries/CardPageHeader';
import { DeleteConfirmDialog } from '../../catalog-dictionaries/DeleteConfirmDialog';
import { NotFoundState } from '../../catalog-dictionaries/PageStates';
import { ShippingMethodFields } from './ShippingMethodFields';
import { ShippingRatesTable } from './ShippingRatesTable';
import { useShippingMethodCard } from './useShippingMethodCard';

/**
 * Картка способу доставки (Е6а, Task 6): `new` або id з URL. Блок
 * «Тарифи» (Е6а-1) — лише для збереженого способу з `pricing = 'rates'`.
 */
export default function ShippingMethodEditPage() {
  const t = useT();
  const { methodId } = useParams({ strict: false }) as { methodId?: string };
  const { isNew, isLoading, deleting, row, form, onSubmit, handleDelete } =
    useShippingMethodCard(methodId);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const back = adminPath('shipping/methods');

  if ((!isNew && isLoading) || (deleting && !row))
    return <div className="p-8 text-center">{t('common.loading')}</div>;
  if (!isNew && !row)
    return (
      <NotFoundState
        backTo={back}
        message={t('admin.shipping.methods.notFound')}
      />
    );

  return (
    <div className="space-y-6 max-w-3xl">
      <CardPageHeader
        backTo={back}
        title={isNew ? t('admin.shipping.methods.new') : row?.name}
        action={
          row && (
            <Button
              variant="destructive"
              size="icon"
              aria-label={t('common.delete')}
              onClick={() => setConfirmOpen(true)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )
        }
      />
      <Card>
        <CardHeader>
          <CardTitle>{t('common.basicInfo')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <ShippingMethodFields form={form} isNew={isNew} />
            <div className="flex justify-end gap-4">
              <Button variant="outline" asChild>
                <Link to={back}>{t('common.cancel')}</Link>
              </Button>
              <SubmitButton
                pending={form.formState.isSubmitting}
                idleIcon={false}
              >
                {isNew ? t('common.create') : t('common.save')}
              </SubmitButton>
            </div>
          </form>
        </CardContent>
      </Card>
      {row?.pricing === 'rates' && <ShippingRatesTable methodId={row.id} />}
      <DeleteConfirmDialog
        title={t('admin.shipping.methods.deleteTitle')}
        warning={t('admin.shipping.methods.deleteWarning')}
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
