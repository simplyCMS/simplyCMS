import { afterEach, describe, expect, it, vi } from 'vitest';
import { MediaKeyCollisionError, MediaKeyError } from '../driver';
import { s3Driver } from '../s3';

const KEY = 'ab/ab000000-0000-4000-8000-000000000000.png';
const SECRET = 'secret-marker-7c1e';
const cfg = {
  driver: 's3' as const,
  endpoint: 'http://s3.test',
  region: 'garage',
  bucket: 'bkt',
  accessKey: 'AKIA-marker',
  secretKey: SECRET,
};

type Call = { method: string; url: string };

/** Підміна глобального `fetch`: відповіді за чергою, виклики — у журнал. */
function stubFetch(responses: Response[]): Call[] {
  const calls: Call[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: Request | string | URL, init?: RequestInit) => {
      const req = input instanceof Request ? input : new Request(input, init);
      calls.push({ method: req.method, url: req.url });
      const next = responses.shift();
      if (!next) throw new Error('несподіваний запит');
      return next;
    }),
  );
  return calls;
}

afterEach(() => vi.unstubAllGlobals());

describe('s3Driver', () => {
  it('path-style URL із кодуванням сегментів', async () => {
    const calls = stubFetch([new Response(null, { status: 404 })]);
    await s3Driver(cfg).open(KEY);
    expect(calls[0]).toEqual({
      method: 'HEAD',
      url: `http://s3.test/bkt/${KEY}`,
    });
  });

  it('put: HEAD 200 → колізія, PUT не викликано', async () => {
    const calls = stubFetch([new Response(null, { status: 200 })]);
    await expect(
      s3Driver(cfg).put(KEY, Uint8Array.of(1)),
    ).rejects.toBeInstanceOf(MediaKeyCollisionError);
    expect(calls.map((c) => c.method)).toEqual(['HEAD']);
  });

  it('put: HEAD 404 → PUT; 412 від PUT теж колізія', async () => {
    const calls = stubFetch([
      new Response(null, { status: 404 }),
      new Response(null, { status: 412 }),
    ]);
    await expect(
      s3Driver(cfg).put(KEY, Uint8Array.of(1)),
    ).rejects.toBeInstanceOf(MediaKeyCollisionError);
    expect(calls.map((c) => c.method)).toEqual(['HEAD', 'PUT']);
  });

  it('delete: 404 — успіх, 500 — помилка зі статусом без тіла й ключів', async () => {
    stubFetch([new Response(null, { status: 404 })]);
    await expect(s3Driver(cfg).delete(KEY)).resolves.toBeUndefined();
    stubFetch([new Response(`<Error>${SECRET}</Error>`, { status: 403 })]);
    const error = await s3Driver(cfg)
      .delete(KEY)
      .catch((e: Error) => e);
    expect((error as Error).message).toBe('S3 DELETE не вдався: 403');
    expect((error as Error).message).not.toContain(SECRET);
  });

  it('open без content-length — помилка, а не size 0', async () => {
    stubFetch([new Response(null, { status: 200 })]);
    await expect(s3Driver(cfg).open(KEY)).rejects.toThrow(
      'S3 HEAD не віддав розмір обʼєкта',
    );
  });

  it('open: збій HEAD (500) — виняток, не null', async () => {
    // aws4fetch повторює 5xx, тож відповіді потрібні на всі спроби.
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 500 })),
    );
    await expect(s3Driver(cfg).open(KEY)).rejects.toThrow(
      'S3 HEAD не вдався: 500',
    );
  });

  it('ключ із сегментом .. відбивається до мережі', async () => {
    const calls = stubFetch([]);
    await expect(s3Driver(cfg).open('ab/../x.png')).rejects.toBeInstanceOf(
      MediaKeyError,
    );
    expect(calls).toEqual([]);
  });
});
