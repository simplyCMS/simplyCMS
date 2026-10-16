import {
  AuthzError,
  requireOperation,
  type AuthzSubject,
} from 'simplycms/auth';
import { ValidationError } from 'simplycms/contracts/domain-errors';
import { acceptsExpectedVersion, type OperationDef } from '../define';
import { executeOperation } from '../execute';
import { fingerprintOf } from './idempotency';
import { errorResponse, problemResponse } from './problem';
import { authenticateRequest, subjectKeyOf } from './token-auth';

/** Пошук операції в реєстрі: його передає РОУТ (тир `operations` не знає `admin-server`). */
export type OperationLookup = (
  id: string,
) => OperationDef<unknown, unknown> | undefined;

const JSON_TYPE = /^application\/json\s*(;|$)/i;
const IF_MATCH = /^"v(\d+)"$/;

/** 405 з `Allow`: для роутів, де метод без хендлера пішов би в SSR. */
export const methodNotAllowed = (allow: string): Response =>
  problemResponse('method_not_allowed', '', { allow });

const unauthenticated = (op: string): Response =>
  problemResponse('unauthenticated', op, { 'www-authenticate': 'Bearer' });

/** Тіло запиту → JSON-об'єкт; порожнє тіло = `{}`. Збій розбору — 400 без відлуння вводу. */
async function readBody(request: Request): Promise<unknown> {
  const text = await request.text();
  if (text.trim() === '') return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new ValidationError([{ path: [], code: 'invalid_type' }]);
  }
}

/**
 * `If-Match: "v<n>"` ↔ `expectedVersion`: різні значення — 400. Операція без
 * `expectedVersion` у вході заголовка не приймає (400): майстер §3.3 мовчить, а
 * тихо проігнорований `If-Match` виглядав би як пройдена перевірка версії.
 */
function applyIfMatch(
  body: unknown,
  header: string | null,
  def: OperationDef<unknown, unknown>,
): unknown {
  if (header === null) return body;
  if (!acceptsExpectedVersion(def))
    throw new ValidationError([{ path: ['If-Match'], code: 'custom' }]);
  const m = IF_MATCH.exec(header.trim());
  const isObject =
    body !== null && typeof body === 'object' && !Array.isArray(body);
  if (!m || !isObject)
    throw new ValidationError([{ path: [], code: 'custom' }]);
  const expected = Number(m[1]);
  const given = (body as Record<string, unknown>).expectedVersion;
  if (given !== undefined && given !== expected)
    throw new ValidationError([{ path: ['expectedVersion'], code: 'custom' }]);
  return { ...(body as Record<string, unknown>), expectedVersion: expected };
}

/** `ETag: "v<n>"` для відповіді версіонованої операції (майстер §3.3). */
function setEtag(
  headers: Headers,
  def: OperationDef<unknown, unknown>,
  body: unknown,
): void {
  const version = (body as { version?: unknown } | null)?.version;
  if (def.versioned && typeof version === 'number')
    headers.set('etag', `"v${version}"`);
}

function idempotencyOf(
  def: OperationDef<unknown, unknown>,
  subject: AuthzSubject,
  request: Request,
  body: unknown,
) {
  const key = request.headers.get('idempotency-key');
  if (key === null || def.idempotent !== 'create') return undefined;
  if (key.length < 1 || key.length > 255)
    throw new ValidationError([{ path: ['Idempotency-Key'], code: 'too_big' }]);
  return {
    subjectKey: subjectKeyOf(subject),
    key,
    fingerprint: fingerprintOf(body),
  };
}

/**
 * HTTP-адаптер `POST /api/v1/<op>` (конверт майстра §3.3).
 *
 * Порядок: автентифікація (401) → операція існує (404; після 401, щоб перелік
 * операцій не розкривався анонімові) → `sessionOnly` і права (403) → тип
 * вмісту (415) → валідація (400) → версія й хеш джерела. Статус і `kind`
 * дає ЛИШЕ `toProblem`; невідомі помилки не витікають у тіло (І29).
 */
export async function handleApiRequest(
  request: Request,
  op: string,
  lookup: OperationLookup,
): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed('POST');
  try {
    const subject = await authenticateRequest(request);
    if (!subject) return unauthenticated(op);
    const def = lookup(op);
    if (!def) return problemResponse('unknown_operation', op);
    // Токен не керує токенами: витеклий Bearer не може розмножити себе.
    if (def.sessionOnly && subject.tokenId !== undefined)
      throw new AuthzError(def.id);
    requireOperation(subject, def.permission, def.id);
    if (!JSON_TYPE.test(request.headers.get('content-type') ?? ''))
      return problemResponse('unsupported_media_type', op);
    const body = applyIfMatch(
      await readBody(request),
      request.headers.get('if-match'),
      def,
    );
    const idempotency = idempotencyOf(def, subject, request, body);
    const result = await executeOperation(def, body, subject, { idempotency });
    const headers = new Headers({ 'content-type': 'application/json' });
    if (result.replayed) {
      headers.set('idempotent-replayed', 'true');
      // Повтор несе той самий ETag, що й перша відповідь (версія — у збереженому тілі).
      setEtag(headers, def, result.body);
      return new Response(JSON.stringify(result.body), {
        status: result.status,
        headers,
      });
    }
    // `result.output` уже дротова форма, розібрана схемою у виконавці.
    const wire = result.output;
    setEtag(headers, def, wire);
    return new Response(JSON.stringify(wire), { status: 200, headers });
  } catch (error) {
    return errorResponse(error, op);
  }
}
