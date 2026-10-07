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
import { CategoryRuleFields } from './CategoryRuleFields';
import { RuleConditionsCard } from './RuleConditionsCard';
import { useCategoryRuleCard } from './useCategoryRuleCard';

/** Картка автоправила категорії: `new` або id з URL. */
export default function CategoryRuleEditPage() {
  const t = useT();
  const { ruleId } = useParams({ strict: false }) as { ruleId?: string };
  const {
    isNew,
    isLoading,
    deleting,
    row,
    categories,
    form,
    onSubmit,
    handleDelete,
  } = useCategoryRuleCard(ruleId);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const back = adminPath('user-categories/rules');

  if ((!isNew && isLoading) || (deleting && !row))
    return <div className="p-8 text-center">{t('common.loading')}</div>;
  if (!isNew && !row)
    return (
      <NotFoundState
        backTo={back}
        message={t('admin.customerCategories.rules.notFound')}
      />
    );

  return (
    <div className="max-w-3xl space-y-6">
      <CardPageHeader
        backTo={back}
        title={isNew ? t('admin.users.rules.new') : row?.name}
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
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>{t('common.basicInfo')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <CategoryRuleFields form={form} categories={categories} />
          </CardContent>
        </Card>
        <RuleConditionsCard form={form} />
        <div className="flex justify-end gap-4">
          <Button variant="outline" asChild>
            <Link to={back}>{t('common.cancel')}</Link>
          </Button>
          <SubmitButton pending={form.formState.isSubmitting} idleIcon={false}>
            {isNew ? t('common.create') : t('common.save')}
          </SubmitButton>
        </div>
      </form>
      <DeleteConfirmDialog
        title={t('admin.users.rules.deleteTitle')}
        warning={t('admin.users.categories.deleteWarning')}
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
