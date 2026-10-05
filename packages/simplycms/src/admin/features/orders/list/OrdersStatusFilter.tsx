import { useLiveQuery } from '@tanstack/react-db';
import { orderStatusesCollection, useCollection } from 'simplycms/admin-data';
import { useT } from 'simplycms/i18n';
import { Label } from 'simplycms/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from 'simplycms/ui/select';

// Radix Select не приймає порожній рядок як value — сентинел «усі».
const ALL = '__all__';

interface Props {
  readonly statusId: string | undefined;
  readonly onChange: (statusId: string | undefined) => void;
}

/** Фільтр списку замовлень за статусом (довідник статусів — eager). */
export default function OrdersStatusFilter({ statusId, onChange }: Props) {
  const t = useT();
  const statuses = useCollection(orderStatusesCollection);
  const { data: rows } = useLiveQuery({
    query: (q) =>
      q.from({ s: statuses }).orderBy(({ s }) => s.sortOrder, 'asc'),
  });
  return (
    <div className="space-y-1.5">
      <Label htmlFor="orders-filter-status">
        {t('admin.orders.filters.status')}
      </Label>
      <Select
        value={statusId ?? ALL}
        onValueChange={(v) => onChange(v === ALL ? undefined : v)}
      >
        <SelectTrigger id="orders-filter-status" className="w-56">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{t('admin.orders.filters.all')}</SelectItem>
          {rows.map((s) => (
            <SelectItem key={s.id} value={s.id}>
              {s.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
