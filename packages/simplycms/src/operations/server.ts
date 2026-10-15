// simplycms/operations/server — прив'язка виконавця до serverFn (запит Start) і
// HTTP-адаптер `/api/v1` (чисте `Request → Response`, без Start-контексту).
export { invokeFromServerFn, passThrough } from './server-fn';
export { handleApiRequest, methodNotAllowed } from './http/handle';
export type { OperationLookup } from './http/handle';
export { buildOpenApi, handleOpenApiRequest } from './http/openapi';
export type { OpenApiDocument } from './http/openapi';
export { subjectFromToken } from './http/token-auth';
