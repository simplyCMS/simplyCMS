import { z } from 'zod';
import {
  SourceChangedError,
  ValidationError,
} from 'simplycms/contracts/domain-errors';
import { defineOperation, assertVersionThenHash } from 'simplycms/operations';
import {
  planTranslationWrite,
  toSourceRow,
} from 'simplycms/domain/translations';
import {
  TRANSLATABLE,
  applyTranslationPlan,
  fieldToWire,
  sourceFieldHash,
} from 'simplycms/translations';
import { refreshProductTexts } from 'simplycms/catalog-projection';
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
 * Кожне надіслане поле, чиє джерело має текст, мусить мати хеш у
 * `expectedSourceHashes`: без нього перекладач нічого не підтвердив, а запис
 * штампував би хеш поточного джерела без перевірки (сценарій 3 став би
 * сценарієм 2). Поле з порожнім джерелом хеша не має — його не вимагаємо.
 */
function requireHashes(
  patch: Readonly<Record<string, string | null | undefined>>,
  expected: Readonly<Record<string, string>>,
  source: Readonly<Record<string, string | null | undefined>>,
): void {
  const stored = toSourceRow(SPEC, source, sourceFieldHash).currentHashes;
  const missing = Object.entries(patch)
    .filter(([f, v]) => v !== undefined && stored[f] && !(f in expected))
    .map(([f]) => f);
  if (missing.length > 0)
    throw new ValidationError(
      missing.map((f) => ({
        path: ['expectedSourceHashes', fieldToWire(f)],
        code: 'invalid_type' as const,
      })),
    );
}

/**
 * Сценарій 3 майстра §3.4: переклад однієї не-основної мови з перевіркою
 * хешів джерела, які бачив перекладач. Корінь під `FOR NO KEY UPDATE` (І13): джерело
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
    requireHashes(toPatch(input.fields), expected, state.source?.values ?? {});
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
    await refreshProductTexts(db, [input.id], [input.locale]);
    return { version: await bumpProduct(db, input.id) };
  },
});
