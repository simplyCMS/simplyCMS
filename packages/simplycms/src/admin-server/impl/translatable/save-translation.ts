import { z } from 'zod';
import {
  SourceChangedError,
  ValidationError,
} from 'simplycms/contracts/domain-errors';
import { assertVersionThenHash, defineOperation } from 'simplycms/operations';
import { planTranslationWrite } from 'simplycms/domain/translations';
import {
  TRANSLATABLE,
  applyTranslationPlan,
  sourceFieldHash,
} from 'simplycms/translations';
import { code } from '../languages/view';
import type { ListResource, TranslatableConfig } from './config';
import { requireHashes } from './hashes';
import { bumpVersion, lockRoot } from './roots';
import { loadTextState } from './state';
import { assertKnownLocales } from './steps';
import {
  expectedVersion,
  fromWireKeys,
  remapPlanIssues,
  toPatch,
  toWireKeys,
  versionOut,
  type TextsWire,
} from './wire';

/**
 * Сценарій 3 майстра §3.4: переклад однієї не-основної мови з перевіркою хешів джерела, які
 * бачив перекладач. 🔴 `expectedVersion` обов'язковий: без нього дві правки перекладу з тим
 * самим хешем джерела перезаписали б одна одну. Порядок: версія (412) → хеш джерела (409).
 */
export function translatableSaveTranslation<
  TT extends z.ZodRawShape,
  TB extends z.ZodRawShape,
  TC extends z.ZodRawShape,
  TR extends ListResource,
>(cfg: TranslatableConfig<TT, TB, TC, TR>) {
  const spec = TRANSLATABLE[cfg.entity];
  return defineOperation({
    id: `${cfg.idPrefix}.saveTranslation`,
    permission: cfg.permission,
    versioned: true,
    input: z.object({
      id: z.uuid(),
      locale: code,
      expectedVersion,
      fields: cfg.texts,
      /** Що перекладач бачив у джерелі: поле → хеш; поле лише перевіряється. */
      expectedSourceHashes: z.record(z.string(), z.string()),
    }),
    output: versionOut,
    async run({ db }, input) {
      const version = await lockRoot(db, cfg.root, input.id, 'no key update');
      const state = await loadTextState(db, spec, input.id);
      if (input.locale === state.primary)
        throw new ValidationError([
          { path: ['locale'], code: 'invalid_value' },
        ]);
      await assertKnownLocales(db, [input.locale], () => ['locale']);
      const expected = fromWireKeys(spec, input.expectedSourceHashes, [
        'expectedSourceHashes',
      ]);
      const patch = toPatch(spec, input.fields as TextsWire);
      requireHashes(spec, patch, expected, state.source?.values ?? {});
      const plan = remapPlanIssues(
        ['fields'],
        () =>
          planTranslationWrite({
            spec,
            current: { source: state.source, byLocale: state.byLocale },
            primary: state.primary,
            patch: new Map([[input.locale, patch]]),
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
      await applyTranslationPlan(db, spec, input.id, plan);
      return { version: await bumpVersion(db, cfg.root, input.id) };
    },
  });
}
