// Вихід операції звіряється з `def.output` (OpenAPI обіцяє цю схему): невідповідність
// — 500 internal без деталей, зайві поля відсікаються.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

const result = vi.hoisted(() => ({ output: undefined as unknown }));
vi.mock('simplycms/auth', async (orig) => ({
  ...(await orig<typeof import('simplycms/auth')>()),
  readSessionSubject: vi.fn(async () => ({ userId: 'u1', roles: ['admin'] })),
}));
vi.mock('../execute', () => ({
  executeOperation: vi.fn(async () => ({
    replayed: false,
    output: result.output,
  })),
}));

import { defineOperation } from '..';
import { handleApiRequest } from '../http/handle';

const op = defineOperation({
  id: 'test.out',
  permission: 'settings.manage',
  input: z.object({}),
  output: z.object({ name: z.string(), at: z.iso.datetime() }),
  async run() {
    return { name: 'x', at: '2026-01-01T00:00:00.000Z' };
  },
});
const call = () =>
  handleApiRequest(
    new Request('https://shop.test/api/v1/test.out', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    }),
    'test.out',
    () => op as never,
  );

describe('вихід операції звіряється зі схемою', () => {
  beforeEach(() => {
    result.output = undefined;
  });

  it('поле не за схемою → 500 internal без деталей', async () => {
    result.output = { name: 42, at: 'не дата', secret: 'pg: relation x' };
    const res = await call();
    expect(res.status).toBe(500);
    const text = await res.text();
    expect(JSON.parse(text).kind).toBe('internal');
    expect(text).not.toMatch(/relation|secret|схем/);
  });

  it('зайві поля відсікаються, Date стає ISO-рядком', async () => {
    result.output = {
      name: 'x',
      at: new Date('2026-01-02T03:04:05.000Z'),
      extra: 'не віддавати',
    };
    const res = await call();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      name: 'x',
      at: '2026-01-02T03:04:05.000Z',
    });
  });
});
