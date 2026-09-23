import { randomUUID } from 'node:crypto';
import { and, eq, isNull, sum } from 'drizzle-orm';
import { z } from 'zod';
import {
  productModifications,
  products,
  stockByPickupPoint,
} from 'simplycms/schema';
import { syncStatusWithQuantity, type StockTarget } from 'simplycms/inventory';
import type {
  Product,
  ProductModification,
  StockByPickupPoint,
} from 'simplycms/schema/types';
import { runAdmin } from '../run';
import { lockCatalogTarget } from '../catalog-lock';

// 🔴 Той самий принцип, що в product-modifications/*.ts: типи зі
// schema/types (Drizzle `$inferSelect`), не rowSchema-каст — обидві таблиці
// (products, product_modifications) мають jsonb-колонки, типізовані в
// джерелі (`schema.ts`: `.$type<string[]>()` на `images`), тож голе
// `$inferSelect` уже серіалізовне для createServerFn.
type ProductRow = Product;
type ModificationRow = ProductModification;

export const saveStockInput = z
  .object({
    productId: z.uuid().nullable(),
    modificationId: z.uuid().nullable(),
    quantities: z
      .array(
        z.object({
          pickupPointId: z.uuid(),
          quantity: z.number().int().min(0).max(1_000_000),
        }),
      )
      .max(200),
  })
  // Рівно одна ціль — дзеркало check-обмеження stock_product_or_modification.
  .refine((d) => (d.productId === null) !== (d.modificationId === null), {
    message: 'потрібна рівно одна ціль: товар АБО модифікація',
  });

const scopeOf = (t: StockTarget) =>
  t.modificationId
    ? eq(stockByPickupPoint.modificationId, t.modificationId)
    : and(
        eq(stockByPickupPoint.productId, t.productId as string),
        isNull(stockByPickupPoint.modificationId),
      );

/**
 * Ручний облік (Е3-3): upsert кількостей по точках і в ТІЙ САМІЙ
 * транзакції — гвардований перехід stock_status за фактичною сумою (одна
 * копія правила з вітриною — simplycms/inventory). Повертає рядки залишку
 * і оновлену ціль — клієнт робить write-back в обидві колекції.
 */
export const saveStockOp = async ({
  data,
}: {
  data: z.infer<typeof saveStockInput>;
}) =>
  runAdmin('catalog.write', async (db) => {
    const target: StockTarget = {
      productId: data.productId,
      modificationId: data.modificationId,
    };
    // Порядок локів той самий, що у вітрини (залишок → ціль): advisory не
    // рахується, далі рядки залишку, останнім — рядок товару в
    // syncStatusWithQuantity. Зворотного порядку немає — дедлоку немає.
    await lockCatalogTarget(
      db,
      `stock:${target.productId ?? '-'}:${target.modificationId ?? '-'}`,
    );
    const existing = await db
      .select()
      .from(stockByPickupPoint)
      .where(scopeOf(target))
      .for('update');
    const byPoint = new Map(existing.map((r) => [r.pickupPointId, r]));
    const now = new Date();
    // Явний тип: пакетний tsconfig (noImplicitAny: false) виводить `[]` як never[].
    const rows: StockByPickupPoint[] = [];
    for (const q of data.quantities) {
      const row = byPoint.get(q.pickupPointId);
      const [saved] = row
        ? await db
            .update(stockByPickupPoint)
            .set({ quantity: q.quantity, updatedAt: now })
            .where(eq(stockByPickupPoint.id, row.id))
            .returning()
        : await db
            .insert(stockByPickupPoint)
            .values({
              id: randomUUID(),
              pickupPointId: q.pickupPointId,
              ...target,
              quantity: q.quantity,
            })
            .returning();
      rows.push(saved!);
    }
    const [{ total }] = await db
      .select({ total: sum(stockByPickupPoint.quantity) })
      .from(stockByPickupPoint)
      .where(scopeOf(target));
    await syncStatusWithQuantity(db, target, Number(total ?? 0));
    const updated: ModificationRow | ProductRow | undefined =
      target.modificationId
        ? (
            (await db
              .select()
              .from(productModifications)
              .where(
                eq(productModifications.id, target.modificationId),
              )) as ModificationRow[]
          )[0]
        : (
            (await db
              .select()
              .from(products)
              .where(
                eq(products.id, target.productId as string),
              )) as ProductRow[]
          )[0];
    if (!updated) throw new Error('[admin-server] ціль залишку не існує');
    return { rows, target: updated };
  });
