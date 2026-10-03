import { useState } from 'react';
import { eq, useLiveQuery } from '@tanstack/react-db';
import {
  sectionPropertiesCollection,
  sectionPropertyAssignmentsCollection,
  useCollection,
} from 'simplycms/admin-data';
import type {
  SectionProperty,
  SectionPropertyAssignment,
} from 'simplycms/schema/types';
import { useT } from 'simplycms/i18n';
import { Button } from 'simplycms/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from 'simplycms/ui/table';
import { Layers, Loader2, Package, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { reportTxError } from '../../../lib/report-tx-error';
import { DeleteConfirmDialog } from '../properties/DeleteConfirmDialog';
import { PROPERTY_TYPE_LABEL } from '../properties/property-form-schema';
import { AddAssignmentDialog } from './AddAssignmentDialog';
import { availableProperties } from './available-properties';

type AppliesTo = 'product' | 'modification';

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
  const { data: assignments, isLoading: loadingAssignments } = useLiveQuery(
    (q) =>
      q
        .from({ a: assignmentsCol })
        .where(({ a }) => eq(a.sectionId, sectionId))
        .orderBy(({ a }) => a.sortOrder, 'asc'),
    [sectionId],
  );
  const { data: properties, isLoading: loadingProperties } = useLiveQuery({
    query: (q) =>
      q.from({ p: propertiesCol }).orderBy(({ p }) => p.name, 'asc'),
  });
  const [addMode, setAddMode] = useState<AppliesTo | null>(null);
  const [removeId, setRemoveId] = useState<string | null>(null);

  if (loadingAssignments || loadingProperties)
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );

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

  const renderTable = (mode: AppliesTo) => {
    const items = listFor(mode);
    const titleKey =
      mode === 'product'
        ? 'admin.properties.section.productProps'
        : 'admin.properties.section.modificationProps';
    const headingId = `assignments-${mode}`;
    return (
      <section aria-labelledby={headingId} className="space-y-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            {mode === 'product' ? (
              <Package className="h-5 w-5 text-primary" aria-hidden="true" />
            ) : (
              <Layers className="h-5 w-5 text-orange-500" aria-hidden="true" />
            )}
            <h4 id={headingId} className="font-semibold">
              {t(titleKey)}
            </h4>
            <span className="text-sm text-muted-foreground">
              ({items.length})
            </span>
          </div>
          <Button
            size="sm"
            variant="outline"
            aria-label={t(
              mode === 'product'
                ? 'admin.properties.section.addForProduct'
                : 'admin.properties.section.addForModification',
            )}
            onClick={() => setAddMode(mode)}
          >
            <Plus className="h-4 w-4 mr-2" />
            {t('common.add')}
          </Button>
        </div>
        {items.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('common.name')}</TableHead>
                <TableHead>{t('admin.common.slug')}</TableHead>
                <TableHead>{t('common.type')}</TableHead>
                <TableHead>{t('common.filter')}</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((a) => {
                const p: SectionProperty | undefined = byId.get(a.propertyId);
                // Властивість ще не довантажилась — пропускаємо рядок.
                if (!p) return null;
                return (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">
                      {p.name}
                      {p.isRequired && (
                        <span className="text-destructive ml-1">*</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground font-mono text-sm">
                      {p.slug}
                    </TableCell>
                    <TableCell>
                      {t(PROPERTY_TYPE_LABEL[p.propertyType])}
                    </TableCell>
                    <TableCell>
                      {p.isFilterable ? (
                        <span className="text-green-600">
                          {t('common.yes')}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">
                          {t('common.no')}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={t('admin.properties.section.remove')}
                        onClick={() => setRemoveId(a.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        ) : (
          <div className="text-center py-6 border rounded-lg bg-muted/30">
            <p className="text-muted-foreground">
              {t('admin.properties.empty')}
            </p>
          </div>
        )}
      </section>
    );
  };

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {renderTable('product')}
        {renderTable('modification')}
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
