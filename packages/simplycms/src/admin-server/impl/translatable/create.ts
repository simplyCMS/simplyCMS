import { z } from 'zod';
import { ValidationError } from 'simplycms/contracts/domain-errors';
import { advisoryXactLockShared } from 'simplycms/db';
import { LOCK_KEYS } from 'simplycms/db/lock-keys';
import { defineOperation } from 'simplycms/operations';
import {
  fieldToWire,
  planTranslationWrite,
} from 'simplycms/domain/translations';
import {
  TRANSLATABLE,
  applyTranslationPlan,
  primaryLocaleCode,
  sourceFieldHash,
} from 'simplycms/translations';
import { code } from '../languages/view';
import type { ListResource, TranslatableConfig } from './config';
import { columnKey } from './roots';
import { assertKnownLocales } from './steps';
import { remapPlanIssues, toPatchMap, type TextsWire } from './wire';

/**
 * Створення кореня з текстами: рядок кореня, переклади й версія 1 — в одній транзакції
 * (відкладений тригер джерела І4 перевіряє їх разом на COMMIT). Дзеркало `products.create`
 * без адреси, проєкції й дочірніх колекцій. Обов'язкові поля основної мови — за
 * `spec.required`: тригер відмовив би лише на COMMIT загальним 23514, тут — рання помилка
 * поля (400).
 */
export function translatableCreate<
  TT extends z.ZodRawShape,
  TB extends z.ZodRawShape,
  TC extends z.ZodRawShape,
  TR extends ListResource,
>(cfg: TranslatableConfig<TT, TB, TC, TR>) {
  const spec = TRANSLATABLE[cfg.entity];
  return defineOperation({
    id: `${cfg.idPrefix}.create`,
    permission: cfg.permission,
    idempotent: 'create',
    versioned: true,
    input: cfg.base
      .extend(cfg.createOnly?.shape ?? ({} as TC))
      .extend({ id: z.uuid(), texts: z.record(code, cfg.texts) }),
    output: z.object({ id: z.uuid(), version: z.number().int() }),
    async run({ db }, data) {
      const { id, texts, ...row } = data as unknown as {
        id: string;
        texts: Record<string, TextsWire>;
      } & Record<string, unknown>;
      // Спільний замок набору мов ПЕРШИМ: далі валідація мов бачить незмінний набір.
      await advisoryXactLockShared(db, LOCK_KEYS.languagesSet);
      const primary = await primaryLocaleCode(db);
      await assertKnownLocales(db, Object.keys(texts), (l) => ['texts', l]);
      const plan = remapPlanIssues(['texts'], () =>
        planTranslationWrite({
          spec,
          current: { source: null, byLocale: new Map() },
          primary,
          patch: toPatchMap(spec, texts),
          hash: sourceFieldHash,
        }),
      );
      // План перевіряє обов'язкові поля лише коли основну мову надіслано, а відсутню не бачить.
      const source = plan.upserts.find((u) => u.locale === primary)?.values;
      const missing = spec.required.filter((f) => !source?.[f]);
      if (missing.length > 0)
        throw new ValidationError(
          missing.map((f) => ({
            path: ['texts', primary, fieldToWire(f)],
            code: 'too_small' as const,
            params: { minimum: 1, origin: 'string' },
          })),
        );
      await db.insert(cfg.root.table).values({
        ...row,
        id,
        [columnKey(cfg.root.table, cfg.root.version)]: 1,
      } as never);
      await applyTranslationPlan(db, spec, id, plan);
      return { id, version: 1 };
    },
  });
}
