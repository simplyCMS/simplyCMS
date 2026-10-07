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
import { UserCategoryFields } from './UserCategoryFields';
import { useUserCategoryCard } from './useUserCategoryCard';

/** Картка категорії покупців: `new` або id з URL. Дефолтну видалити не можна. */
export default function UserCategoryEditPage() {
  const t = useT();
  const { categoryId } = useParams({ strict: false }) as {
    categoryId?: string;
  };
  const { isNew, isLoading, deleting, row, form, onSubmit, handleDelete } =
    useUserCategoryCard(categoryId);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const back = adminPath('user-categories');

  if ((!isNew && isLoading) || (deleting && !row))
    return <div className="p-8 text-center">{t('common.loading')}</div>;
  if (!isNew && !row)
    return (
      <NotFoundState
        backTo={back}
        message={t('admin.customerCategories.categories.notFound')}
      />
    );

  return (
    <div className="max-w-2xl space-y-6">
      <CardPageHeader
        backTo={back}
        title={
          isNew ? (
            t('admin.users.categories.new')
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
          row &&
          !row.isDefault && (
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
          <CardTitle>{t('admin.users.categories.info')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <UserCategoryFields form={form} />
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
        title={t('admin.users.categories.deleteTitle')}
        warning={t('admin.customerCategories.categories.deleteWarning')}
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
