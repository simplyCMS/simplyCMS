import { z } from 'zod';
import { defineOperation, assertVersionThenHash } from 'simplycms/operations';
import { planTranslationWrite } from 'simplycms/domain/translations';
import {
  TRANSLATABLE,
  applyTranslationPlan,
  sourceFieldHash,
} from 'simplycms/translations';
import { assertKnownLocales, loadState, lockProduct } from './load';
import { bumpProduct } from './mirror';
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
 * мов). Лише надіслані мови й поля; рядки решти мов недоторкані (І11), їхні
 * статуси виводить формула (сценарій 1); хеші надісланих полів перекладів
 * стампуються від НОВОГО джерела (сценарій 2). Адресу не чіпає (І17).
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
  }),
  output: versionOut,
  async run({ db }, input) {
    const version = await lockProduct(db, input.id);
    await assertKnownLocales(db, Object.keys(input.texts ?? {}), (l) => [
      'texts',
      l,
    ]);
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
    assertVersionThenHash(version, input.expectedVersion, () => undefined);
    await applyTranslationPlan(db, SPEC, input.id, plan);
    return {
      version: await bumpProduct(db, input.id, {
        base: input.base,
        plan,
        primary: state.primary,
      }),
    };
  },
});
