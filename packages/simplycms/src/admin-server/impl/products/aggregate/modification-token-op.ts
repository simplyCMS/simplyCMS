import { sql } from 'drizzle-orm';
import { z } from 'zod';
import { setExplicitToken } from 'simplycms/addressing';
import { AdminNotFoundError } from 'simplycms/contracts/domain-errors';
import { defineOperation, assertVersionThenHash } from 'simplycms/operations';
import { SLUG_FORMAT } from 'simplycms/domain/slugs';
import { fail } from './children-common';
import { assertKnownLocales, loadState, lockProduct } from './load';
import { bumpProduct } from './mirror';
import { mirrorSlug } from './modification-tokens';
import { expectedVersion, versionOut } from './schemas';
import { code } from '../../languages/view';

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
    const found = await db.execute<{ product_id: string }>(
      sql`select product_id from public.product_modifications where id = ${input.modificationId}`,
    );
    const productId = found.rows[0]?.product_id;
    if (!productId) throw new AdminNotFoundError('модифікація');
    const version = await lockProduct(db, productId);
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
    const { primary } = await loadState(db, productId);
    if (input.locale === primary)
      await mirrorSlug({ db, primary }, input.modificationId);
    return { version: await bumpProduct(db, productId) };
  },
});
