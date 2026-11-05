import { products } from 'simplycms/schema';
import type { AggregateRoot } from '../../translatable/roots';

/** Корінь агрегата товару для спільних ядер `translatable/`. */
export const PRODUCT_ROOT: AggregateRoot = {
  table: products,
  id: products.id,
  version: products.version,
  touch: products.updatedAt,
  label: 'товар',
};
