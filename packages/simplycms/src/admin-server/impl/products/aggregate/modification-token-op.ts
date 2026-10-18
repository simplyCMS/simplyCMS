import { sql } from 'drizzle-orm';
import { z } from 'zod';
import type { ActorDb } from 'simplycms/db';
import { setExplicitToken } from 'simplycms/addressing';
import { AdminNotFoundError } from 'simplycms/contracts/domain-errors';
import { defineOperation, assertVersionThenHash } from 'simplycms/operations';
import { SLUG_FORMAT } from 'simplycms/domain/slugs';
import { fail } from './children-common';
import { assertKnownLocales, lockProduct } from './load';
import { bumpProduct } from './version';
import { expectedVersion, versionOut } from './schemas';
import { code } from '../../languages/view';

async function productOf(db: ActorDb, modificationId: string): Promise<string> {
  const found = await db.execute<{ product_id: string }>(
    sql`select product_id from public.product_modifications where id = ${modificationId}`,
  );
  const productId = found.rows[0]?.product_id;
  if (!productId) throw new AdminNotFoundError('модифікація');
  return productId;
}

/**
 * Явна зміна токена модифікації однієї мови (І21/І22): історичний власний токен
 * знову стає поточним, чужий — 409 `slug_taken`. Версія росте: токен — частина
 * агрегата для ETag. Товар визначає модифікація, тож він береться з БД, а не з входу.
 */
export const productsSetModificationToken = defineOperation({
  id: 'products.setModificationToken',
  permission: 'catalog.write',
  versioned: true,
  input: z.object({
    modificationId: z.uuid(),
    locale: code,
    slug: z.string().min(1).max(255),
    expectedVersion,
  }),
  output: versionOut,
  async run({ db }, input) {
    // Товар визначає модифікація; читаємо без замка лише щоб знати, що лочити,
    // і ПЕРЕчитуємо під замком: паралельне видалення дає 404, а не 409 `reference`.
    const productId = await productOf(db, input.modificationId);
    const version = await lockProduct(db, productId);
    if ((await productOf(db, input.modificationId)) !== productId)
      throw new AdminNotFoundError('модифікація');
    // Валідація (400) перед версією (412), майстер §3.3.
    await assertKnownLocales(db, [input.locale], () => ['locale']);
    if (!SLUG_FORMAT.test(input.slug)) throw fail(['slug'], 'invalid_format');
    assertVersionThenHash(version, input.expectedVersion, () => undefined);
    await setExplicitToken(
      db,
      { kind: 'modification', id: input.modificationId, scopeId: productId },
      input.locale,
      input.slug,
    );
    return { version: await bumpProduct(db, productId) };
  },
});
