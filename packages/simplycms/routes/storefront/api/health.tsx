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
 * `healthResponse` нижче НЕ експортується: після стрипінгу `server` на неї
 * ніхто не посилається, і dead-code elimination Start прибирає її разом з
 * імпортом `simplycms/db`.
 */
export const Route = createFileRoute('/api/health')({
  server: {
    handlers: {
      GET: () => healthResponse(false),
      // 🔴 HEAD реєструється ЯВНО (як `routes/storefront/media/$.tsx`). Start
      // 1.169.x шукає хендлер так: `HEAD ?? GET ?? ANY` для HEAD і
      // `handlers[METHOD] ?? ANY` для решти (`handleServerRoutes`,
      // `createStartHandler.js`) — тобто сам падає з HEAD на GET. Але 1.167.x
      // робив простий lookup `handlers[METHOD] ?? ANY`, і HEAD ішов би в `ANY`
      // → 405: healthcheck деплою методом HEAD бачив би «впав» на живому
      // магазині. Магазин тягне Start за peer `^1`, версію шаблон не пінить.
      HEAD: () => healthResponse(true),
      // 🔴 Будь-який інший метод — 405 без БД і без SSR (Е6б-28). Без `ANY`
      // POST падав у рендер роутера і віддавав сторінку 200 або 500 залежно
      // від БД. Правило «реєструй методи поіменно, не `ANY`» стосується
      // РОЗДАЧІ (публічний роут почав би відповідати на POST/DELETE); тут `ANY`
      // лише ВІДМОВЛЯЄ, а `GET`/`HEAD` за іменем мають пріоритет над ним.
      ANY: () =>
        new Response(null, { status: 405, headers: { Allow: 'GET, HEAD' } }),
    },
  },
});

/**
 * Відповідь health. `bodyless` (HEAD) — ті самі статус і заголовки, що в GET,
 * без тіла: HEAD відповідає як GET усім, крім тіла (RFC 9110 § 9.3.2).
 */
async function healthResponse(bodyless: boolean): Promise<Response> {
  let ok = false;
  let error: string | null = null;

  try {
    await withActor({ role: 'app_user' }, (db) => db.execute(sql`select 1`));
    ok = true;
  } catch (err) {
    error = err instanceof Error ? err.message : 'Unknown error';
  }

  // 🔴 Назовні — стабільний рядок, а не `err.message`: текст помилки
  // драйвера містить hostname, роль і деталі зʼєднання, а health —
  // публічний неавтентифікований ендпоінт. Повна причина — у лог.
  if (error) console.error('[health] database check failed:', error);

  const res = Response.json(
    {
      status: ok ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      checks: {
        database: { ok, error: ok ? null : 'database unavailable' },
      },
    },
    { status: ok ? 200 : 503 },
  );
  return bodyless
    ? new Response(null, { status: res.status, headers: res.headers })
    : res;
}
