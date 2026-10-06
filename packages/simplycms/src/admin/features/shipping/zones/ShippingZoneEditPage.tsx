import { useState } from 'react';
import { useParams, Link } from '@tanstack/react-router';
import { useT } from 'simplycms/i18n';
import { Badge } from 'simplycms/ui/badge';
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
import { ShippingZoneFields } from './ShippingZoneFields';
import { useShippingZoneCard } from './useShippingZoneCard';

/**
 * Картка зони доставки (Е6а, Task 7): `new` або id з URL. Тарифи тут не
 * редагуються (Е6а-1) — вони в картці способу.
 */
export default function ShippingZoneEditPage() {
  const t = useT();
  const { zoneId } = useParams({ strict: false }) as { zoneId?: string };
  const { isNew, isLoading, deleting, row, form, onSubmit, handleDelete } =
    useShippingZoneCard(zoneId);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const back = adminPath('shipping/zones');

  if ((!isNew && isLoading) || (deleting && !row))
    return <div className="p-8 text-center">{t('common.loading')}</div>;
  if (!isNew && !row)
    return (
      <NotFoundState
        backTo={back}
        message={t('admin.shipping.zones.notFound')}
      />
    );

  return (
    <div className="space-y-6 max-w-2xl">
      <CardPageHeader
        backTo={back}
        title={
          isNew ? (
            t('admin.shipping.zones.new')
          ) : (
            <>
              {row?.name}
              {row?.isDefault && (
                <Badge variant="secondary" className="ml-2 align-middle">
                  {t('common.byDefault')}
                </Badge>
              )}
            </>
          )
        }
        action={
          row && (
            <Button
              variant="destructive"
              size="icon"
              disabled={row.isDefault}
              title={
                row.isDefault
                  ? t('admin.shipping.zones.defaultLocked')
                  : undefined
              }
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
            <ShippingZoneFields form={form} lockedActive={!!row?.isDefault} />
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
      <DeleteConfirmDialog
        title={t('admin.shipping.zones.deleteTitle')}
        warning={t('admin.shipping.zones.deleteWarning')}
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
