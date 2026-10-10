import { useState } from 'react';
import { Link, useParams } from '@tanstack/react-router';
import { useT } from 'simplycms/i18n';
import { Button } from 'simplycms/ui/button';
import { Trash2 } from 'lucide-react';
import { adminPath } from '../../lib/adminLinks';
import {
  CardPageHeader,
  SubmitButton,
} from '../catalog-dictionaries/CardPageHeader';
import { DeleteConfirmDialog } from '../catalog-dictionaries/DeleteConfirmDialog';
import { NotFoundState } from '../catalog-dictionaries/PageStates';
import { BannerButtonsCard } from './BannerButtonsCard';
import { BannerMainCard } from './BannerMainCard';
import { BannerScheduleCard } from './BannerScheduleCard';
import { BannerSideCards } from './BannerSideCards';
import { useBannerCard } from './useBannerCard';

/** Картка банера: `new` або id з URL. Збереження — через колекцію (серверний шар). */
export default function BannerEditPage() {
  const t = useT();
  const { bannerId } = useParams({ strict: false }) as { bannerId?: string };
  const card = useBannerCard(bannerId);
  const { isNew, row, form } = card;
  const [confirmOpen, setConfirmOpen] = useState(false);
  const back = adminPath('banners');

  if ((!isNew && card.isLoading) || (card.deleting && !row))
    return <div className="p-8 text-center">{t('common.loading')}</div>;
  if (!isNew && !row)
    return <NotFoundState backTo={back} message={t('admin.banners.empty')} />;

  return (
    <div className="space-y-6">
      <CardPageHeader
        backTo={back}
        title={
          isNew
            ? t('admin.banners.new')
            : (row?.title ?? t('admin.banners.editTitle'))
        }
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
      <form onSubmit={form.handleSubmit(card.onSubmit)}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <BannerMainCard form={form} entityId={card.entityId} />
            <BannerButtonsCard form={form} />
            <BannerScheduleCard form={form} />
          </div>
          <div className="space-y-6">
            <BannerSideCards form={form} sections={card.sections} />
            <div className="flex justify-end gap-4">
              <Button variant="outline" asChild>
                <Link to={back}>{t('common.cancel')}</Link>
              </Button>
              <SubmitButton pending={form.formState.isSubmitting}>
                {isNew ? t('common.create') : t('common.save')}
              </SubmitButton>
            </div>
          </div>
        </div>
      </form>
      <DeleteConfirmDialog
        title={t('admin.banners.deleteTitle')}
        warning={t('admin.banners.deleteWarning')}
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        onConfirm={() => {
          setConfirmOpen(false);
          card.handleDelete();
        }}
      />
    </div>
  );
}
