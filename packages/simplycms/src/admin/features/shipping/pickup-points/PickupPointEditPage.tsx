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
import { PickupPointFields } from './PickupPointFields';
import { usePickupPointCard } from './usePickupPointCard';

/**
 * Картка точки видачі (Е6а, Task 7): `new` або id з URL. Системна точка
 * (склад) — бейдж і без видалення (Е6а-12).
 */
export default function PickupPointEditPage() {
  const t = useT();
  const { pointId } = useParams({ strict: false }) as { pointId?: string };
  const {
    isNew,
    isLoading,
    deleting,
    row,
    form,
    methodOptions,
    zones,
    onSubmit,
    handleDelete,
  } = usePickupPointCard(pointId);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const back = adminPath('shipping/pickup-points');

  if ((!isNew && isLoading) || (deleting && !row))
    return <div className="p-8 text-center">{t('common.loading')}</div>;
  if (!isNew && !row)
    return (
      <NotFoundState
        backTo={back}
        message={t('admin.shipping.points.notFound')}
      />
    );

  return (
    <div className="space-y-6 max-w-2xl">
      <CardPageHeader
        backTo={back}
        title={
          isNew ? (
            t('admin.shipping.points.new')
          ) : (
            <>
              {row?.name}
              {row?.isSystem && (
                <Badge variant="secondary" className="ml-2 align-middle">
                  {t('admin.shipping.points.system')}
                </Badge>
              )}
            </>
          )
        }
        subtitle={row?.isSystem && t('admin.shipping.points.systemLocked')}
        action={
          row &&
          !row.isSystem && (
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
          <CardTitle>{t('admin.shipping.points.info')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <PickupPointFields
              form={form}
              isNew={isNew}
              methodOptions={methodOptions}
              zoneOptions={zones.map((z) => ({ value: z.id, text: z.name }))}
            />
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
        title={t('admin.shipping.points.deleteTitle')}
        warning={t('admin.shipping.points.deleteWarning')}
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
