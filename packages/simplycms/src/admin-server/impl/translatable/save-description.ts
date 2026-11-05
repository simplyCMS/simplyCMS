import { z } from 'zod';
import { assertVersionThenHash, defineOperation } from 'simplycms/operations';
import { planTranslationWrite } from 'simplycms/domain/translations';
import {
  TRANSLATABLE,
  applyTranslationPlan,
  sourceFieldHash,
} from 'simplycms/translations';
import { code } from '../languages/view';
import type { ListResource, TranslatableConfig } from './config';
import { bumpVersion, lockRoot } from './roots';
import { loadTextState } from './state';
import { assertKnownLocales } from './steps';
import {
  expectedVersion,
  remapPlanIssues,
  toPatchMap,
  versionOut,
  type TextsWire,
} from './wire';

/**
 * Сценарії 1–2 майстра §3.4 для кореня без дочірніх колекцій: база + тексти будь-яких мов
 * (лише надіслані мови й поля, решта недоторкана — І11; хеші надісланих полів перекладів
 * стампуються від НОВОГО джерела). Корінь під `FOR NO KEY UPDATE`; порядок відмов:
 * валідація (400) → версія (412).
 */
export function translatableSaveDescription<
  TT extends z.ZodRawShape,
  TB extends z.ZodRawShape,
  TC extends z.ZodRawShape,
  TR extends ListResource,
>(cfg: TranslatableConfig<TT, TB, TC, TR>) {
  const spec = TRANSLATABLE[cfg.entity];
  return defineOperation({
    id: `${cfg.idPrefix}.saveDescription`,
    permission: cfg.permission,
    versioned: true,
    input: z.object({
      id: z.uuid(),
      expectedVersion,
      base: cfg.base.optional(),
      texts: z.record(code, cfg.texts).optional(),
    }),
    output: versionOut,
    async run({ db }, input) {
      const version = await lockRoot(db, cfg.root, input.id, 'no key update');
      await assertKnownLocales(db, Object.keys(input.texts ?? {}), (l) => [
        'texts',
        l,
      ]);
      const state = await loadTextState(db, spec, input.id);
      const plan = remapPlanIssues(['texts'], () =>
        planTranslationWrite({
          spec,
          current: { source: state.source, byLocale: state.byLocale },
          primary: state.primary,
          // Ключі `texts` — поля реєстру (схема вводу строга); значення — рядок чи null.
          patch: toPatchMap(
            spec,
            input.texts as Record<string, TextsWire> | undefined,
          ),
          hash: sourceFieldHash,
        }),
      );
      assertVersionThenHash(version, input.expectedVersion, () => undefined);
      await applyTranslationPlan(db, spec, input.id, plan);
      return { version: await bumpVersion(db, cfg.root, input.id, input.base) };
    },
  });
}
