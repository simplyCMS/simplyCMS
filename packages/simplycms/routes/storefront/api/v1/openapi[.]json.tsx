import { createFileRoute } from '@tanstack/react-router';
import { CORE_OPERATIONS } from 'simplycms/admin-server/impl';
import {
  handleOpenApiRequest,
  methodNotAllowed,
} from 'simplycms/operations/server';

/**
 * `GET /api/v1/openapi.json` — OpenAPI 3.1 з реєстру операцій (Д1), лише
 * автентифікованому адміністративному суб'єкту (перелік розкриває плагіни).
 * Єдиний export — `Route` (Gate C); `ANY` відмовляє, бо метод без хендлера
 * пішов би в SSR.
 */
export const Route = createFileRoute('/api/v1/openapi.json')({
  server: {
    handlers: {
      GET: ({ request }: { request: Request }) =>
        handleOpenApiRequest(request, CORE_OPERATIONS),
      ANY: () => methodNotAllowed('GET'),
    },
  },
});
