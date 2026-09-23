import { eq, useLiveQuery } from '@tanstack/react-db';
import {
  productModificationsCollection,
  useCollection,
} from 'simplycms/admin-data';
import {
  reorderProductModification,
  setDefaultProductModification,
} from 'simplycms/admin-server';
import type { ModificationFormValues } from './modification-form-schema';

/**
 * Модифікації товару (Task 8, Step 3). CRUD — фабричні мутації колекції
 * (`insert`/`update`/`delete`, Task 4 persistence-хендлери); дефолт і
 * порядок — ІМЕНОВАНІ операції (`setDefaultProductModification`,
 * `reorderProductModification`, single-default індекс — контракт хвиль Е1б).
 */
export function useModifications(productId: string) {
  const mods = useCollection(productModificationsCollection);
  const { data: modifications } = useLiveQuery(
    (q) =>
      q
        .from({ m: mods })
        .where(({ m }) => eq(m.productId, productId))
        .orderBy(({ m }) => m.sortOrder, 'asc'),
    [productId],
  );

  const applyDefault = async (id: string) => {
    const { rows } = await setDefaultProductModification({ data: { id } });
    // Write-back УСІХ змінених (знятий і поставлений) — без refetch.
    mods.utils.writeBatch(() => {
      for (const row of rows) mods.utils.writeUpsert(row);
    });
  };

  const reorder = async (id: string, direction: 'up' | 'down') => {
    const { swapped } = await reorderProductModification({
      data: { id, direction },
    });
    mods.utils.writeBatch(() => {
      for (const row of swapped) mods.utils.writeUpsert(row);
    });
  };

  /** Повертає id нової модифікації — виклик картки перемикає дефолт-вкладку. */
  const create = async (form: ModificationFormValues): Promise<string> => {
    const id = crypto.randomUUID(); // контракт id: ключ генерує клієнт
    // 🔴 max+1 з УЖЕ завантаженого зрізу товару — нормалізує легасі-порядок
    // (там sort_order писався індексом масиву, звідси дублікати).
    const sortOrder =
      Math.max(-1, ...(modifications ?? []).map((m) => m.sortOrder ?? 0)) + 1;
    const now = new Date();
    const tx = mods.insert({
      id,
      productId,
      slug: form.slug,
      name: form.name,
      sku: form.sku || null,
      images: form.images,
      sortOrder,
      stockStatus: form.stockStatus,
      isDefault: false,
      createdAt: now,
      updatedAt: now,
    });
    await tx.isPersisted.promise;
    // Review Focus 5: дефолт — ОКРЕМОЮ операцією ПІСЛЯ insert (isDefault
    // readonly у ресурсі); її відмова — окремий тост, створення вже є.
    if (form.isDefault) await applyDefault(id);
    return id;
  };

  const update = async (id: string, form: ModificationFormValues) => {
    const tx = mods.update(id, (draft) => {
      draft.name = form.name;
      draft.slug = form.slug;
      draft.sku = form.sku || null;
      draft.images = form.images;
      draft.stockStatus = form.stockStatus;
    });
    await tx.isPersisted.promise;
    if (form.isDefault) await applyDefault(id);
  };

  const remove = (id: string) => mods.delete(id);

  return { modifications, create, update, remove, applyDefault, reorder };
}
