import { useLiveQuery } from '@tanstack/react-db';
import {
  priceTypesCollection,
  useCollection,
  userCategoriesCollection,
} from 'simplycms/admin-data';

/** Назви типів цін і категорій за id: діагностика повертає лише id. */
export function useCatalogNames() {
  const priceTypes = useCollection(priceTypesCollection);
  const categories = useCollection(userCategoriesCollection);
  const { data: types } = useLiveQuery({
    query: (q) => q.from({ p: priceTypes }),
  });
  const { data: cats } = useLiveQuery({
    query: (q) => q.from({ c: categories }),
  });
  return {
    priceTypeName: (id: string | null) =>
      types.find((p) => p.id === id)?.name ?? null,
    categoryName: (id: string | null) =>
      cats.find((c) => c.id === id)?.name ?? null,
  };
}
