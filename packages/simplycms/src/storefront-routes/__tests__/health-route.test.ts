import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Роут `/api/health` (Е6б-28): `GET` — JSON health, будь-який інший метод —
 * 405 з `Allow: GET` через `ANY`, без БД і без SSR.
 *
 * Диспетчер нижче — модель пошуку Start
 * (`handlers[method] ?? handlers.ANY`, `createStartHandler.js:374`): саме
 * через неї `GET` за іменем має пріоритет над `ANY`. Живий доказ на зібраному
 * сервері — рядок `GET /api/health` у `gateHttp` (`scripts/pilot-pack/gate-b.mjs`),
 * який `pnpm live:smoke` проганяє першим.
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

const dispatch = (method: string) => {
  const request = new Request('http://shop.test/api/health', { method });
  const handler = handlers?.[method] ?? handlers?.ANY;
  return handler!({ request });
};

beforeEach(() => {
  dbFails.value = false;
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('роут /api/health', () => {
  it('реєструє рівно GET і ANY; файл експортує лише Route', () => {
    expect(Object.keys(handlers ?? {})).toEqual(['GET', 'ANY']);
    expect(Object.keys(routeModule)).toEqual(['Route']);
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
    '%s — 405 з Allow: GET і без тіла',
    async (method) => {
      const res = await dispatch(method);
      expect(res.status).toBe(405);
      expect(res.headers.get('allow')).toBe('GET');
      expect(await res.text()).toBe('');
    },
  );
});
