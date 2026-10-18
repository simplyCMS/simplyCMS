import { z } from 'zod';
import { defineOperation, assertVersionThenHash } from 'simplycms/operations';
import { planTranslationWrite } from 'simplycms/domain/translations';
import {
  TRANSLATABLE,
  applyTranslationPlan,
  sourceFieldHash,
} from 'simplycms/translations';
import { completeMediaErasures } from 'simplycms/storage';
import type { ChildCtx } from './children-common';
import {
  imagesInput,
  modificationsInput,
  propertyValuesInput,
} from './children-schemas';
import { assertImageKeys, eraseGone, productKeys } from './image-media';
import { assertKnownLocales, loadState, lockProduct } from './load';
import { bumpProduct, withSectionRef } from './version';
import { refreshAfterPlan } from './projection';
import { modificationIdsAfter, modificationIdsOf } from './modification-scope';
import { planImages } from './images';
import { planModifications } from './modifications';
import { planPropertyValues } from './property-values';
import {
  expectedVersion,
  productBase,
  remapPlanIssues,
  textsByLocale,
  toPatchMap,
  versionOut,
} from './schemas';

const SPEC = TRANSLATABLE.product;

/**
 * Сценарії 1–2 майстра §3.4: збереження опису товару (база + тексти будь-яких
 * мов) і дочірніх колекцій агрегата (модифікації, значення властивостей,
 * зображення — Task 12). Лише надіслані мови й поля; рядки решти мов
 * недоторкані (І11), їхні статуси виводить формула (сценарій 1); хеші
 * надісланих полів перекладів стампуються від НОВОГО джерела (сценарій 2).
 * Колекції ніколи не видаляються неявно — лише явним `remove`. Адресу не чіпає (І17).
 */
export const productsSaveDescription = defineOperation({
  id: 'products.saveDescription',
  permission: 'catalog.write',
  versioned: true,
  input: z.object({
    id: z.uuid(),
    expectedVersion,
    base: productBase.optional(),
    texts: textsByLocale.optional(),
    modifications: modificationsInput.optional(),
    propertyValues: propertyValuesInput.optional(),
    images: imagesInput.optional(),
  }),
  output: versionOut,
  async run({ db, afterCommit }, input) {
    const version = await lockProduct(db, input.id);
    const locales = await assertKnownLocales(
      db,
      Object.keys(input.texts ?? {}),
      (l) => ['texts', l],
    );
    const state = await loadState(db, input.id);
    const plan = remapPlanIssues(['texts'], () =>
      planTranslationWrite({
        spec: SPEC,
        current: { source: state.source, byLocale: state.byLocale },
        primary: state.primary,
        patch: toPatchMap(input.texts),
        hash: sourceFieldHash,
      }),
    );
    // Дочірні колекції: уся перевірка вводу (400) ДО версії (412).
    const existing = await modificationIdsOf({ db, productId: input.id });
    const ctx: ChildCtx = {
      db,
      productId: input.id,
      primary: state.primary,
      locales,
      modificationIds: modificationIdsAfter(existing, input.modifications),
    };
    const modifications = await planModifications(
      ctx,
      existing,
      input.modifications,
    );
    const values = await planPropertyValues(ctx, input.propertyValues);
    const images = await planImages(ctx, input.images);
    assertVersionThenHash(version, input.expectedVersion, () => undefined);
    // Файли зникають і з видаленням модифікації (каскад її фото) — не лише з `images`.
    const touchesFiles =
      input.images !== undefined ||
      (input.modifications?.remove?.length ?? 0) > 0;
    const before = touchesFiles ? await productKeys(db, input.id) : [];
    if (touchesFiles) await assertImageKeys(db, input.id, before, images.keys);
    await applyTranslationPlan(db, SPEC, input.id, plan);
    await refreshAfterPlan(db, input.id, plan, state.primary);
    await modifications.apply();
    await values.apply();
    await images.apply();
    if (touchesFiles) {
      // Рядки `media` — у транзакції, файли — після коміту; намір (outbox)
      // записано тут же, хвіст його лише добирає.
      const discard = await eraseGone(db, input.id, before);
      if (discard.length > 0) afterCommit(() => completeMediaErasures(discard));
    }
    return {
      version: await withSectionRef(['base', 'sectionId'], () =>
        bumpProduct(db, input.id, input.base),
      ),
    };
  },
});
