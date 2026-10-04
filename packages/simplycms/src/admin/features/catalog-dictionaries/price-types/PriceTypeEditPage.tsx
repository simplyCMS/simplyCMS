import { useState } from 'react';
import { useParams, Link } from '@tanstack/react-router';
import { useT } from 'simplycms/i18n';
import { Button } from 'simplycms/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from 'simplycms/ui/card';
import { Trash2 } from 'lucide-react';
import { adminPath } from '../../../lib/adminLinks';
import { CardPageHeader, SubmitButton } from '../CardPageHeader';
import { DeleteConfirmDialog } from '../DeleteConfirmDialog';
import { NotFoundState } from '../PageStates';
import { PriceTypeFields } from './PriceTypeFields';
import { usePriceTypeCard } from './usePriceTypeCard';

/**
 * Картка типу ціни (Е4, Task 6): `new` або id з URL. Рядок — жива
 * колекція, стан і двофазне збереження — `usePriceTypeCard`.
 */
export default function PriceTypeEditPage() {
  const t = useT();
  const { priceTypeId } = useParams({ strict: false }) as {
    priceTypeId?: string;
  };
  const { isNew, isLoading, deleting, row, form, onSubmit, handleDelete } =
    usePriceTypeCard(priceTypeId);
  const [confirmOpen, setConfirmOpen] = useState(false);

  if ((!isNew && isLoading) || (deleting && !row))
    return <div className="p-8 text-center">{t('common.loading')}</div>;

  if (!isNew && !row)
    return (
      <NotFoundState
        backTo={adminPath('price-types')}
        message={t('admin.prices.notFound')}
      />
    );

  return (
    <div className="space-y-6 max-w-2xl">
      <CardPageHeader
        backTo={adminPath('price-types')}
        title={isNew ? t('admin.prices.new') : t('admin.prices.editTitle')}
        action={
          row && (
            <Button
              variant="destructive"
              size="icon"
              disabled={row.isDefault}
              title={
                row.isDefault ? t('admin.prices.defaultLocked') : undefined
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
          <CardTitle>{t('common.information')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <PriceTypeFields form={form} lockedDefault={!!row?.isDefault} />
            <div className="flex justify-end gap-4">
              <Button variant="outline" asChild>
                <Link to={adminPath('price-types')}>{t('common.cancel')}</Link>
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
        title={t('admin.prices.deleteTitle')}
        warning={t('admin.prices.deleteWarning')}
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
