import { z } from 'zod';
import { ValidationError } from 'simplycms/contracts/domain-errors';
import { assertVersionThenHash, defineOperation } from 'simplycms/operations';
import {
  TRANSLATABLE,
  deleteTranslation,
  primaryLocaleCode,
} from 'simplycms/translations';
import { code } from '../languages/view';
import type { ListResource, TranslatableConfig } from './config';
import { bumpVersion, lockRoot } from './roots';
import { expectedVersion, versionOut } from './wire';

/** Видалення перекладу не-основної мови: валідація (400) перед версією (412), майстер §3.3. */
export function translatableDeleteTranslation<
  TT extends z.ZodRawShape,
  TB extends z.ZodRawShape,
  TC extends z.ZodRawShape,
  TR extends ListResource,
>(cfg: TranslatableConfig<TT, TB, TC, TR>) {
  const spec = TRANSLATABLE[cfg.entity];
  return defineOperation({
    id: `${cfg.idPrefix}.deleteTranslation`,
    permission: cfg.permission,
    versioned: true,
    input: z.object({ id: z.uuid(), locale: code, expectedVersion }),
    output: versionOut,
    async run({ db }, input) {
      const version = await lockRoot(db, cfg.root, input.id, 'no key update');
      if (input.locale === (await primaryLocaleCode(db)))
        throw new ValidationError([
          { path: ['locale'], code: 'invalid_value' },
        ]);
      assertVersionThenHash(version, input.expectedVersion, () => undefined);
      await deleteTranslation(db, spec, input.id, input.locale);
      return { version: await bumpVersion(db, cfg.root, input.id) };
    },
  });
}
