import { eq, useLiveQuery } from '@tanstack/react-db';
import {
  modificationPropertyValuesCollection,
  productPropertyValuesCollection,
  useCollection,
} from 'simplycms/admin-data';

export type PropertyValueTarget = 'product' | 'modification';

export interface PropertyValueDraft {
  readonly value: string | null;
  readonly numericValue: string | null;
  readonly optionId: string | null;
}

export interface ValueRow extends PropertyValueDraft {
  readonly id: string;
  readonly propertyId: string;
}

export interface Tx {
  readonly isPersisted: { readonly promise: Promise<unknown> };
}

/**
 * Доступ до колекцій значень властивостей (товар/модифікація) — винесено
 * з `usePropertyValues` (канон 150 рядків). `rowsOf` — React-рендер
 * (`useLiveQuery`, для UI); `liveRowsOf` — синхронний зріз ЖИВОГО стану
 * колекції для черги (Е3-19б): дельта рахується НА СТАРТ операції, а не
 * на клік, і `rowsOf` для цього застарий (оновлюється не синхронно з
 * оптимістичною мутацією тієї ж черги).
 *
 * 🔴 Обидві колекції підписані БЕЗУМОВНО (правило хуків) — активна за
 * `target`, неактивна вимкнена `undefined` з білдера (нуль мережевих
 * запитів на неактивний зріз, той самий патерн, що `usePropertySchema`).
 */
export function usePropertyValueTx(
  target: PropertyValueTarget,
  ownerId: string,
) {
  const productCol = useCollection(productPropertyValuesCollection);
  const modCol = useCollection(modificationPropertyValuesCollection);

  const { data: productRows } = useLiveQuery(
    (q) =>
      target === 'product'
        ? q.from({ v: productCol }).where(({ v }) => eq(v.productId, ownerId))
        : undefined,
    [target, ownerId],
  );
  const { data: modRows } = useLiveQuery(
    (q) =>
      target === 'modification'
        ? q.from({ v: modCol }).where(({ v }) => eq(v.modificationId, ownerId))
        : undefined,
    [target, ownerId],
  );
  const rows: readonly ValueRow[] =
    target === 'product' ? (productRows ?? []) : (modRows ?? []);
  const rowsOf = (propertyId: string) =>
    rows.filter((r) => r.propertyId === propertyId);

  const liveRowsOf = (propertyId: string): readonly ValueRow[] =>
    target === 'product'
      ? productCol.toArray.filter(
          (r) => r.propertyId === propertyId && r.productId === ownerId,
        )
      : modCol.toArray.filter(
          (r) => r.propertyId === propertyId && r.modificationId === ownerId,
        );

  const insertTx = (propertyId: string, v: PropertyValueDraft): Tx => {
    const base = {
      id: crypto.randomUUID(), // контракт id: ключ генерує клієнт
      propertyId,
      value: v.value,
      numericValue: v.numericValue,
      optionId: v.optionId,
      createdAt: new Date(),
    };
    return target === 'product'
      ? productCol.insert({ ...base, productId: ownerId })
      : modCol.insert({ ...base, modificationId: ownerId });
  };
  const updateTx = (id: string, v: PropertyValueDraft): Tx =>
    target === 'product'
      ? productCol.update(id, (d) => {
          d.value = v.value;
          d.numericValue = v.numericValue;
          d.optionId = v.optionId;
        })
      : modCol.update(id, (d) => {
          d.value = v.value;
          d.numericValue = v.numericValue;
          d.optionId = v.optionId;
        });
  const deleteTx = (ids: readonly string[]): Tx | null =>
    ids.length === 0
      ? null
      : target === 'product'
        ? productCol.delete([...ids])
        : modCol.delete([...ids]);

  return { rowsOf, liveRowsOf, insertTx, updateTx, deleteTx };
}
