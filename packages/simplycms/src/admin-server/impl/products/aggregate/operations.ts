import { z } from 'zod';
import { setExplicitPath } from 'simplycms/addressing';
import { refreshProductTexts } from 'simplycms/catalog-projection';
import { defineOperation, assertVersionThenHash } from 'simplycms/operations';
import { ValidationError } from 'simplycms/contracts/domain-errors';
import { SLUG_FORMAT } from 'simplycms/domain/slugs';
import {
  TRANSLATABLE,
  deleteTranslation,
  primaryLocaleCode,
} from 'simplycms/translations';
import { completeMediaErasures } from 'simplycms/storage';
import { productsOps } from '../resource';
import { code } from '../../languages/view';
import {
  assertKnownLocales,
  getProductAggregate,
  loadState,
  lockProduct,
  lockProductForRemove,
} from './load';
import { childrenOut } from './children-read';
import { bumpProduct } from './mirror';
import { expectedVersion, textsRow, stockStatus, versionOut } from './schemas';

export { productsCreate } from './create';
export { productsSaveDescription } from './save-description';
export { productsSaveTranslation } from './save-translation';
export { productsSetModificationToken } from './modification-token-op';

export const productsGet = defineOperation({
  id: 'products.get',
  // Не `catalog.read` (його має покупець): агрегат віддає неактивні товари, усі
  // мови, статуси й хеші. Прецедент — stock/product-modifications (`catalog.write`).
  permission: 'catalog.write',
  versioned: true,
  input: z.object({ id: z.uuid() }),
  output: z
    .object({
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
    })
    .extend(childrenOut.shape),
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
    // Валідація (400) перед версією (412), майстер §3.3: основну мову не видаляють.
    if (input.locale === (await primaryLocaleCode(db)))
      throw new ValidationError([{ path: ['locale'], code: 'invalid_value' }]);
    assertVersionThenHash(version, input.expectedVersion, () => undefined);
    await deleteTranslation(db, TRANSLATABLE.product, input.id, input.locale);
    // Рядок мови лишається з fallback на основну, але `is_translated` стає false.
    await refreshProductTexts(db, [input.id], [input.locale]);
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
    // Валідація (400) перед версією (412), майстер §3.3.
    await assertKnownLocales(db, [input.locale], () => ['locale']);
    if (!SLUG_FORMAT.test(input.path))
      throw new ValidationError([{ path: ['path'], code: 'invalid_format' }]);
    assertVersionThenHash(version, input.expectedVersion, () => undefined);
    await setExplicitPath(
      db,
      { kind: 'product', id: input.id },
      input.locale,
      input.path,
    );
    // Адреса — частина проєкції: нова поточна адреса мови в тій самій транзакції (І23).
    await refreshProductTexts(db, [input.id], [input.locale]);
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
  async run({ db, afterCommit }, input) {
    // Корінь одразу `FOR UPDATE` (порядок замків, пункт (3) `lock-order.ts`): DELETE товару інакше посилив
    // би `NO KEY UPDATE` уже після замків модифікацій.
    const version = await lockProductForRemove(db, input.id);
    assertVersionThenHash(version, input.expectedVersion, () => undefined);
    // Рядки `media` (товару й каскадних дочірніх) стираються в транзакції разом
    // із рядком outbox; самі файли — після коміту (Е6д-14, друга фаза).
    const discard: string[] = [];
    // Фото й мовні перевизначення (`product_images*`) каскадом зникають разом із
    // товаром: їхні `cascadeMedia` в `productsOps.removeIn` стирають рядки `media`.
    await productsOps.removeIn(db, [{ id: input.id }], discard);
    afterCommit(() => completeMediaErasures(discard));
    return { id: input.id };
  },
});
