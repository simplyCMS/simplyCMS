import { randomUUID } from 'node:crypto';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { productPrices } from 'simplycms/schema';
import { MONEY_RE } from 'simplycms/domain/money';
import type { ProductPrice } from 'simplycms/schema/types';
import { runAdmin } from '../run';
import { lockCatalogTarget } from '../catalog-lock';

const money = z.string().regex(MONEY_RE);

export const saveProductPricesInput = z.object({
  productId: z.uuid(),
  modificationId: z.uuid().nullable(),
  prices: z
    .array(
      z.object({
        priceTypeId: z.uuid(),
        price: money,
        oldPrice: money.nullable(),
      }),
    )
    .max(50)
    // 🔴 Один тип ціни — один рядок набору: дубль у вході дав би 23505
    // посеред транзакції замість чіткої 400.
    .refine((p) => new Set(p.map((x) => x.priceTypeId)).size === p.length, {
      message: 'тип ціни повторюється',
    }),
});

/**
 * Атомарна заміна набору цін пари товар/модифікація (Е3-10): типи з входу —
 * upsert, решта наявних — delete. Композитний ключ (price_type, product,
 * COALESCE(modification)) фабричним upsert-ом не виражається, тому рядки
 * пари блокуються FOR UPDATE і розбираються явно. id нових — сервер
 * (контракт id: ключ передає викликач INSERT, тут викликач — сервер).
 */
export const saveProductPricesOp = async ({
  data,
}: {
  data: z.infer<typeof saveProductPricesInput>;
}) =>
  runAdmin('catalog.write', async (db) => {
    // Перша вставка пари не має рядка під FOR UPDATE — серіалізуємо ціль (catalog-lock.ts).
    await lockCatalogTarget(
      db,
      `prices:${data.productId}:${data.modificationId ?? '-'}`,
    );
    const scope = and(
      eq(productPrices.productId, data.productId),
      data.modificationId
        ? eq(productPrices.modificationId, data.modificationId)
        : isNull(productPrices.modificationId),
    );
    const existing = await db
      .select()
      .from(productPrices)
      .where(scope)
      .for('update');
    const byType = new Map(existing.map((r) => [r.priceTypeId, r]));
    const wanted = new Set(data.prices.map((p) => p.priceTypeId));
    const removedIds = existing
      .filter((r) => !wanted.has(r.priceTypeId))
      .map((r) => r.id);
    if (removedIds.length > 0)
      await db
        .delete(productPrices)
        .where(inArray(productPrices.id, removedIds));
    const now = new Date();
    // Явний тип: пакетний tsconfig (noImplicitAny: false) виводить `[]` як never[].
    const rows: ProductPrice[] = [];
    for (const p of data.prices) {
      const row = byType.get(p.priceTypeId);
      const [saved] = row
        ? await db
            .update(productPrices)
            .set({ price: p.price, oldPrice: p.oldPrice, updatedAt: now })
            .where(eq(productPrices.id, row.id))
            .returning()
        : await db
            .insert(productPrices)
            .values({
              id: randomUUID(),
              productId: data.productId,
              modificationId: data.modificationId,
              priceTypeId: p.priceTypeId,
              price: p.price,
              oldPrice: p.oldPrice,
            })
            .returning();
      rows.push(saved!);
    }
    return { rows, removedIds };
  });
