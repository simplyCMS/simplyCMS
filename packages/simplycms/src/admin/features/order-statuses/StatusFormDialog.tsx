import { Loader2 } from 'lucide-react';
import { useT } from 'simplycms/i18n';
import { Button } from 'simplycms/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from 'simplycms/ui/dialog';
import { listOrderStatuses } from 'simplycms/admin-server';
import { freshAggregate } from '../translations/fresh-aggregate';
import { useCardLanguages } from '../translations/useCardLanguages';
import { StatusEditor } from './StatusEditor';
import type { StatusEditing } from './useStatusForm';
import { useStatusAggregate } from './useStatusAggregate';

interface Props {
  /** Редагований статус (рядок списку); `null` — створення. */
  editing: StatusEditing | null;
  nextSortOrder: number;
  onChanged: () => void;
  onClose: () => void;
}

/**
 * Діалог створення/редагування статусу. Монтується лише відкритим: агрегат (`get`) і мови
 * читаються свіжими на кожне відкриття, тіло форми рендериться після появи даних.
 * 🔴 `code` незмінний після створення (Е5-6): у редагуванні поле лише показується.
 */
export function StatusFormDialog(p: Props) {
  const t = useT();
  const agg = useStatusAggregate(p.editing?.id);
  const langs = useCardLanguages();
  // Збій ПЕРЕчитування (старі data лишаються) форму не знімає: його показує `kit.reload`.
  const failed = (agg.isError && !agg.data) || langs.isError;
  const ready = !!langs.data && (!p.editing || !!agg.data);

  return (
    <Dialog open onOpenChange={(o) => !o && p.onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {p.editing
              ? t('admin.orders.statuses.edit')
              : t('admin.orders.statuses.new')}
          </DialogTitle>
        </DialogHeader>
        {failed ? (
          <div className="space-y-3">
            <p className="text-destructive">
              {t('admin.orders.statuses.loadFailed')}
            </p>
            <Button
              variant="outline"
              onClick={() => {
                void agg.refetch();
                void langs.refetch();
              }}
            >
              {t('admin.translations.retry')}
            </Button>
          </div>
        ) : !ready ? (
          <Loader2 className="h-6 w-6 animate-spin mx-auto" />
        ) : (
          <StatusEditor
            editing={p.editing}
            aggregate={p.editing ? agg.data! : { version: 1, texts: {} }}
            languages={langs.data!}
            refetch={async () => {
              const fresh = freshAggregate(await agg.refetch());
              if (!fresh) return undefined;
              // Ознаки дефолту в агрегаті немає (її міняє `setDefault`) — вона з рядка списку.
              try {
                const rows = await listOrderStatuses({ data: {} });
                return {
                  ...fresh,
                  isDefault: rows.find((r) => r.id === fresh.id)?.isDefault,
                };
              } catch {
                return undefined;
              }
            }}
            nextSortOrder={p.nextSortOrder}
            onChanged={p.onChanged}
            onDone={p.onClose}
            onCancel={p.onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
