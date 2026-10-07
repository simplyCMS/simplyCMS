import { inArray, useLiveQuery } from '@tanstack/react-db';
import {
  productModificationsCollection,
  productsCollection,
  sectionsCollection,
  useCollection,
} from 'simplycms/admin-data';
import type { FormTarget } from './discount-form-schema';

const idsOf = (
  targets: readonly FormTarget[],
  type: FormTarget['targetType'],
) =>
  targets.flatMap((t) =>
    t.targetType === type && t.targetId ? [t.targetId] : [],
  );

/**
 * Назви вибраних цілей. Розділи — eager-довідник; товари й модифікації —
 * on-demand зрізи `inArray` лише за id цілей (каталог цілком не вантажиться).
 * 🔴 Порожній `inArray` сервер відбиває — порожній список вимикає запит
 * (патерн `usePropertySchema`). `undefined` — назви немає (ціль видалено
 * або зріз ще летить): рядок показує це сам.
 */
export function useTargetLabels(
  targets: readonly FormTarget[],
): (target: FormTarget) => string | undefined {
  const sectionsCol = useCollection(sectionsCollection);
  const productsCol = useCollection(productsCollection);
  const modsCol = useCollection(productModificationsCollection);
  const productIds = idsOf(targets, 'product');
  const modIds = idsOf(targets, 'modification');

  const { data: sections } = useLiveQuery({
    query: (q) => q.from({ s: sectionsCol }),
  });
  const { data: products } = useLiveQuery({
    query: (q) =>
      productIds.length === 0
        ? undefined
        : q
            .from({ p: productsCol })
            .where(({ p }) => inArray(p.id, productIds)),
  });
  const { data: mods } = useLiveQuery({
    query: (q) =>
      modIds.length === 0
        ? undefined
        : q.from({ m: modsCol }).where(({ m }) => inArray(m.id, modIds)),
  });

  const names = new Map<string, string>();
  for (const row of [...sections, ...(products ?? []), ...(mods ?? [])])
    names.set(row.id, row.name);
  return (target) =>
    target.targetId === null ? undefined : names.get(target.targetId);
}
