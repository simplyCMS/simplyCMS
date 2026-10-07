import { useLiveQuery } from '@tanstack/react-db';
import {
  discountGroupsCollection,
  discountsCollection,
  priceTypesCollection,
  useCollection,
} from 'simplycms/admin-data';
import { countGroupSubtree } from 'simplycms/domain/discounts';
import { useT } from 'simplycms/i18n';
import type { Discount, DiscountGroup } from 'simplycms/schema/types';
import { toast } from 'sonner';
import { reportTxError } from '../../../lib/report-tx-error';

/** Діти групи (`null` — корені) і знижки групи, уже впорядковані. */
export interface DiscountTreeModel {
  readonly childrenOf: (parentId: string | null) => readonly DiscountGroup[];
  readonly discountsOf: (groupId: string) => readonly Discount[];
  readonly priceTypeName: (id: string | null) => string | null;
}

function groupBy<T>(rows: readonly T[], key: (row: T) => string | null) {
  const map = new Map<string | null, T[]>();
  for (const row of rows) {
    const k = key(row);
    map.set(k, [...(map.get(k) ?? []), row]);
  }
  return map;
}

/**
 * Дерево знижок із трьох eager-колекцій. Група, чий батько зник (видалений
 * в іншій вкладці до write-back), показується коренем, а не губиться.
 * Видалення групи — `removeDiscountGroups` колекції (каскад піддерева,
 * write-back знижок там же); перемикач — фабричний update лише `isActive`.
 */
export function useDiscountTree() {
  const t = useT();
  const groups = useCollection(discountGroupsCollection);
  const discounts = useCollection(discountsCollection);
  const priceTypes = useCollection(priceTypesCollection);
  const { data: groupRows, isLoading: loadingGroups } = useLiveQuery({
    query: (q) => q.from({ g: groups }).orderBy(({ g }) => g.priority, 'asc'),
  });
  const { data: discountRows, isLoading: loadingDiscounts } = useLiveQuery({
    query: (q) =>
      q.from({ d: discounts }).orderBy(({ d }) => d.priority, 'asc'),
  });
  const { data: typeRows } = useLiveQuery({
    query: (q) => q.from({ p: priceTypes }),
  });

  const known = new Set(groupRows.map((g) => g.id));
  const byParent = groupBy(groupRows, (g) =>
    g.parentGroupId !== null && known.has(g.parentGroupId)
      ? g.parentGroupId
      : null,
  );
  const byGroup = groupBy(discountRows, (d) => d.groupId);
  const typeNames = new Map(typeRows.map((p) => [p.id, p.name]));

  const model: DiscountTreeModel = {
    childrenOf: (parentId) => byParent.get(parentId) ?? [],
    discountsOf: (groupId) => byGroup.get(groupId) ?? [],
    priceTypeName: (id) => (id === null ? null : (typeNames.get(id) ?? null)),
  };

  /** Скільки груп (РАЗОМ із самою) і знижок зникне з групою. */
  const subtreeSize = (groupId: string) => {
    const counted = countGroupSubtree(
      groupId,
      groupRows.map((g) => ({ id: g.id, parent_group_id: g.parentGroupId })),
      discountRows.map((d) => ({ group_id: d.groupId })),
    );
    // countGroupSubtree рахує лише вкладені групи — діалог називає й саму.
    return { groups: counted.groups + 1, discounts: counted.discounts };
  };

  const toggleGroup = (id: string, isActive: boolean) =>
    groups
      .update(id, (d) => {
        d.isActive = isActive;
      })
      .isPersisted.promise.then(() => toast.success(t('common.statusUpdated')))
      .catch((e: unknown) => reportTxError(t, e));

  const deleteGroup = (id: string) =>
    groups
      .delete(id)
      .isPersisted.promise.then(() =>
        toast.success(t('admin.discounts.groupDeleted')),
      )
      .catch((e: unknown) => reportTxError(t, e));

  const deleteDiscount = (id: string) =>
    discounts
      .delete(id)
      .isPersisted.promise.then(() =>
        toast.success(t('admin.discounts.deleted')),
      )
      .catch((e: unknown) => reportTxError(t, e));

  return {
    isLoading: loadingGroups || loadingDiscounts,
    model,
    subtreeSize,
    toggleGroup,
    deleteGroup,
    deleteDiscount,
  };
}
