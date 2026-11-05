import { z } from 'zod';
import { defineTranslatableCommands } from '../translatable/commands';
import { orderStatusesRead } from './resource';
import { ORDER_STATUS_ROOT } from './root';

const texts = z.strictObject({
  name: z.string().max(255).nullable().optional(),
});

/** Неперекладна основа; `isDefault` і порядок міняють `setDefault`/`reorder`, `code` — лише create. */
const base = z.strictObject({
  color: z.string().max(7).nullable().optional(),
  sortOrder: z.int32().optional(),
});

const createOnly = z.strictObject({ code: z.string().min(1).max(50) });

const commands = defineTranslatableCommands({
  entity: 'orderStatus',
  root: ORDER_STATUS_ROOT,
  idPrefix: 'order-statuses',
  permission: 'catalog.write',
  texts,
  base,
  createOnly,
  resource: orderStatusesRead,
});

export const orderStatusesList = commands.list;
export const orderStatusesGet = commands.get;
export const orderStatusesCreate = commands.create;
export const orderStatusesSaveDescription = commands.saveDescription;
export const orderStatusesSaveTranslation = commands.saveTranslation;
export const orderStatusesDeleteTranslation = commands.deleteTranslation;
