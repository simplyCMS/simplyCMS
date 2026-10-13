import { execFile } from 'node:child_process';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import {
  checkAdminRedirect,
  checkBodyLimit,
  checkBrotli,
  checkHealth,
  checkRobots,
  findEntryScript,
} from '../packages/cli/src/smoke-checks.mjs';
import { CLI_INDEX } from './lib/fake-core-store';

// `simplycms smoke <url>` (К3-Е8, Task 21): чисті рішення + справжній CLI проти локального сервера.
type Behaviour = { bodyLimit: number; br: boolean; health?: object };
const servers: Server[] = [];
afterEach(async () => {
  for (const s of servers.splice(0))
    await new Promise((resolve) => s.close(resolve));
});

/** Магазин-імітація: `bodyLimit` — статус на 3 МБ (413 або 502), `br` — чи віддає стиснення. */
async function shop({ bodyLimit, br, health }: Behaviour) {
  const server = createServer((req, res) => {
    const url = req.url ?? '/';
    if (req.method === 'POST') {
      // Тіло не читаємо: відмова за Content-Length, як у раннері.
      res.writeHead(bodyLimit, { 'content-type': 'application/json' });
      res.end('{}');
      req.resume();
      return;
    }
    if (url === '/api/health') {
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify(health ?? { status: 'healthy', build: 'b-1' }));
    } else if (url === '/admin') {
      res.writeHead(302, { location: '/auth' }).end();
    } else if (url === '/robots.txt') {
      res.end('User-agent: *\nAllow: /\n');
    } else if (url === '/assets/index-abc.js') {
      if (br) res.setHeader('content-encoding', 'br');
      res.setHeader('content-type', 'text/javascript');
      res.end('x');
    } else if (url === '/' || url === '/catalog') {
      res.setHeader('content-type', 'text/html');
      res.end('<html><script>import("/assets/index-abc.js")</script></html>');
    } else res.writeHead(404).end();
  });
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

const smoke = (...args: string[]) =>
  new Promise<{ code: number; out: string; err: string }>((resolve) => {
    execFile('node', [CLI_INDEX, 'smoke', ...args], (error, out, err) =>
      resolve({
        code: error ? ((error as { code?: number }).code ?? 1) : 0,
        out,
        err,
      }),
    );
  });

describe('smoke проти локального сервера', () => {
  it('усе гаразд → сім ✓, код 0', async () => {
    const r = await smoke(await shop({ bodyLimit: 413, br: true }));
    expect(r.code).toBe(0);
    expect(r.out.match(/^✓ /gm)).toHaveLength(7);
    expect(r.out).not.toContain('✗');
    expect(r.out).toContain('✓ /api/health — збірка b-1');
  });

  it('3 МБ → 502 (обрив за стелею дійшов до проксі) → ✗ і код 1', async () => {
    const r = await smoke(await shop({ bodyLimit: 502, br: true }));
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/✗ тіло 3 МБ → 413 — HTTP 502/);
  });

  it('сервер без br → ✗ стиснення і код 1', async () => {
    const r = await smoke(await shop({ bodyLimit: 413, br: false }));
    expect(r.code).toBe(1);
    expect(r.out).toMatch(
      /✗ стиснення br на статиці — content-encoding: немає/,
    );
  });

  it('health без build → ✗', async () => {
    const r = await smoke(
      await shop({ bodyLimit: 413, br: true, health: { status: 'healthy' } }),
    );
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/✗ \/api\/health — build порожній/);
  });

  it('недосяжний сервер → усі ✗ без падіння, код 1', async () => {
    const url = await shop({ bodyLimit: 413, br: true });
    await new Promise((resolve) => servers.pop()!.close(resolve));
    const r = await smoke(url);
    expect(r.code).toBe(1);
    expect(r.out.match(/^✗ /gm)).toHaveLength(7);
  });

  it('без адреси, не-адреса й userinfo → помилка використання, код 1', async () => {
    expect((await smoke()).code).toBe(1);
    expect((await smoke('shop')).code).toBe(1);
    const r = await smoke('https://u:p@shop.example.com');
    expect(r.code).toBe(1);
    expect(r.out + r.err).not.toContain('u:p');
  });
});

describe('чисті рішення smoke', () => {
  it('checkBodyLimit: лише 413 — успіх', () => {
    expect(checkBodyLimit({ status: 413 }).ok).toBe(true);
    for (const status of [200, 400, 502, 504])
      expect(checkBodyLimit({ status }).ok).toBe(false);
  });

  it('checkHealth: degraded, 503, порожній build — червоні', () => {
    const json = { status: 'healthy', build: 'x' };
    expect(checkHealth({ status: 200, json }).ok).toBe(true);
    expect(checkHealth({ status: 503, json }).ok).toBe(false);
    expect(
      checkHealth({ status: 200, json: { status: 'degraded', build: 'x' } }).ok,
    ).toBe(false);
    expect(
      checkHealth({ status: 200, json: { status: 'healthy', build: '' } }).ok,
    ).toBe(false);
    expect(checkHealth({ status: 200, json: null }).ok).toBe(false);
  });

  it('checkAdminRedirect: потрібен редирект із Location', () => {
    expect(checkAdminRedirect({ status: 302, location: '/auth' }).ok).toBe(
      true,
    );
    expect(checkAdminRedirect({ status: 302, location: null }).ok).toBe(false);
    expect(checkAdminRedirect({ status: 200, location: null }).ok).toBe(false);
  });

  it('checkBrotli, checkRobots, findEntryScript', () => {
    expect(checkBrotli({ status: 200, encoding: 'br' }).ok).toBe(true);
    expect(checkBrotli({ status: 200, encoding: 'gzip' }).ok).toBe(false);
    expect(checkRobots({ status: 200, text: 'User-agent: *' }).ok).toBe(true);
    expect(checkRobots({ status: 200, text: '<html>' }).ok).toBe(false);
    expect(findEntryScript('<script src="/assets/a-1.js">')).toBe(
      '/assets/a-1.js',
    );
    expect(findEntryScript('<html></html>')).toBeNull();
  });
});
