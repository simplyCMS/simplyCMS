import { z } from 'zod';
import {
  SourceChangedError,
  ValidationError,
} from 'simplycms/contracts/domain-errors';
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
  fromWireKeys,
  productTexts,
  remapPlanIssues,
  toPatch,
  toWireKeys,
  versionOut,
} from './schemas';
import { code } from '../../languages/view';

const SPEC = TRANSLATABLE.product;

/**
 * Сценарій 3 майстра §3.4: переклад однієї не-основної мови з перевіркою
 * хешів джерела, які бачив перекладач. Корінь під `FOR UPDATE` (І13): джерело
 * не змінюється між перевіркою й записом. 🔴 `expectedVersion` обов'язковий:
 * без нього дві правки перекладу з тим самим хешем джерела перезаписали б одна
 * одну. Порядок перевірок: версія (412) → хеш джерела (409).
 */
export const productsSaveTranslation = defineOperation({
  id: 'products.saveTranslation',
  permission: 'catalog.write',
  versioned: true,
  input: z.object({
    id: z.uuid(),
    locale: code,
    expectedVersion,
    fields: productTexts,
    /** Що перекладач бачив у джерелі: поле → хеш; поле лише перевіряється. */
    expectedSourceHashes: z.record(z.string(), z.string()),
  }),
  output: versionOut,
  async run({ db }, input) {
    const version = await lockProduct(db, input.id);
    const state = await loadState(db, input.id);
    if (input.locale === state.primary)
      throw new ValidationError([{ path: ['locale'], code: 'invalid_value' }]);
    await assertKnownLocales(db, [input.locale], () => ['locale']);
    const expected = fromWireKeys(input.expectedSourceHashes, [
      'expectedSourceHashes',
    ]);
    const plan = remapPlanIssues(
      ['fields'],
      () =>
        planTranslationWrite({
          spec: SPEC,
          current: { source: state.source, byLocale: state.byLocale },
          primary: state.primary,
          patch: new Map([[input.locale, toPatch(input.fields)]]),
          expectedSourceHashes: new Map([[input.locale, expected]]),
          hash: sourceFieldHash,
        }),
      true,
    );
    assertVersionThenHash(version, input.expectedVersion, () => {
      if (plan.sourceChanged)
        throw new SourceChangedError(
          plan.sourceChanged.locale,
          toWireKeys(plan.sourceChanged.current),
        );
    });
    await applyTranslationPlan(db, SPEC, input.id, plan);
    return { version: await bumpProduct(db, input.id) };
  },
});
