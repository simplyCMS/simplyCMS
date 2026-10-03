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
import { Layers, Package, Plus, Trash2 } from 'lucide-react';
import { PROPERTY_TYPE_LABEL } from '../properties/property-form-schema';

export type AppliesTo = 'product' | 'modification';

interface Props {
  readonly mode: AppliesTo;
  /** Призначення розділу саме для цього `appliesTo`. */
  readonly items: readonly SectionPropertyAssignment[];
  readonly byId: ReadonlyMap<string, SectionProperty>;
  readonly onAdd: () => void;
  readonly onRemove: (assignmentId: string) => void;
}

/** Таблиця призначень одного рівня (товар або модифікація). */
export function AssignmentsTable({
  mode,
  items,
  byId,
  onAdd,
  onRemove,
}: Props) {
  const t = useT();
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
            {t(
              mode === 'product'
                ? 'admin.properties.section.productProps'
                : 'admin.properties.section.modificationProps',
            )}
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
          onClick={onAdd}
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
              const p = byId.get(a.propertyId);
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
                      <span className="text-green-600">{t('common.yes')}</span>
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
                      onClick={() => onRemove(a.id)}
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
          <p className="text-muted-foreground">{t('admin.properties.empty')}</p>
        </div>
      )}
    </section>
  );
}
