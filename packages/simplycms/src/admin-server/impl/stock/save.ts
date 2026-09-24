import { randomUUID } from 'node:crypto';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import {
  pickupPoints,
  productModifications,
  products,
  stockByPickupPoint,
} from 'simplycms/schema';
import {
  lockTargetStock,
  servingQuantity,
  syncStatusWithQuantity,
  type StockTarget,
} from 'simplycms/inventory';
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
      // М2: порожній набір — 400 на межі, а не мовчазний no-op (нічого не
      // писати й нічого не перерахувати не є валідним викликом «Зберегти»).
      .min(1)
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
 * транзакції — гвардований перехід stock_status за фактичною сумою
 * ОБСЛУГОВУЮЧИХ точок (одна копія правила з вітриною — `simplycms/inventory`).
 * Повертає рядки залишку і оновлену ціль — клієнт робить write-back в обидві
 * колекції.
 *
 * 🔴 М2 (рев'ю хвилі B): порядок локів = порядок вітрини (`sort_order, id`,
 * `simplycms/inventory`'s `lockTargetStock`) — advisory-lock лише
 * серіалізує адмін-проти-адмін (перша вставка пари ще не має рядка під
 * `FOR UPDATE`), а рядковий порядок нижче — той самий, що бере
 * `reserveStock`/`releaseStock` при оформленні/скасуванні замовлення.
 * Зворотного порядку немає — дедлоку 40P01 між адмінкою і вітриною немає.
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
    await lockCatalogTarget(
      db,
      `stock:${target.productId ?? '-'}:${target.modificationId ?? '-'}`,
    );
    // 🔴 М2: блокуються ВСІ наявні рядки цілі, не лише обслуговуючі — адмін
    // пише кількість і в НЕактивну точку (вручну). Join і порядок
    // (`pickup_points.sort_order, stock.id`) — той самий, що в
    // `lockTargetStock`, тому конкурентний запис вітрини (списання/повернення)
    // бере рядки в тій самій послідовності — дедлоку немає.
    const existing = await db
      .select({
        id: stockByPickupPoint.id,
        pickupPointId: stockByPickupPoint.pickupPointId,
      })
      .from(stockByPickupPoint)
      .innerJoin(
        pickupPoints,
        eq(pickupPoints.id, stockByPickupPoint.pickupPointId),
      )
      .where(scopeOf(target))
      .orderBy(asc(pickupPoints.sortOrder), asc(stockByPickupPoint.id))
      .for('update', { of: stockByPickupPoint });
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
    // 🔴 М2: перерахунок статусу — ЛИШЕ по ОБСЛУГОВУЮЧИХ точках
    // (`lockTargetStock`/`servingQuantity`, те саме правило, що у вітрини).
    // Стара версія сумувала `sum(quantity)` по ВСІХ рядках цілі — залишок на
    // деактивованій точці міг підняти статус у `in_stock`, хоча жодна
    // обслуговуюча точка товар не пропонує. Якщо обслуговуючих рядків
    // немає взагалі — статус НЕ чіпається (адмін пише лише в неактивну
    // точку, робити висновок про доступність нема з чого).
    const servingRows = await lockTargetStock(db, target);
    if (servingRows.length > 0)
      await syncStatusWithQuantity(db, target, servingQuantity(servingRows));
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
