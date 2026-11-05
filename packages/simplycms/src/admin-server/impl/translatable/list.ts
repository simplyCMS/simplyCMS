import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { AdminNotFoundError } from 'simplycms/contracts/domain-errors';
import { fieldToWire } from 'simplycms/domain/translations';
import { defineOperation } from 'simplycms/operations';
import { TRANSLATABLE } from 'simplycms/translations';
import { subsetInputSchema, type SubsetPayload } from '../subset';
import type { ListResource, TranslatableConfig } from './config';
import { columnKey } from './roots';
import { loadTextState, textRows } from './state';
import { textsRowSchema } from './wire';

/** Рядок списку — те, що віддає `listIn` ресурсу (read-model: основа + тексти основної мови). */
type ListRow<TR extends ListResource> = Awaited<
  ReturnType<TR['listIn']>
>[number];

/** Основа у виході `get`: усі поля обов'язкові (рядок кореня їх завжди має), `null` лишається. */
type BaseOut<TB extends z.ZodRawShape, TC extends z.ZodRawShape> = {
  [K in keyof (TB & TC)]-?: Exclude<z.output<(TB & TC)[K]>, undefined>;
};

/** Необов'язкове у вводі (`.optional()`) стає обов'язковим у виході: рядок завжди має значення. */
const unwrapOptional = (shape: z.ZodRawShape): z.ZodRawShape =>
  Object.fromEntries(
    Object.entries(shape).map(([k, s]) => [
      k,
      s instanceof z.ZodOptional ? s.unwrap() : s,
    ]),
  );

/**
 * Операція-список (Д10): рядок read-model ресурсу — основа кореня, `id`, `version` і тексти
 * основної мови (INNER JOIN у `listIn`). Часові відбитки з рядка прибирає `omit` ресурсу.
 * Вхід — `subsetInputSchema`: eager-колекція шле `{}`.
 */
export function translatableList<
  TT extends z.ZodRawShape,
  TB extends z.ZodRawShape,
  TC extends z.ZodRawShape,
  TR extends ListResource,
>(cfg: TranslatableConfig<TT, TB, TC, TR>) {
  const required = new Set(TRANSLATABLE[cfg.entity].required.map(fieldToWire));
  const texts = Object.fromEntries(
    Object.keys(cfg.texts.shape).map((k) => [
      k,
      required.has(k) ? z.string() : z.string().nullable().optional(),
    ]),
  );
  const row = (cfg.resource.rowSchema as unknown as z.ZodObject).extend(texts);
  return defineOperation<SubsetPayload, ListRow<TR>[]>({
    id: `${cfg.idPrefix}.list`,
    permission: cfg.permission,
    input: subsetInputSchema,
    // Тип рядка називає ресурс (`listIn`); форму схеми будує рантайм з його `rowSchema`.
    output: z.array(row) as unknown as z.ZodType<ListRow<TR>[]>,
    run: ({ db }, input) =>
      cfg.resource.listIn(db, input.subset ?? {}) as Promise<ListRow<TR>[]>,
  });
}

/** `get` кореня з усіма мовами й статусами полів (дзеркало `products.get` без товарних частин). */
export function translatableGet<
  TT extends z.ZodRawShape,
  TB extends z.ZodRawShape,
  TC extends z.ZodRawShape,
  TR extends ListResource,
>(cfg: TranslatableConfig<TT, TB, TC, TR>) {
  const spec = TRANSLATABLE[cfg.entity];
  const baseShape = unwrapOptional({
    ...cfg.base.shape,
    ...cfg.createOnly?.shape,
  });
  const versionKey = columnKey(cfg.root.table, cfg.root.version);
  return defineOperation({
    id: `${cfg.idPrefix}.get`,
    // Не `catalog.read` (його має покупець): агрегат віддає усі мови, статуси й хеші.
    permission: cfg.permission,
    versioned: true,
    input: z.object({ id: z.uuid() }),
    output: z.object({
      id: z.uuid(),
      version: z.number().int(),
      base: z.object(baseShape) as unknown as z.ZodType<BaseOut<TB, TC>>,
      texts: z.record(z.string(), textsRowSchema(cfg.texts)),
    }),
    async run({ db }, { id }) {
      const [row] = (await db
        .select()
        .from(cfg.root.table)
        .where(eq(cfg.root.id, id))) as Record<string, unknown>[];
      if (!row) throw new AdminNotFoundError(cfg.root.label);
      const state = await loadTextState(db, spec, id);
      return {
        id,
        version: row[versionKey] as number,
        base: Object.fromEntries(
          Object.keys(baseShape).map((k) => [k, row[k]]),
        ) as BaseOut<TB, TC>,
        texts: textRows<TT>(spec, state),
      };
    },
  });
}
