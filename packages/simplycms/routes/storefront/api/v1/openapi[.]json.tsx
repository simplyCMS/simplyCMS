import { createFileRoute } from '@tanstack/react-router';
import { CORE_OPERATIONS } from 'simplycms/admin-server/impl';
import {
  handleOpenApiRequest,
  methodNotAllowed,
} from 'simplycms/operations/server';

/**
 * `GET|HEAD /api/v1/openapi.json` — OpenAPI 3.1 з реєстру операцій (Д1).
 * Доступ: валідний Bearer-токен (будь-які scopes) АБО cookie-сесія з
 * `admin.access` (перелік розкриває плагіни, тож покупцю він закритий).
 * Єдиний export — `Route` (Gate C). HEAD реєструється явно (Start 1.167 не
 * падає з HEAD на GET); `ANY` відмовляє, бо метод без хендлера пішов би в SSR.
 */
export const Route = createFileRoute('/api/v1/openapi.json')({
  server: {
    handlers: {
      GET: ({ request }: { request: Request }) =>
        handleOpenApiRequest(request, CORE_OPERATIONS),
      HEAD: ({ request }: { request: Request }) =>
        handleOpenApiRequest(request, CORE_OPERATIONS),
      ANY: () => methodNotAllowed('GET, HEAD'),
    },
  },
});
