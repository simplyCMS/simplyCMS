// Спільне для тестів агрегата товару (М1, Task 11): виконавець операцій під
// адміном проти живого Postgres і короткі побудовники викликів.
import { randomUUID } from 'node:crypto';
import {
  productsCreate,
  productsGet,
  productsSaveDescription,
  productsSaveTranslation,
} from 'simplycms/admin-server/impl';
import { executeOperation } from 'simplycms/operations';
import type { OperationDef } from 'simplycms/operations';
import { ADMIN } from './addressing-db';

export const subject = { userId: ADMIN.userId, roles: ['admin' as const] };

export const exec = async <I, O>(def: OperationDef<I, O>, raw: unknown) => {
  const res = await executeOperation(def, raw, subject);
  if (res.replayed) throw new Error('replay');
  return res.output;
};

type Texts = Record<string, Record<string, string | null>>;

/** Створює товар (uk — основна); повертає id і версію. */
export const create = async (texts: Texts, extra: object = {}) => {
  const id = randomUUID();
  const out = await exec(productsCreate, { id, texts, ...extra });
  return { id, version: out.version, paths: out.paths };
};

export const get = (id: string) => exec(productsGet, { id });

export const saveDescription = (
  id: string,
  expectedVersion: number,
  body: object,
) => exec(productsSaveDescription, { id, expectedVersion, ...body });

export const saveTranslation = (
  id: string,
  expectedVersion: number,
  locale: string,
  fields: object,
  expectedSourceHashes: Record<string, string>,
) =>
  exec(productsSaveTranslation, {
    id,
    expectedVersion,
    locale,
    fields,
    expectedSourceHashes,
  });
