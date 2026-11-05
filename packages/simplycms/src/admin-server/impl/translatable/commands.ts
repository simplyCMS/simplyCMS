import type { z } from 'zod';
import type { ListResource, TranslatableConfig } from './config';
import { translatableCreate } from './create';
import { translatableDeleteTranslation } from './delete-translation';
import { translatableGet, translatableList } from './list';
import { translatableSaveDescription } from './save-description';
import { translatableSaveTranslation } from './save-translation';

export type { TranslatableConfig } from './config';

/**
 * Фабрика команд перекладного агрегата без дочірніх колекцій (М2б, Р19): `create`, `get`,
 * `saveDescription`, `saveTranslation`, `deleteTranslation` і `list` — id `${idPrefix}.<ім'я>`,
 * форма входу/виходу дзеркалить операції товару без товарних частин. Іменовані команди
 * сутності (`setDefault`, `reorder`, `remove`) фабрика не покриває: вони пишуться руками
 * поруч і беруть замки через `lockRoots`/`bumpVersion` (Д7).
 */
export function defineTranslatableCommands<
  TT extends z.ZodRawShape,
  TB extends z.ZodRawShape,
  TC extends z.ZodRawShape,
  TR extends ListResource,
>(cfg: TranslatableConfig<TT, TB, TC, TR>) {
  return {
    create: translatableCreate(cfg),
    get: translatableGet(cfg),
    saveDescription: translatableSaveDescription(cfg),
    saveTranslation: translatableSaveTranslation(cfg),
    deleteTranslation: translatableDeleteTranslation(cfg),
    list: translatableList(cfg),
  };
}
