import { createFileRoute } from '@tanstack/react-router';
import { getOperation } from 'simplycms/admin-server/impl';
import {
  handleApiRequest,
  methodNotAllowed,
} from 'simplycms/operations/server';

/**
 * HTTP-адаптер операцій `POST /api/v1/<op>` (М1, майстер §3.3).
 *
 * 🔴 Реєстр передає РОУТ, а не адаптер: `simplycms/operations` не імпортує
 * `admin-server` (цикл тірів), тож `getOperation` приходить сюди.
 * 🔴 Файл лишає ЄДИНИЙ export — `Route` (як `health.tsx`): інакше named export
 * пережив би стрипінг `server` і затягнув пул Postgres у клієнтський бандл
 * (Gate C пілота).
 * 🔴 `ANY` лише відмовляє: метод без хендлера пішов би в SSR і віддав сторінку
 * замість 405 (урок `health.tsx`). `POST` за іменем має пріоритет над ним.
 */
export const Route = createFileRoute('/api/v1/$op')({
  server: {
    handlers: {
      POST: ({
        request,
        params,
      }: {
        request: Request;
        params: { op: string };
      }) => handleApiRequest(request, params.op, getOperation),
      ANY: () => methodNotAllowed('POST'),
    },
  },
});
