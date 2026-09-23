import { eq, useLiveQuery } from '@tanstack/react-db';
import {
  modificationPropertyValuesCollection,
  productPropertyValuesCollection,
  useCollection,
} from 'simplycms/admin-data';
import { useT } from 'simplycms/i18n';
import { reportTxError } from '../../../lib/report-tx-error';

export type PropertyValueTarget = 'product' | 'modification';

export interface PropertyValueDraft {
  readonly value: string | null;
  readonly numericValue: string | null;
  readonly optionId: string | null;
}

interface ValueRow extends PropertyValueDraft {
  readonly id: string;
  readonly propertyId: string;
}

/**
 * Значення властивостей власника — товару (`target='product'`) або
 * модифікації (`target='modification'`) — Task 10, Step 2. Автозбереження
 * (Е3-11): кожна зміна — оптимістична мутація фабричних персист-хендлерів
 * колекції; multiselect — рядок на опцію (Е3-13), унікальність тримає БД.
 *
 * 🔴 Обидві колекції підписані БЕЗУМОВНО (правило хуків) — активна за
 * `target`, неактивна вимкнена `undefined` з білдера (нуль мережевих
 * запитів на неактивний зріз, той самий патерн, що `usePropertySchema`).
 */
export function usePropertyValues(
  target: PropertyValueTarget,
  ownerId: string,
) {
  const t = useT();
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

  // Без `.catch` — відхилена мутація тихо відкочується (бібліотека сама) і
  // лишає unhandled rejection у консолі (той самий урок, що
  // `ModificationStatusControl`/`SimpleProductPanel`).
  const track = (tx: { isPersisted: { promise: Promise<unknown> } }) =>
    tx.isPersisted.promise.catch((e: unknown) => reportTxError(t, e));

  const insertRow = (propertyId: string, v: PropertyValueDraft) => {
    const base = {
      id: crypto.randomUUID(), // контракт id: ключ генерує клієнт
      propertyId,
      value: v.value,
      numericValue: v.numericValue,
      optionId: v.optionId,
      createdAt: new Date(),
    };
    track(
      target === 'product'
        ? productCol.insert({ ...base, productId: ownerId })
        : modCol.insert({ ...base, modificationId: ownerId }),
    );
  };
  const updateRow = (id: string, v: PropertyValueDraft) => {
    track(
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
          }),
    );
  };
  const deleteRows = (ids: readonly string[]) => {
    if (ids.length === 0) return;
    track(
      target === 'product'
        ? productCol.delete([...ids])
        : modCol.delete([...ids]),
    );
  };

  /** Скалярні типи (text/number/range/boolean/color/select): один рядок. */
  const saveScalar = (propertyId: string, v: PropertyValueDraft) => {
    const existing = rowsOf(propertyId)[0];
    const empty = v.value === null || v.value === '';
    if (existing && empty) return deleteRows([existing.id]);
    if (existing) return updateRow(existing.id, v);
    if (!empty) return insertRow(propertyId, v);
  };

  /** Multiselect: бажаний набір опцій → вставити відсутні, видалити зайві. */
  const saveMulti = (
    propertyId: string,
    optionIds: readonly string[],
    nameOf: (optionId: string) => string,
  ) => {
    const current = rowsOf(propertyId);
    const have = new Set(current.map((r) => r.optionId));
    const toDelete = current.filter(
      (r) => !r.optionId || !optionIds.includes(r.optionId),
    );
    deleteRows(toDelete.map((r) => r.id));
    for (const optionId of optionIds.filter((id) => !have.has(id)))
      insertRow(propertyId, {
        value: nameOf(optionId),
        numericValue: null,
        optionId,
      });
  };

  return { rowsOf, saveScalar, saveMulti };
}
