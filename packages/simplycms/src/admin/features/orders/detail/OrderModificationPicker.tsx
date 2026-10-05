import { eq, useLiveQuery } from '@tanstack/react-db';
import {
  productModificationsCollection,
  useCollection,
} from 'simplycms/admin-data';
import { useT } from 'simplycms/i18n';
import { cn } from 'simplycms/ui/utils';

interface Props {
  readonly productId: string;
  readonly productName: string;
  readonly value: string | null;
  readonly onChange: (modificationId: string) => void;
}

/** Модифікації вибраного товару — зріз колекції `where productId` (on-demand, Е3). */
export function OrderModificationPicker({
  productId,
  productName,
  value,
  onChange,
}: Props) {
  const t = useT();
  const mods = useCollection(productModificationsCollection);
  const { data, isLoading } = useLiveQuery({
    query: (q) =>
      q
        .from({ m: mods })
        .where(({ m }) => eq(m.productId, productId))
        .orderBy(({ m }) => m.sortOrder, 'asc'),
  });
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">
        {t('admin.orders.pickModification', { name: productName })}
      </p>
      {!isLoading && data.length === 0 && (
        <p className="text-sm text-muted-foreground">
          {t('admin.orders.modificationsEmpty')}
        </p>
      )}
      <ul className="space-y-1">
        {data.map((m) => (
          <li key={m.id}>
            <button
              type="button"
              aria-pressed={value === m.id}
              className={cn(
                'w-full rounded-md border p-2 text-left hover:bg-accent',
                value === m.id && 'border-primary bg-accent',
              )}
              onClick={() => onChange(m.id)}
            >
              {m.name}
              {m.sku && (
                <span className="ml-2 text-xs text-muted-foreground">
                  {t('admin.orders.sku')} {m.sku}
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
