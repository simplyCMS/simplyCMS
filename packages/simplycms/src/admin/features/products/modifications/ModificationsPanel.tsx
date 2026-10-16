import { useState } from 'react';
import { useT } from 'simplycms/i18n';
import { Button } from 'simplycms/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from 'simplycms/ui/card';
import { Plus } from 'lucide-react';
import type { DraftModification } from '../edit/product-form-schema';
import { useModifications } from './useModifications';
import { ModificationsTable } from './ModificationsTable';
import { ModificationDialog } from './ModificationDialog';

interface Props {
  readonly productId: string;
  /** Розділ товару — протягується в `ModificationDialog` для секції властивостей. */
  readonly sectionId: string | null;
}

/**
 * Модифікації товару: таблиця + діалог. Діалог лише ЗАСТОСОВУЄ зміни до
 * чернетки картки (`useModifications`); на сервер вони йдуть кнопкою
 * «Зберегти» картки разом з рештою агрегата.
 */
export function ModificationsPanel({ productId, sectionId }: Props) {
  const t = useT();
  const data = useModifications();
  const [editing, setEditing] = useState<DraftModification | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  // К3-Е6д-1: id нової модифікації наперед — власник її запису в чернетці.
  const [newId, setNewId] = useState(() => crypto.randomUUID());

  const openCreate = () => {
    setEditing(null);
    setNewId(crypto.randomUUID());
    setDialogOpen(true);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">
            {t('admin.products.mods.title')}
          </CardTitle>
          <Button type="button" size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1" />
            {t('common.add')}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {t('admin.translations.unsavedChildren')}
        </p>
      </CardHeader>
      <CardContent>
        <ModificationsTable
          productId={productId}
          data={data}
          onEdit={(mod) => {
            setEditing(mod);
            setDialogOpen(true);
          }}
        />
      </CardContent>
      <ModificationDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        productId={productId}
        sectionId={sectionId}
        mod={editing}
        newId={newId}
        onApply={(id, values) => data.save(id, values)}
      />
    </Card>
  );
}
