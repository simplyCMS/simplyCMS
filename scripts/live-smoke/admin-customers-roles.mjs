/**
 * Частина «роль» кроку К3-Е6г (`./admin-customers.mjs`): власник видає роль
 * покупцю B → B відкриває `/admin` (200); власник знімає роль → наступний
 * `GET /admin` дає редірект на `/`, а повторений адмін-serverFn із контексту B
 * — 403 (Е6г-3: guard не змінюється, відмову дає `runAdmin`).
 *
 * 🔴 Адмін-serverFn беремо з трафіку самої адмінки B (`/_serverFn/<id>`
 * хешований збіркою) і повторюємо тим самим тілом/заголовками з Origin
 * магазину — інакше CSRF-міддлвара відмовила б раніше за авторизацію.
 * Потрібний — той, що віддає зведення дашборду (`recentOrders` у відповіді).
 */
import { waitText } from './selectors.mjs';
import * as q from './admin-customers-sql.mjs';
import * as ui from './admin-customers-owner.mjs';

const SKIP = new Set(['content-length', 'host', 'cookie', 'connection']);

/** Повтор записаного запиту serverFn (GET чи POST) у контексті B (cookie контекст підставляє сам). */
const replay = (ctx, base, rec) =>
  ctx.request.fetch(rec.url, {
    method: rec.method,
    headers: {
      ...Object.fromEntries(
        Object.entries(rec.headers).filter(([k]) => !SKIP.has(k)),
      ),
      origin: base,
    },
    data: rec.data ?? undefined,
    failOnStatusCode: false,
  });

/** Перший записаний serverFn, що віддає зведення дашборду (200, `recentOrders`). */
async function findSummaryCall(ctx, base, recorded) {
  const seen = [];
  for (const rec of recorded) {
    const r = await replay(ctx, base, rec);
    const body = await r.text();
    seen.push(r.status());
    if (r.status() === 200 && body.includes('recentOrders'))
      return { rec, seen };
  }
  return { rec: null, seen };
}

export async function rolesPart({
  page,
  pages,
  contexts,
  base,
  dbUrl,
  check,
  st,
}) {
  const recorded = [];
  pages.b.on('request', (r) => {
    if (r.url().includes('/_serverFn/'))
      recorded.push({
        method: r.method(),
        url: r.url(),
        headers: r.headers(),
        data: r.postData(),
      });
  });
  const granted = await ui.toggleAdmin(page, base, st.b.userId, true);
  const roles = await q.rolesOf(dbUrl, st.b.userId);
  const resp = await pages.b.goto(`${base}/admin`, {
    waitUntil: 'networkidle',
  });
  const heading = await waitText(pages.b, 'Дашборд');
  const { rec: summary, seen } = await findSummaryCall(
    contexts.b,
    base,
    recorded,
  );
  check(
    'покупці: власник видав роль B — user_roles має admin, B відкриває /admin (200, Дашборд), адмін-serverFn відповідає',
    granted &&
      roles.includes('admin') &&
      resp?.status() === 200 &&
      pages.b.url() === `${base}/admin` &&
      heading &&
      summary !== null,
    `тост ${granted}; ролі ${roles}; /admin ${resp?.status()} ${pages.b.url()}; serverFn ${summary?.url ?? '—'}; записано ${recorded.length} ${JSON.stringify(seen)}`,
  );
  const revoked = await ui.toggleAdmin(page, base, st.b.userId, false);
  const after = await q.rolesOf(dbUrl, st.b.userId);
  const guard = await contexts.b.request.get(`${base}/admin`, {
    maxRedirects: 0,
    failOnStatusCode: false,
  });
  const location = guard.headers().location ?? '';
  const denied = summary && (await replay(contexts.b, base, summary));
  check(
    'покупці: власник зняв роль — GET /admin для B редірект на /, повторений адмін-serverFn із контексту B — 403',
    revoked &&
      !after.includes('admin') &&
      guard.status() >= 300 &&
      guard.status() < 400 &&
      new URL(location, base).pathname === '/' &&
      denied?.status() === 403,
    `тост ${revoked}; ролі ${after}; GET /admin ${guard.status()} → ${location}; serverFn ${denied?.status()}`,
  );
}
