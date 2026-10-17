import type { Dispatch, SetStateAction } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import type { StockStatus } from 'simplycms/contracts';
import { withStockStatus } from './product-aggregate';
import type { ProductFormValues } from './product-form-schema';

interface CardState<A> {
  readonly agg: A;
  readonly baseline: ProductFormValues;
}

/**
 * `saveStock` вивів статус цілі: знімок оновлюємо завжди (інакше наступне
 * збереження шле зайвий статус), а поле форми — лише якщо користувач його не
 * міняв (збережений ручний вибір не затираємо мовчки).
 */
export function useStockStatusSync<A>(
  form: UseFormReturn<ProductFormValues>,
  baseline: ProductFormValues,
  setState: Dispatch<SetStateAction<CardState<A>>>,
) {
  return (modificationId: string | null, status: StockStatus) => {
    const cur = form.getValues();
    const untouched =
      modificationId === null
        ? cur.stockStatus === baseline.stockStatus
        : cur.modifications.find((m) => m.id === modificationId)
            ?.stockStatus ===
          baseline.modifications.find((m) => m.id === modificationId)
            ?.stockStatus;
    setState((s) => ({
      ...s,
      baseline: withStockStatus(s.baseline, modificationId, status),
    }));
    if (!untouched) return;
    if (modificationId === null) form.setValue('stockStatus', status);
    else
      form.setValue(
        'modifications',
        withStockStatus(cur, modificationId, status).modifications,
      );
  };
}
