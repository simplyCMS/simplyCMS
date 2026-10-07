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
import { DiscountConditionsCard } from './DiscountConditionsCard';
import { DiscountMainFields } from './DiscountMainFields';
import { DiscountTargetsCard } from './DiscountTargetsCard';
import { useDiscountCard } from './useDiscountCard';

/**
 * Картка знижки (К3-Е6в, Task 8): `new` (з `?groupId`) або id з URL.
 * Основні поля, цілі й умови — одна форма й один атомарний запис.
 */
export default function DiscountEditPage() {
  const t = useT();
  const { discountId } = useParams({ strict: false }) as {
    discountId?: string;
  };
  const { groupId } = useSearch({ strict: false }) as { groupId?: string };
  const { isNew, isLoading, notFound, name, form, onSubmit } = useDiscountCard(
    discountId,
    groupId,
  );
  const back = adminPath('discounts');

  if (notFound)
    return (
      <NotFoundState backTo={back} message={t('admin.discounts.notFound')} />
    );
  if (isLoading)
    return <div className="p-8 text-center">{t('common.loading')}</div>;

  return (
    <div className="max-w-3xl space-y-6">
      <CardPageHeader
        backTo={back}
        title={
          isNew ? t('admin.discounts.new') : t('admin.discounts.editTitle')
        }
        subtitle={name}
      />
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>{t('common.basicInfo')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <DiscountMainFields form={form} />
          </CardContent>
        </Card>
        <DiscountTargetsCard form={form} />
        <DiscountConditionsCard form={form} />
        <div className="flex justify-end gap-4">
          <Button variant="outline" asChild>
            <Link to={back}>{t('common.cancel')}</Link>
          </Button>
          <SubmitButton pending={form.formState.isSubmitting} idleIcon={false}>
            {isNew ? t('common.create') : t('common.save')}
          </SubmitButton>
        </div>
      </form>
    </div>
  );
}
