import { orderStatuses } from 'simplycms/schema';
import type { AggregateRoot } from '../translatable/roots';

/** Корінь агрегата статусу: без `updated_at` (таблиця його не має). */
export const ORDER_STATUS_ROOT: AggregateRoot = {
  table: orderStatuses,
  id: orderStatuses.id,
  version: orderStatuses.version,
  label: 'статус замовлення',
};
