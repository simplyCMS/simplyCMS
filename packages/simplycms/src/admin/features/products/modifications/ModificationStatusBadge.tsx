import { useT } from 'simplycms/i18n';
import type { StockStatus } from 'simplycms/contracts';

const STYLE: Record<string, string> = {
  in_stock:
    'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  out_of_stock: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  on_order:
    'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
};

interface Props {
  readonly status: StockStatus | null;
}

/** Бейдж статусу наявності модифікації — легасі `getStatusBadge` (Task 8). */
export function ModificationStatusBadge({ status }: Props) {
  const t = useT();
  if (!status) return null;
  // 🔴 `stock.none` (не `stock.outOfStock`) — легасі свідомо тримало коротший
  // підпис для бейджа таблиці й довший для селекта форми (два різні ключі).
  const label =
    status === 'in_stock'
      ? t('admin.products.stock.inStock')
      : status === 'out_of_stock'
        ? t('admin.products.stock.none')
        : t('admin.products.stock.onOrder');
  return (
    <span
      className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${STYLE[status] ?? ''}`}
    >
      {label}
    </span>
  );
}
