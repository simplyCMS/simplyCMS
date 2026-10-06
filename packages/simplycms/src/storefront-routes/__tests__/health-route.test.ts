import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Роут `/api/health` (Е6б-28): `GET` — JSON health, `HEAD` — те саме без
 * тіла, будь-який інший метод — 405 з `Allow: GET, HEAD` через `ANY`, без БД
 * і без SSR.
 *
 * Диспетчери нижче — дві моделі пошуку Start (`handleServerRoutes` у
 * `@tanstack/start-server-core` `createStartHandler.js`): 1.169.x —
 * `handlers[method] ?? handlers.ANY`, а для HEAD `HEAD ?? GET ?? ANY`;
 * 1.167.x — простий `handlers[method] ?? handlers.ANY` для всіх методів.
 * Магазин тягне Start за peer `^1`, тож роут мусить бути коректним в обох.
 * Живий доказ на зібраному сервері — рядок `GET /api/health` у `gateHttp`
 * (`scripts/pilot-pack/gate-b.mjs`), який `pnpm live:smoke` проганяє першим.
 */

const { dbFails } = vi.hoisted(() => ({ dbFails: { value: false } }));
vi.mock('simplycms/db', () => ({
  withActor: async () => {
    if (dbFails.value) throw new Error('connect ECONNREFUSED db.internal:5432');
  },
}));

import * as routeModule from '../../../routes/storefront/api/health';

type Handler = (ctx: { request: Request }) => Response | Promise<Response>;
const handlers = routeModule.Route.options.server?.handlers as unknown as
  Record<string, Handler> | undefined;

/** Пошук Start 1.169.x: HEAD падає на GET. */
const lookup169 = (method: string) =>
  method === 'HEAD'
    ? (handlers?.HEAD ?? handlers?.GET ?? handlers?.ANY)
    : (handlers?.[method] ?? handlers?.ANY);
/** Пошук Start 1.167.x: без виведення HEAD із GET. */
const lookup167 = (method: string) => handlers?.[method] ?? handlers?.ANY;

const dispatch = (method: string, lookup = lookup169) => {
  const request = new Request('http://shop.test/api/health', { method });
  return lookup(method)!({ request });
};

beforeEach(() => {
  dbFails.value = false;
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('роут /api/health', () => {
  it('реєструє рівно GET, HEAD і ANY; файл експортує лише Route', () => {
    expect(Object.keys(handlers ?? {})).toEqual(['GET', 'HEAD', 'ANY']);
    expect(Object.keys(routeModule)).toEqual(['Route']);
  });

  it.each([
    ['1.169', lookup169],
    ['1.167', lookup167],
  ] as const)(
    'HEAD (пошук Start %s) — статус і заголовки GET, без тіла',
    async (_v, lookup) => {
      const get = await dispatch('GET', lookup);
      const head = await dispatch('HEAD', lookup);
      expect(head.status).toBe(200);
      expect(head.headers.get('content-type')).toBe(
        get.headers.get('content-type'),
      );
      expect(head.body).toBeNull();
    },
  );

  it('HEAD при недоступній БД — 503, як GET', async () => {
    dbFails.value = true;
    const head = await dispatch('HEAD', lookup167);
    expect(head.status).toBe(503);
    expect(head.body).toBeNull();
  });

  it('GET — JSON health 200, а не відмова ANY', async () => {
    const res = await dispatch('GET');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/json');
    const body = (await res.json()) as { status: string };
    expect(body.status).toBe('healthy');
  });

  it('GET при недоступній БД — 503 без деталей драйвера', async () => {
    dbFails.value = true;
    const res = await dispatch('GET');
    expect(res.status).toBe(503);
    expect(await res.text()).not.toContain('db.internal');
  });

  it.each(['POST', 'PUT', 'DELETE', 'PATCH'])(
    '%s — 405 з Allow: GET, HEAD і без тіла',
    async (method) => {
      const res = await dispatch(method);
      expect(res.status).toBe(405);
      expect(res.headers.get('allow')).toBe('GET, HEAD');
      expect(await res.text()).toBe('');
    },
  );
});
