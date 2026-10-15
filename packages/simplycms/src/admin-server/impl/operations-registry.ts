import type { OperationDef } from 'simplycms/operations';
import {
  apiTokensCreate,
  apiTokensList,
  apiTokensRevoke,
} from './api-tokens/operations';
import { serviceAccountsCreate } from './api-tokens/service-accounts';
import {
  languagesAdd,
  languagesFill,
  languagesList,
  languagesRemove,
  languagesReorder,
} from './languages/operations';
import { languagesSetStatus } from './languages/status';

/**
 * Реєстр операцій ядра (І24): перелік тут, бо саме `admin-server` визначає
 * операції; `simplycms/operations` про нього не знає (інакше цикл модулів).
 * Нова операція = рядок тут + serverFn-обгортка в `admin-server/index.ts`;
 * паритет доводить `registry-parity.test.ts` (Task 7). Плагінні операції
 * додасть пізніший крок — реєстр лишається статичним масивом ядра.
 */
export const CORE_OPERATIONS: readonly OperationDef<unknown, unknown>[] = [
  languagesList,
  languagesAdd,
  languagesSetStatus,
  languagesFill,
  languagesReorder,
  languagesRemove,
  apiTokensCreate,
  apiTokensRevoke,
  apiTokensList,
  serviceAccountsCreate,
] as readonly OperationDef<unknown, unknown>[];

const BY_ID: ReadonlyMap<string, OperationDef<unknown, unknown>> = new Map(
  CORE_OPERATIONS.map((op) => [op.id, op]),
);

export const getOperation = (
  id: string,
): OperationDef<unknown, unknown> | undefined => BY_ID.get(id);
