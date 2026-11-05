import type { PgTable } from 'drizzle-orm/pg-core';
import type { z } from 'zod';
import type { Operation } from 'simplycms/auth';
import type { TranslatableKey } from 'simplycms/translations';
import type { AdminResourceOps } from '../resource';
import type { AggregateRoot } from './roots';

/** Те, що фабрика бере з ресурсу читання: `listIn` (read-model основної мови) і схему рядка. */
export type ListResource = Pick<
  AdminResourceOps<PgTable>,
  'listIn' | 'rowSchema'
>;

/**
 * Конфіг фабрики команд перекладного агрегата (М2б, Р19). Ключі `texts` — дротові поля
 * (camelCase) реєстру `TRANSLATABLE_FIELDS`; ключі `base` і `createOnly` ЗБІГАЮТЬСЯ з іменами
 * колонок кореня в Drizzle (`sortOrder`), бо йдуть у `values`/`set` без перейменування.
 */
export interface TranslatableConfig<
  TT extends z.ZodRawShape,
  TB extends z.ZodRawShape,
  TC extends z.ZodRawShape,
  TR extends ListResource = ListResource,
> {
  readonly entity: TranslatableKey;
  readonly root: AggregateRoot;
  /** Префікс id операцій: `order-statuses` → `order-statuses.create`. */
  readonly idPrefix: string;
  readonly permission: Operation;
  /** Тексти однієї мови (strictObject: невідоме поле — відмова). */
  readonly texts: z.ZodObject<TT, z.core.$ZodObjectConfig>;
  /** Неперекладна основа, що змінюється `saveDescription` (усі поля необов'язкові). */
  readonly base: z.ZodObject<TB, z.core.$ZodObjectConfig>;
  /** Поля, що пишуться лише при створенні (код статусу): у `saveDescription` їх немає. */
  readonly createOnly?: z.ZodObject<TC, z.core.$ZodObjectConfig>;
  /** Ресурс читання колекції: `listIn` (read-model з основною мовою) і `rowSchema` рядка. */
  readonly resource: TR;
}
