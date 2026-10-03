import { useParams, Link } from '@tanstack/react-router';
import { useT } from 'simplycms/i18n';
import { Button } from 'simplycms/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from 'simplycms/ui/card';
import { adminPath } from '../../../lib/adminLinks';
import { CardPageHeader, SubmitButton } from '../CardPageHeader';
import { NotFoundState, PageSpinner } from '../PageStates';
import { SlugField, SortOrderField, TextField } from '../form-fields';
import { OptionPageCards } from './OptionPageCards';
import { usePropertyOptionCard } from './usePropertyOptionCard';

/**
 * Картка опції (Е4, Task 8): `new` або id з URL. Стан, зріз опцій і
 * збереження — `usePropertyOptionCard`.
 */
export default function PropertyOptionEditPage() {
  const t = useT();
  const { propertyId, optionId } = useParams({ strict: false }) as {
    propertyId: string;
    optionId?: string;
  };
  const { isNew, isLoading, property, row, entityId, form, onSubmit } =
    usePropertyOptionCard(propertyId, optionId);
  const {
    register,
    formState: { errors, isSubmitting },
  } = form;
  const backTo = adminPath(`properties/${propertyId}`);

  if (isLoading) return <PageSpinner />;

  if (!isNew && !row)
    return (
      <NotFoundState
        backTo={backTo}
        message={t('admin.properties.options.notFound')}
      />
    );

  return (
    <div className="space-y-6 max-w-4xl">
      <CardPageHeader
        backTo={backTo}
        title={
          isNew
            ? t('admin.properties.options.new')
            : row?.name || t('admin.properties.options.fallbackTitle')
        }
        subtitle={
          property && `${t('admin.properties.options.parent')} ${property.name}`
        }
      />

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>{t('common.basicInfo')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <TextField
                id="option-name"
                label={t('common.name')}
                registration={register('name')}
                invalid={!!errors.name}
                errorText={t('validation.nameRequired')}
              />
              <SlugField
                id="option-slug"
                label={t('admin.common.slug')}
                registration={register('slug')}
                invalid={!!errors.slug}
                hint={t('admin.properties.options.slugHint')}
              />
            </div>
            <SortOrderField
              id="option-sort"
              label={t('common.sortOrder')}
              className="w-32"
              registration={register('sortOrder')}
              invalid={!!errors.sortOrder}
            />
          </CardContent>
        </Card>

        <OptionPageCards form={form} entityId={entityId} />

        <div className="flex justify-end gap-2">
          <Button variant="outline" asChild>
            <Link to={backTo}>{t('common.cancel')}</Link>
          </Button>
          <SubmitButton pending={isSubmitting}>
            {isNew ? t('common.create') : t('common.save')}
          </SubmitButton>
        </div>
      </form>
    </div>
  );
}
