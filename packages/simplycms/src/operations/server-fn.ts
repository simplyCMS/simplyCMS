import { setResponseStatus } from '@tanstack/react-start/server';
import { subjectFromCookie } from 'simplycms/auth';
import type { OperationDef } from './define';
import { executeOperation } from './execute';
import { toProblem } from './http/problem';

/**
 * Статус відповіді для доменної помилки; `undefined` — не наша (500). НЕ власна
 * карта: статус ОБЧИСЛЮЄТЬСЯ з `toProblem`, єдиної таблиці HTTP-шару, щоб serverFn
 * і `/api/v1` не розійшлися.
 */
function statusOf(error: unknown): number | undefined {
  const { status } = toProblem(error, '');
  return status === 500 ? undefined : status;
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
