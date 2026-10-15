import { setResponseStatus } from '@tanstack/react-start/server';
import { subjectFromCookie, AuthzError } from 'simplycms/auth';
import {
  AdminConflictError,
  AdminNotFoundError,
  InUseError,
  SourceChangedError,
  ValidationError,
  VersionMismatchError,
} from 'simplycms/contracts/domain-errors';
import type { OperationDef } from './define';
import { executeOperation } from './execute';

/** Статус відповіді для доменної помилки; `undefined` — не наша (500). */
function statusOf(error: unknown): number | undefined {
  if (error instanceof AuthzError) return 403;
  if (error instanceof ValidationError) return 400;
  if (error instanceof VersionMismatchError) return 412;
  if (error instanceof AdminNotFoundError) return 404;
  if (
    error instanceof AdminConflictError ||
    error instanceof InUseError ||
    error instanceof SourceChangedError
  )
    return 409;
  return undefined;
}

/**
 * Валідатор-ідентичність для обгортки serverFn (`passThrough`): вхід
 * перевіряє виконавець (схема операції), тож `adminInput` тут дублював би
 * валідацію і підмінив би порядок «право → валідація».
 */
export const passThrough = (data: unknown): unknown => data;

/**
 * Виклик операції з serverFn: суб'єкт — з cookie поточного запиту,
 * далі виконавець. Статус ставиться ДО повторного throw (К3-13: сервер бере
 * його з відповіді в момент catch, не з полів Error).
 */
export async function invokeFromServerFn<I, O>(
  def: OperationDef<I, O>,
  data: unknown,
): Promise<O> {
  try {
    const subject = await subjectFromCookie();
    const result = await executeOperation(def, data, subject);
    if (result.replayed)
      throw new Error('[simplycms/operations] replay поза HTTP');
    return result.output;
  } catch (error) {
    const status = statusOf(error);
    if (status !== undefined) setResponseStatus(status);
    throw error;
  }
}
