import { useT } from 'simplycms/i18n';
import { reportTxError } from '../../../lib/report-tx-error';
import { useKeyedQueue } from './useKeyedQueue';
import {
  usePropertyValueTx,
  type PropertyValueDraft,
  type PropertyValueTarget,
  type Tx,
} from './usePropertyValueTx';

export type { PropertyValueDraft, PropertyValueTarget };

/**
 * Значення властивостей власника — товару (`target='product'`) або
 * модифікації (`target='modification'`) — Task 10, Step 2. Автозбереження
 * (Е3-11): кожна зміна — оптимістична мутація фабричних персист-хендлерів
 * колекції (`usePropertyValueTx`); multiselect — рядок на опцію (Е3-13),
 * унікальність тримає БД.
 *
 * 🔴 Е3-19б: операції серіалізовані `useKeyedQueue` на ключ `propertyId`
 * — наступна стартує ЛИШЕ ПІСЛЯ `isPersisted` (або відхилення) попередньої
 * (паралельні авто-транзакції `@tanstack/db` інакше могли виконатись у
 * будь-якому порядку — update випереджав insert того самого рядка).
 * Дельта (insert/update/delete) рахується від ЖИВОГО стану колекції
 * (`liveRowsOf`) на момент СТАРТУ операції, не кліку.
 */
export function usePropertyValues(
  target: PropertyValueTarget,
  ownerId: string,
) {
  const t = useT();
  const { rowsOf, liveRowsOf, insertTx, updateTx, deleteTx } =
    usePropertyValueTx(target, ownerId);
  const enqueue = useKeyedQueue((e) => reportTxError(t, e));

  /**
   * Скалярні типи (text/number/range/boolean/color) і `select` (один
   * option-рядок): один рядок. 🔴 «Порожньо» — і `value`, і `optionId`
   * відсутні: `select` пише `value: null` завжди (Е3-13, ревізія «назва
   * опції — одне джерело»), тож голого `v.value === null` досить було б,
   * щоб трактувати щойно вибрану опцію як видалення рядка.
   */
  const saveScalar = (propertyId: string, v: PropertyValueDraft) => {
    enqueue(propertyId, async () => {
      const existing = liveRowsOf(propertyId)[0];
      const empty = (v.value === null || v.value === '') && v.optionId === null;
      const tx =
        existing && empty
          ? deleteTx([existing.id])
          : existing
            ? updateTx(existing.id, v)
            : !empty
              ? insertTx(propertyId, v)
              : null;
      if (tx) await tx.isPersisted.promise;
    });
  };

  /**
   * Multiselect: бажаний набір опцій → вставити відсутні, видалити зайві.
   * 🔴 `value` рядка не пишемо (Е3-13, ревізія): назву для відображення
   * бере join `property_options` (`option.name`), а не кеш у `value`.
   */
  const saveMulti = (propertyId: string, optionIds: readonly string[]) => {
    enqueue(propertyId, async () => {
      const current = liveRowsOf(propertyId);
      const have = new Set(current.map((r) => r.optionId));
      const toDelete = current.filter(
        (r) => !r.optionId || !optionIds.includes(r.optionId),
      );
      const toInsert = optionIds.filter((id) => !have.has(id));
      const txs: Tx[] = [];
      const delTx = deleteTx(toDelete.map((r) => r.id));
      if (delTx) txs.push(delTx);
      for (const optionId of toInsert)
        txs.push(
          insertTx(propertyId, {
            value: null,
            numericValue: null,
            optionId,
          }),
        );
      const results = await Promise.allSettled(
        txs.map((tx) => tx.isPersisted.promise),
      );
      const rejected = results.find(
        (r): r is PromiseRejectedResult => r.status === 'rejected',
      );
      if (rejected) throw rejected.reason;
    });
  };

  return { rowsOf, saveScalar, saveMulti };
}
