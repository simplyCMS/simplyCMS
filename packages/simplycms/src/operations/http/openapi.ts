import { can } from 'simplycms/auth';
import type { OperationDef } from '../define';
import { methodNotAllowed } from './handle';
import { COMPONENTS, pathItem } from './openapi-parts';
import { problemResponse } from './problem';
import { authenticateRequest } from './token-auth';

export type OpenApiDocument = Readonly<Record<string, unknown>>;

/** OpenAPI 3.1 з реєстру операцій (Д1): детермінований — порядок за `id`. */
export function buildOpenApi(
  ops: readonly OperationDef<unknown, unknown>[],
): OpenApiDocument {
  const sorted = [...ops].sort((a, b) => (a.id < b.id ? -1 : 1));
  return {
    openapi: '3.1.0',
    info: { title: 'SimplyCMS API', version: '1' },
    paths: Object.fromEntries(
      sorted.map((def) => [`/api/v1/${def.id}`, pathItem(def)]),
    ),
    components: COMPONENTS,
    security: [{ bearer: [] }, { cookie: [] }],
  };
}

const cache = new WeakMap<object, string>();

/**
 * `GET /api/v1/openapi.json` (рішення архітектора): валідний Bearer-токен (будь-які
 * scopes) АБО cookie-сесія з `admin.access`. Перелік операцій розкриває
 * встановлені плагіни, тож покупець із самореєстрації (роль `user`) бачить 403.
 * Токен покупець отримати не може: усі `api-tokens.*`/`service-accounts.*`
 * вимагають `apiToken.manage` (`admin`) і `sessionOnly`. Документ мемоізується
 * на процес за реєстром.
 */
export async function handleOpenApiRequest(
  request: Request,
  ops: readonly OperationDef<unknown, unknown>[],
): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed('GET');
  try {
    const subject = await authenticateRequest(request);
    if (!subject)
      return problemResponse('unauthenticated', 'openapi', {
        'www-authenticate': 'Bearer',
      });
    if (subject.tokenId === undefined && !can(subject, 'admin.access'))
      return problemResponse('forbidden', 'openapi');
    let body = cache.get(ops);
    if (body === undefined) {
      body = JSON.stringify(buildOpenApi(ops));
      cache.set(ops, body);
    }
    return new Response(body, {
      headers: { 'content-type': 'application/json' },
    });
  } catch (error) {
    console.error('[api/v1] openapi', error);
    return problemResponse('internal', 'openapi');
  }
}
