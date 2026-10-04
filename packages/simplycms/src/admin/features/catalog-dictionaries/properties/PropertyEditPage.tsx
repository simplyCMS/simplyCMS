import { useState } from 'react';
import { useParams, useNavigate } from '@tanstack/react-router';
import { useWatch } from 'react-hook-form';
import { useT } from 'simplycms/i18n';
import { Button } from 'simplycms/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from 'simplycms/ui/card';
import { Plus, Trash2 } from 'lucide-react';
import { adminPath } from '../../../lib/adminLinks';
import { CardPageHeader, SubmitButton } from '../CardPageHeader';
import { DeleteConfirmDialog } from '../DeleteConfirmDialog';
import { NotFoundState, PageSpinner } from '../PageStates';
import { PropertyFields } from './PropertyFields';
import { PropertyOptionsTable } from './PropertyOptionsTable';
import { hasOptions } from './property-form-schema';
import { usePropertyCard } from './usePropertyCard';

/**
 * Картка властивості (Е4, Task 8): зріз on-demand колекції `where id`.
 * Тип незмінний (Е4-5) — показаний текстом, update його не несе. Блок
 * опцій — лише для `select`/`multiselect`. Створення — діалогом у списку,
 * тож `new` у цьому роуті немає.
 */
export default function PropertyEditPage() {
  const t = useT();
  const navigate = useNavigate();
  const { propertyId } = useParams({ strict: false }) as { propertyId: string };
  const { isLoading, deleting, row, form, onSubmit, handleDelete } =
    usePropertyCard(propertyId);
  const nameValue = useWatch({ control: form.control, name: 'name' });
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (isLoading || (deleting && !row)) return <PageSpinner />;

  if (!row)
    return (
      <NotFoundState
        backTo={adminPath('properties')}
        message={t('admin.properties.notFound')}
      />
    );

  return (
    <div className="space-y-6 max-w-4xl">
      <CardPageHeader
        backTo={adminPath('properties')}
        title={nameValue || t('admin.properties.fallbackTitle')}
        subtitle={t('admin.properties.editTitle')}
        action={
          <Button
            variant="destructive"
            size="icon"
            aria-label={t('admin.properties.delete')}
            onClick={() => setConfirmOpen(true)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        }
      />

      <form onSubmit={form.handleSubmit(onSubmit)}>
        <Card>
          <CardHeader>
            <CardTitle>{t('common.basicInfo')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <PropertyFields
              form={form}
              idPrefix="property"
              typeEditable={false}
            />
            <div className="flex justify-end pt-4">
              <SubmitButton pending={form.formState.isSubmitting}>
                {t('common.save')}
              </SubmitButton>
            </div>
          </CardContent>
        </Card>
      </form>

      {hasOptions(row.propertyType) && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{t('admin.properties.options.title')}</CardTitle>
            <Button
              size="sm"
              onClick={() =>
                navigate({ to: adminPath(`properties/${row.id}/options/new`) })
              }
            >
              <Plus className="h-4 w-4 mr-2" />
              {t('admin.properties.options.add')}
            </Button>
          </CardHeader>
          <CardContent>
            <PropertyOptionsTable propertyId={row.id} />
          </CardContent>
        </Card>
      )}

      <DeleteConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        onConfirm={() => {
          setConfirmOpen(false);
          handleDelete();
        }}
        title={t('admin.properties.deleteTitle')}
        warning={t('admin.properties.deleteWarning')}
      />
    </div>
  );
}
