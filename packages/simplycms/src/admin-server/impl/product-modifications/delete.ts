import { and, inArray } from 'drizzle-orm';
import type { ActorDb } from 'simplycms/db';
import { productModifications } from 'simplycms/schema';

/** Які модифікації видалити: усі модифікації товарів, задані id, або перетин. */
export interface ModificationsToDelete {
  readonly productIds?: readonly string[];
  readonly ids?: readonly string[];
}

/**
 * ЄДИНИЙ видаляч рядків `product_modifications` (М1, Task 14): опис товару
 * (`saveDescription`), пакетний `remove` ресурсу модифікацій і `products.remove`
 * (до видалення самого товару). Спершу `FOR UPDATE ... ORDER BY id`, потім DELETE
 * рівно заблокованих рядків.
 * 🔴 Порядок id — той самий, у якому `languages.fill` бере `FOR KEY SHARE` модифікацій
 * (`copyTokensForLocale`); власний DELETE ішов би в порядку плану (heap при seq scan),
 * і два пакети зустрічались би на рядках у протилежних порядках (40P01). Викликач
 * тримає корінь товару (порядок «set -> корінь -> модифікації», `lock-order.ts`). Інший код
 * рядки модифікацій напряму не видаляє: узагальнений DELETE фабрики (`removeResourceRows`)
 * на цій таблиці кидає помилку, сирі й аліасні DELETE ловить сканер `modifications-deleter`.
 */
export async function deleteModifications(
  db: ActorDb,
  which: ModificationsToDelete,
): Promise<{ count: number }> {
  if (!which.productIds && !which.ids)
    throw new Error('[deleteModifications] потрібні productIds або ids');
  if (which.productIds?.length === 0 || which.ids?.length === 0)
    return { count: 0 };
  const m = productModifications;
  const where = and(
    which.productIds ? inArray(m.productId, [...which.productIds]) : undefined,
    which.ids ? inArray(m.id, [...which.ids]) : undefined,
  );
  const locked = await db
    .select({ id: m.id })
    .from(m)
    .where(where)
    .orderBy(m.id)
    .for('update');
  if (locked.length === 0) return { count: 0 };
  const rows = await db
    .delete(productModifications)
    .where(
      inArray(
        m.id,
        locked.map((r) => r.id),
      ),
    )
    .returning({ id: m.id });
  return { count: rows.length };
}
