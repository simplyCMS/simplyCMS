import { Link, useParams, useSearch } from '@tanstack/react-router';
import { useT } from 'simplycms/i18n';
import { Button } from 'simplycms/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from 'simplycms/ui/card';
import { adminPath } from '../../../lib/adminLinks';
import {
  CardPageHeader,
  SubmitButton,
} from '../../catalog-dictionaries/CardPageHeader';
import { NotFoundState } from '../../catalog-dictionaries/PageStates';
import { DiscountGroupFields } from './DiscountGroupFields';
import { useDiscountGroupCard } from './useDiscountGroupCard';

/**
 * Картка групи знижок (К3-Е6в): `new` (з `?parentId` — підгрупа) або id з
 * URL. Видалення групи — у дереві: діалог там показує, скільки груп і знижок
 * зникне каскадом.
 */
export default function DiscountGroupEditPage() {
  const t = useT();
  const { groupId } = useParams({ strict: false }) as { groupId?: string };
  const { parentId } = useSearch({ strict: false }) as { parentId?: string };
  const { isNew, isLoading, row, parents, form, onSubmit } =
    useDiscountGroupCard(groupId, parentId);
  const back = adminPath('discounts');

  if (!isNew && isLoading)
    return <div className="p-8 text-center">{t('common.loading')}</div>;
  if (!isNew && !row)
    return (
      <NotFoundState
        backTo={back}
        message={t('admin.discounts.groupNotFound')}
      />
    );

  return (
    <div className="space-y-6 max-w-2xl">
      <CardPageHeader
        backTo={back}
        title={
          isNew
            ? t('admin.discounts.groupNew')
            : t('admin.discounts.groupEditTitle')
        }
        subtitle={row?.name}
      />
      <Card>
        <CardHeader>
          <CardTitle>{t('common.basicInfo')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <DiscountGroupFields form={form} parents={parents} />
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
    </div>
  );
}
