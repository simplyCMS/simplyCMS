// М1 Task 11, майстер §3.3: `If-Match`/`ETag` (перша версіонована операція) і
// ідемпотентність `products.create` крізь `handleApiRequest`.
import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it, vi } from 'vitest';

const session = vi.hoisted(() => ({ byHeader: new Map<string, unknown>() }));
vi.mock('simplycms/auth', async (orig) => ({
  ...(await orig<typeof import('simplycms/auth')>()),
  readSessionSubject: vi.fn(
    async (headers: Headers) =>
      session.byHeader.get(headers.get('x-test-session') ?? '') ?? null,
  ),
}));

import { apiHarness } from './fixtures/api-http';
import { ADMIN, useAddressingDb } from './fixtures/addressing-db';

describe('If-Match/ETag і Idempotency-Key на агрегаті товару', () => {
  const db = useAddressingDb('simplycms_product_aggregate_http');
  const { call, sessionAs } = apiHarness(session.byHeader);
  const S = { 'x-test-session': 'admin' };
  const texts = { uk: { name: 'Кабель' } };
  const created = async () => {
    const id = randomUUID();
    const res = await call('products.create', { id, texts }, S);
    expect(res.status).toBe(200);
    return id;
  };
  const kind = async (res: Response) =>
    ((await res.json()) as { kind?: string }).kind;

  beforeAll(async () => {
    await db.q(
      `insert into public.users (id, name, email) values ($1, 'a', 'a@x.test')`,
      [ADMIN.userId],
    );
    sessionAs('admin', ADMIN.userId);
  });

  it('відповідь команди несе ETag "v<n>"', async () => {
    const id = randomUUID();
    const res = await call('products.create', { id, texts }, S);
    expect(res.headers.get('etag')).toBe('"v1"');
    const save = await call(
      'products.saveDescription',
      { id, expectedVersion: 1, base: { sku: 'A' } },
      S,
    );
    expect(save.headers.get('etag')).toBe('"v2"');
  });

  it('Idempotency: products.create двічі через HTTP — один товар, replay теж несе ETag', async () => {
    const id = randomUUID();
    const headers = { ...S, 'idempotency-key': 'k-' + id };
    const first = await call('products.create', { id, texts }, headers);
    const again = await call('products.create', { id, texts }, headers);
    expect(first.headers.get('etag')).toBe('"v1"');
    expect(again.headers.get('idempotent-replayed')).toBe('true');
    expect(again.headers.get('etag')).toBe('"v1"');
    const n = await db.q(`select 1 from public.products where id = $1`, [id]);
    expect(n).toHaveLength(1);
  });

  it('If-Match "v1" + expectedVersion 2 → 400', async () => {
    const id = await created();
    const res = await call(
      'products.saveDescription',
      { id, expectedVersion: 2 },
      { ...S, 'if-match': '"v1"' },
    );
    expect(res.status).toBe(400);
    expect(await kind(res)).toBe('validation');
  });

  it('лише If-Match працює як expectedVersion; застарілий → 412', async () => {
    const id = await created();
    const ok = await call(
      'products.saveDescription',
      { id, base: { sku: 'A' } },
      { ...S, 'if-match': '"v1"' },
    );
    expect(ok.status).toBe(200);
    expect(ok.headers.get('etag')).toBe('"v2"');
    const stale = await call(
      'products.saveDescription',
      { id, base: { sku: 'B' } },
      { ...S, 'if-match': '"v1"' },
    );
    expect(stale.status).toBe(412);
    expect(await kind(stale)).toBe('version_mismatch');
  });

  it('If-Match у хибному форматі → 400', async () => {
    const id = await created();
    const res = await call(
      'products.saveDescription',
      { id },
      { ...S, 'if-match': 'v1' },
    );
    expect(res.status).toBe(400);
  });

  it('If-Match на операції без expectedVersion → 400, а не мовчазне ігнорування', async () => {
    const id = randomUUID();
    const res = await call(
      'products.create',
      { id, texts },
      { ...S, 'if-match': '"v1"' },
    );
    expect(res.status).toBe(400);
    expect(
      await db.q(`select 1 from public.products where id = $1`, [id]),
    ).toHaveLength(0);
    const list = await call('languages.list', {}, { ...S, 'if-match': '"v1"' });
    expect(list.status).toBe(400);
  });
});
