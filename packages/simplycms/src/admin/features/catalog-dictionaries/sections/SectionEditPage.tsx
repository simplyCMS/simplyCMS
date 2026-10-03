import { useState } from 'react';
import { useParams, Link } from '@tanstack/react-router';
import { useWatch } from 'react-hook-form';
import { useT } from 'simplycms/i18n';
import { Button } from 'simplycms/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from 'simplycms/ui/card';
import { Trash2 } from 'lucide-react';
import { adminPath } from '../../../lib/adminLinks';
import { CardPageHeader, SubmitButton } from '../CardPageHeader';
import { DeleteConfirmDialog } from '../DeleteConfirmDialog';
import { NotFoundState, PageSpinner } from '../PageStates';
import { SectionPropertyAssignmentsPanel } from '../assignments/SectionPropertyAssignmentsPanel';
import { SectionMainCards } from './SectionMainCards';
import { SectionSideCards } from './SectionSideCards';
import { useSectionCard } from './useSectionCard';

/**
 * Картка розділу (Е4, Task 7): `new` або id з URL. Рядок — жива колекція,
 * стан і операції — `useSectionCard`.
 */
export default function SectionEditPage() {
  const t = useT();
  const { sectionId } = useParams({ strict: false }) as { sectionId?: string };
  const { isNew, isLoading, row, entityId, form, onSubmit, handleDelete } =
    useSectionCard(sectionId);
  const nameValue = useWatch({ control: form.control, name: 'name' });
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (!isNew && isLoading) return <PageSpinner />;

  if (!isNew && !row)
    return (
      <NotFoundState
        backTo={adminPath('sections')}
        message={t('admin.sections.notFound')}
      />
    );

  return (
    <div className="space-y-6">
      <CardPageHeader
        backTo={adminPath('sections')}
        title={
          isNew
            ? t('admin.sections.new')
            : nameValue || t('admin.sections.editTitle')
        }
        subtitle={
          isNew
            ? t('admin.sections.newSubtitle')
            : t('admin.sections.editTitle')
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

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <SectionMainCards form={form} />
          <SectionSideCards form={form} entityId={entityId} />
        </div>
        <div className="flex justify-end gap-4">
          <Button variant="outline" asChild>
            <Link to={adminPath('sections')}>{t('common.cancel')}</Link>
          </Button>
          <SubmitButton pending={form.formState.isSubmitting}>
            {isNew ? t('common.create') : t('common.save')}
          </SubmitButton>
        </div>
      </form>
      {row && (
        <Card>
          <CardHeader>
            <CardTitle>{t('admin.properties.section.title')}</CardTitle>
          </CardHeader>
          <CardContent>
            <SectionPropertyAssignmentsPanel sectionId={row.id} />
          </CardContent>
        </Card>
      )}
      <DeleteConfirmDialog
        title={t('admin.sections.deleteTitle')}
        warning={t('admin.sections.deleteWarning')}
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
