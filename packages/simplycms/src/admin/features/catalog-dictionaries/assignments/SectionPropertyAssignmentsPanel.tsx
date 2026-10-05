import { useState } from 'react';
import { eq, useLiveQuery } from '@tanstack/react-db';
import {
  sectionPropertiesCollection,
  sectionPropertyAssignmentsCollection,
  useCollection,
} from 'simplycms/admin-data';
import type { SectionPropertyAssignment } from 'simplycms/schema/types';
import { useT } from 'simplycms/i18n';
import { toast } from 'sonner';
import { reportTxError } from '../../../lib/report-tx-error';
import { DeleteConfirmDialog } from '../DeleteConfirmDialog';
import { BlockSpinner } from '../PageStates';
import { AddAssignmentDialog } from './AddAssignmentDialog';
import { AssignmentsTable, type AppliesTo } from './AssignmentsTable';
import { availableProperties } from './available-properties';

/**
 * Властивості розділу (Е4, Task 8) — заміна легасі-менеджера на
 * `supabase-js` (components/, видалено). Призначення — зріз `where sectionId`;
 * назви властивостей — окремий повний зріз довідника (без join on-demand ×
 * on-demand, контракт Е3), він же — джерело для діалогу додавання.
 */
export function SectionPropertyAssignmentsPanel({
  sectionId,
}: {
  sectionId: string;
}) {
  const t = useT();
  const assignmentsCol = useCollection(sectionPropertyAssignmentsCollection);
  const propertiesCol = useCollection(sectionPropertiesCollection);
  const { data: assignments, isLoading: loadingAssignments } = useLiveQuery({
    query: (q) =>
      q
        .from({ a: assignmentsCol })
        .where(({ a }) => eq(a.sectionId, sectionId))
        .orderBy(({ a }) => a.sortOrder, 'asc'),
  });
  const { data: properties, isLoading: loadingProperties } = useLiveQuery({
    query: (q) =>
      q.from({ p: propertiesCol }).orderBy(({ p }) => p.name, 'asc'),
  });
  const [addMode, setAddMode] = useState<AppliesTo | null>(null);
  const [removeId, setRemoveId] = useState<string | null>(null);

  if (loadingAssignments || loadingProperties) return <BlockSpinner />;

  const byId = new Map(properties.map((p) => [p.id, p]));
  const listFor = (mode: AppliesTo) =>
    assignments.filter((a) => a.appliesTo === mode);

  const handleAdd = (propertyId: string, mode: AppliesTo) => {
    const draft: SectionPropertyAssignment = {
      id: crypto.randomUUID(),
      sectionId,
      propertyId,
      appliesTo: mode,
      sortOrder: listFor(mode).length,
      createdAt: new Date(),
    };
    assignmentsCol
      .insert(draft)
      .isPersisted.promise.then(() =>
        toast.success(t('admin.properties.section.added')),
      )
      .catch((e: unknown) => reportTxError(t, e));
  };

  const handleRemove = (id: string) => {
    setRemoveId(null);
    assignmentsCol
      .delete(id)
      .isPersisted.promise.then(() =>
        toast.success(t('admin.properties.section.removed')),
      )
      .catch((e: unknown) => reportTxError(t, e));
  };

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {(['product', 'modification'] as const).map((mode) => (
          <AssignmentsTable
            key={mode}
            mode={mode}
            items={listFor(mode)}
            byId={byId}
            onAdd={() => setAddMode(mode)}
            onRemove={setRemoveId}
          />
        ))}
      </div>
      <AddAssignmentDialog
        open={addMode !== null}
        onOpenChange={(open) => !open && setAddMode(null)}
        appliesTo={addMode ?? 'product'}
        properties={availableProperties(properties, assignments)}
        onAdd={(propertyId) => {
          const mode = addMode ?? 'product';
          setAddMode(null);
          handleAdd(propertyId, mode);
        }}
      />
      <DeleteConfirmDialog
        open={removeId !== null}
        onOpenChange={(open) => !open && setRemoveId(null)}
        onConfirm={() => removeId && handleRemove(removeId)}
        title={t('admin.properties.section.removeTitle')}
        warning={t('admin.properties.section.removeWarning')}
      />
    </div>
  );
}
