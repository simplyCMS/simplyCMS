import { z } from 'zod';
import { setExplicitPath } from 'simplycms/addressing';
import { defineOperation, assertVersionThenHash } from 'simplycms/operations';
import { TRANSLATABLE, deleteTranslation } from 'simplycms/translations';
import { productsOps } from '../resource';
import { code } from '../../languages/view';
import {
  assertKnownLocales,
  getProductAggregate,
  loadState,
  lockProduct,
} from './load';
import { bumpProduct } from './mirror';
import { expectedVersion, textsRow, stockStatus, versionOut } from './schemas';

export { productsCreate } from './create';
export { productsSaveDescription } from './save-description';
export { productsSaveTranslation } from './save-translation';

export const productsGet = defineOperation({
  id: 'products.get',
  permission: 'catalog.read',
  versioned: true,
  input: z.object({ id: z.uuid() }),
  output: z.object({
    id: z.uuid(),
    version: z.number().int(),
    base: z.object({
      sectionId: z.uuid().nullable(),
      sku: z.string().nullable(),
      isActive: z.boolean(),
      isFeatured: z.boolean(),
      hasModifications: z.boolean().nullable(),
      stockStatus,
    }),
    texts: z.record(z.string(), textsRow),
    paths: z.record(z.string(), z.string()),
  }),
  run: ({ db }, input) => getProductAggregate(db, input.id),
});

export const productsDeleteTranslation = defineOperation({
  id: 'products.deleteTranslation',
  permission: 'catalog.write',
  versioned: true,
  input: z.object({ id: z.uuid(), locale: code, expectedVersion }),
  output: versionOut,
  async run({ db }, input) {
    const version = await lockProduct(db, input.id);
    assertVersionThenHash(version, input.expectedVersion, () => undefined);
    // Основну мову видаляти не можна — відмова всередині `deleteTranslation`.
    await deleteTranslation(db, TRANSLATABLE.product, input.id, input.locale);
    return { version: await bumpProduct(db, input.id) };
  },
});

/** Явна зміна адреси мови (І17/І18); версія росте: адреса — частина агрегата для ETag. */
export const productsSetPath = defineOperation({
  id: 'products.setPath',
  permission: 'catalog.write',
  versioned: true,
  input: z.object({
    id: z.uuid(),
    locale: code,
    path: z.string().min(1).max(255),
    expectedVersion,
  }),
  output: versionOut,
  async run({ db }, input) {
    const version = await lockProduct(db, input.id);
    assertVersionThenHash(version, input.expectedVersion, () => undefined);
    await assertKnownLocales(db, [input.locale], () => ['locale']);
    await setExplicitPath(
      db,
      { kind: 'product', id: input.id },
      input.locale,
      input.path,
    );
    const { primary } = await loadState(db, input.id);
    return {
      version: await bumpProduct(db, input.id, {
        // М1-TEMP: зноситься в Task 17 — slug дзеркалить адресу основної мови.
        slug: input.locale === primary ? input.path : undefined,
      }),
    };
  },
});

export const productsRemove = defineOperation({
  id: 'products.remove',
  permission: 'catalog.write',
  input: z.object({ id: z.uuid(), expectedVersion }),
  output: z.object({ id: z.uuid() }),
  async run({ db }, input) {
    const version = await lockProduct(db, input.id);
    assertVersionThenHash(version, input.expectedVersion, () => undefined);
    // Файли товару й каскадних дочірніх (фото відгуків, модифікацій) стирає
    // outbox медіа: ключі потрапляють у чергу в цій транзакції, самі файли
    // добираються після коміту опортуністичним хвостом (`completeMediaErasures`).
    await productsOps.removeIn(db, [{ id: input.id }], []);
    return { id: input.id };
  },
});
