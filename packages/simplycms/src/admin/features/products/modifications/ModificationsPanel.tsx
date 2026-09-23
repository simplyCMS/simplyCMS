import { useState } from 'react';
import { toast } from 'sonner';
import { useT } from 'simplycms/i18n';
import type { ProductModification } from 'simplycms/schema/types';
import { Button } from 'simplycms/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from 'simplycms/ui/card';
import { Plus } from 'lucide-react';
import { useModifications } from './useModifications';
import { ModificationsTable } from './ModificationsTable';
import { ModificationDialog } from './ModificationDialog';
import type { ModificationFormValues } from './modification-form-schema';

interface Props {
  readonly productId: string;
  /** Розділ товару — для секції властивостей діалогу (Task 10, поки проп без вжитку). */
  readonly sectionId: string | null;
}

/**
 * Модифікації товару (Task 8, Step 3–4) — картка легасі
 * `ProductModifications.tsx`: таблиця + діалог створення/редагування.
 * Дефолт і порядок — іменовані операції `useModifications`.
 */
export function ModificationsPanel({ productId, sectionId }: Props) {
  const t = useT();
  const data = useModifications(productId);
  const [editing, setEditing] = useState<ProductModification | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };
  const openEdit = (mod: ProductModification) => {
    setEditing(mod);
    setDialogOpen(true);
  };

  // 🔴 Помилку тут НЕ ловимо: `ModificationDialog.submit` сам мапить її
  // через `adminErrorKey` і лишає діалог відкритим (Review Focus 1) —
  // подвійний catch дав би два тости на одну відмову.
  const handleCreate = async (values: ModificationFormValues) => {
    const id = await data.create(values);
    toast.success(t('admin.products.mods.created'));
    return id;
  };
  const handleUpdate = async (id: string, values: ModificationFormValues) => {
    await data.update(id, values);
    toast.success(t('admin.products.mods.updated'));
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
      </CardHeader>
      <CardContent>
        <ModificationsTable
          productId={productId}
          data={data}
          onEdit={openEdit}
        />
      </CardContent>
      <ModificationDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        productId={productId}
        sectionId={sectionId}
        mod={editing}
        onCreate={handleCreate}
        onUpdate={handleUpdate}
      />
    </Card>
  );
}
