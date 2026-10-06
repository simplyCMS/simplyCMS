import { createFileRoute } from '@tanstack/react-router';
import { sql } from 'drizzle-orm';
import { withActor } from 'simplycms/db';

/**
 * Health-ендпоінт магазину: пінг Postgres під роллю вітрини.
 *
 * 🔴 Перевіряє ТОЙ бекенд, на якому магазин працює. До 0.4.1 тут стояла
 * перевірка Supabase — у чистому V2-магазині вона давала 503 при повністю
 * робочому магазині, тобто healthcheck деплою (Dokploy) був би вічно
 * «unhealthy» (аудит 2026-08-24).
 *
 * 🔴 Файл лишає ЄДИНИЙ export — `Route`. Named export звідси пережив би
 * стрипінг властивості `server` і затягнув би пул Postgres у клієнтський
 * бандл; ловить це Gate C пілота (`scripts/pilot-pack/gate-c.mjs`).
 */
export const Route = createFileRoute('/api/health')({
  server: {
    handlers: {
      GET: async () => {
        let ok = false;
        let error: string | null = null;

        try {
          await withActor({ role: 'app_user' }, (db) =>
            db.execute(sql`select 1`),
          );
          ok = true;
        } catch (err) {
          error = err instanceof Error ? err.message : 'Unknown error';
        }

        // 🔴 Назовні — стабільний рядок, а не `err.message`: текст помилки
        // драйвера містить hostname, роль і деталі зʼєднання, а health —
        // публічний неавтентифікований ендпоінт. Повна причина — у лог.
        if (error) console.error('[health] database check failed:', error);

        return Response.json(
          {
            status: ok ? 'healthy' : 'degraded',
            timestamp: new Date().toISOString(),
            checks: {
              database: { ok, error: ok ? null : 'database unavailable' },
            },
          },
          { status: ok ? 200 : 503 },
        );
      },
      // 🔴 Будь-який інший метод — 405 без БД і без SSR (Е6б-28). Start шукає
      // хендлер у `handleServerRoutes` (`@tanstack/start-server-core`,
      // `createStartHandler.js`): `handlers[method] ?? handlers.ANY`, а для
      // HEAD — `HEAD ?? GET ?? ANY` (тож HEAD іде в `GET`, не в 405). Без
      // `ANY` POST падав у рендер роутера і віддавав сторінку 200 або 500
      // залежно від БД. Правило «реєструй методи поіменно, не `ANY`» стосується
      // РОЗДАЧІ (публічний роут почав би відповідати на POST/DELETE); тут `ANY`
      // лише ВІДМОВЛЯЄ, а `GET` за іменем має пріоритет над ним.
      ANY: () => new Response(null, { status: 405, headers: { Allow: 'GET' } }),
    },
  },
});
