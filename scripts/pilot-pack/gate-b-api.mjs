/**
 * Gate B: `/api/v1` на ЗІБРАНОМУ скафолдженому магазині (М1, майстер §3.3 і §5: «читається
 * обома транспортами»). Раніше `/api/v1` у пілоті бачили лише як 404 — тож не було доказу, що
 * роут `$op.tsx` змонтований шаблоном, дожив до production-манифесту й працює з БД.
 *
 * Токен і сервісний запис кладе оверлей `api-probe.mjs` (`apply-probe.mjs`); без нього перші ж
 * кроки червоніють із підказкою, а не пропускаються мовчки.
 */
import { PROBE_TOKEN } from './api-probe.mjs';

const HINT =
  ' (немає проби — `node scripts/pilot-pack/apply-probe.mjs <DSN>` поверх `pnpm db:demo`)';
const bearer = { authorization: `Bearer ${PROBE_TOKEN}` };

/**
 * @param {string} base
 * @param {(label: string, passed: boolean, fact: string) => void} check
 */
export async function checkApiV1(base, check) {
  const anon = await fetch(`${base}/api/v1/openapi.json`);
  check(
    'GET /api/v1/openapi.json (анонім)',
    anon.status === 401,
    `${anon.status}, WWW-Authenticate: ${anon.headers.get('www-authenticate') ?? '—'}`,
  );

  const spec = await fetch(`${base}/api/v1/openapi.json`, { headers: bearer });
  const specJson = spec.status === 200 ? await spec.json() : null;
  const paths = Object.keys(specJson?.paths ?? {});
  check(
    'GET /api/v1/openapi.json (Bearer)',
    spec.status === 200 && paths.includes('/api/v1/languages.list'),
    `${spec.status}, шляхів: ${paths.length}, languages.list: ${paths.includes('/api/v1/languages.list')}` +
      (spec.status === 401 ? HINT : ''),
  );

  const list = await fetch(`${base}/api/v1/languages.list`, {
    method: 'POST',
    headers: { ...bearer, 'content-type': 'application/json' },
    body: '{}',
  });
  const rows = list.status === 200 ? await list.json() : null;
  check(
    'POST /api/v1/languages.list (Bearer, scope languages.list)',
    list.status === 200 &&
      Array.isArray(rows) &&
      rows.some((row) => row.isDefault === true),
    `${list.status}, мов: ${Array.isArray(rows) ? rows.length : '—'}`,
  );

  // sessionOnly: токен зі scope `api-tokens.list` і роллю admin усе одно не керує токенами.
  const tokens = await fetch(`${base}/api/v1/api-tokens.list`, {
    method: 'POST',
    headers: { ...bearer, 'content-type': 'application/json' },
    body: '{}',
  });
  const problem = tokens.status === 403 ? await tokens.json() : null;
  check(
    'POST /api/v1/api-tokens.list (Bearer → sessionOnly)',
    tokens.status === 403 && problem?.kind === 'forbidden',
    `${tokens.status}, kind: ${problem?.kind ?? '—'}`,
  );
}
