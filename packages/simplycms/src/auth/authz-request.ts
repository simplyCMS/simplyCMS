import { getRequest, setResponseStatus } from '@tanstack/react-start/server';
import {
  AuthzError,
  requireOperation,
  type AuthScope,
  type AuthzSubject,
  type Operation,
} from './authz';
import { readSessionSubject } from './session';

/** Анонім: жодної ролі — матриця сама відмовляє всьому не-публічному. */
const GUEST: AuthzSubject = { userId: null, roles: [] };

export interface RequestGrant {
  readonly subject: AuthzSubject;
  readonly scope: AuthScope;
}

/**
 * Сесія поточного запиту → дозволений scope операції (перший рубіж B5″).
 *
 * 🔴 Викликається строго ДО withActor: субʼєкт — із СЕСІЇ, ніколи з
 * параметра клієнта; вкладених withActor не існує (readSessionSubject сам
 * ходить у user_roles власною короткою транзакцією — тому цей виклик
 * НЕ можна робити зсередини відкритої транзакції: другий pool.connect()
 * усередині першої = self-deadlock при вичерпаному пулі).
 *
 * 🔴 Повертає scope, не void: викликач зобовʼязаний ПОБАЧИТИ 'own' і
 * звузити запит (докблок requireOperation). Void-обгортки заборонені.
 */
export async function resolveRequestGrant(
  operation: Operation,
): Promise<RequestGrant> {
  const subject = (await readSessionSubject(getRequest().headers)) ?? GUEST;
  const scope = requireOperation(subject, operation); // кидає AuthzError
  return { subject, scope };
}

/**
 * Те саме + контракт помилок К3-13: 403 ставиться ДО прокидання, бо
 * сервер бере статус із getResponse().status ?? 500 у момент catch —
 * не з полів Error. Response не кидати ніколи: клієнтський fetcher
 * резолвить його json-тіло як успіх. Клієнт розрізняє відмову за
 * error.name === 'AuthzError' (seroval не зберігає instanceof).
 */
export async function requireGrant(
  operation: Operation,
): Promise<RequestGrant> {
  try {
    return await resolveRequestGrant(operation);
  } catch (error) {
    if (error instanceof AuthzError) setResponseStatus(403);
    throw error;
  }
}
