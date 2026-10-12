/**
 * 413/411 через СПРАВЖНІЙ `server.mjs` (К3-Е8, Task 7).
 *
 * Стеля тіла (`checkBodyLimit`, `src/runtime/body-limit.ts`) відмовляє за
 * заголовком, не читаючи тіла. Юніт на `Request` не бачить іншого: відповідь
 * іде ПОКИ клієнт ще шле тіло, і Node-шар вирішує, закрити зʼєднання чи ні.
 * Закрите посеред відправки тіла — клієнт бачить обрив (ECONNRESET), а не 413,
 * тож відмову не прочитає ні fetch, ні проксі. Тому йдемо сирим сокетом і
 * дивимось і на заголовок `connection`, і на живість сокета після відповіді.
 *
 * Р20: раннер тримає власну стелю на ВСІ шляхи (1 МіБ; 26 МіБ лише для multipart
 * на точний сирий префікс serverFn) за `Content-Length` і лічильником chunked.
 * Стаб рахує виклики хендлера й байти, які той прочитав.
 *
 * Хендлер — той самий `checkBodyLimit` ядра (Node 24 вантажить `.ts` напряму;
 * `simplycms/domain/media` резолвиться самопосиланням пакета).
 */
import { connect } from 'node:net';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  MAX_REQUEST_BODY_BYTES,
  PAYLOAD_TOO_LARGE_CODE,
} from 'simplycms/domain/media';

import {
  PAYLOAD_TOO_LARGE_CODE as RUNNER_PAYLOAD_CODE,
  SERVER_FN_BODY_LIMIT,
} from '../server-runtime.mjs';

import { startSmokeServer } from './server-smoke/sandbox.mjs';

const BODY_LIMIT = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'packages/simplycms/src/runtime/body-limit.ts',
);

/**
 * Дзеркало Start: `handlerType` за НОРМАЛІЗОВАНИМ шляхом (`%5F` → `_`) і базою
 * `TSS_SERVER_FN_BASE`. Нестандартну базу ставить сам бандл під час імпорту —
 * як Start; тест доводить, що раннер читає її ПІСЛЯ імпорту.
 */
const makeHandler = (
  customBase,
) => `${customBase ? `process.env.TSS_SERVER_FN_BASE = ${JSON.stringify(customBase)};` : ''}
import { checkBodyLimit } from ${JSON.stringify(BODY_LIMIT)};
let calls = 0;
let bytes = 0;
export default {
  async fetch(request) {
    const { pathname } = new URL(request.url);
    if (pathname === '/__calls') return Response.json({ calls, bytes });
    if (pathname === '/__env') return new Response('ok');
    calls++;
    const base = process.env.TSS_SERVER_FN_BASE || '/_serverFn/';
    const type = decodeURIComponent(pathname).startsWith(base) ? 'serverFn' : 'router';
    const refusal = checkBodyLimit(request, type);
    if (refusal) return refusal;
    if (request.body) for await (const chunk of request.body) bytes += chunk.byteLength;
    return new Response('ok');
  },
};
`;

/**
 * Шле сирі байти, читає відповідь до кінця заголовків. Повертає статус,
 * заголовки та `closedBy` — чи закрив сервер сокет протягом `settleMs`
 * після відповіді.
 */
function rawExchange(port, head, body, settleMs = 400) {
  return new Promise((resolve, reject) => {
    const socket = connect(port, '127.0.0.1');
    let received = '';
    let answered = false;
    let closed = false;
    socket.on('error', (error) => {
      // ECONNRESET після відповіді — теж закриття; до відповіді — провал.
      if (answered) closed = true;
      else reject(error);
    });
    socket.on('close', () => {
      closed = true;
      if (!answered)
        reject(new Error(`сокет закрито без відповіді: ${received}`));
    });
    socket.on('data', (chunk) => {
      received += chunk.toString('latin1');
      const end = received.indexOf('\r\n\r\n');
      if (answered || end === -1) return;
      answered = true;
      const [statusLine, ...lines] = received.slice(0, end).split('\r\n');
      const headers = Object.fromEntries(
        lines.map((line) => {
          const at = line.indexOf(':');
          return [line.slice(0, at).toLowerCase(), line.slice(at + 1).trim()];
        }),
      );
      setTimeout(() => {
        socket.destroy();
        resolve({
          status: Number(statusLine.split(' ')[1]),
          headers,
          closedBy: closed ? 'server' : null,
        });
      }, settleMs);
    });
    socket.write(head);
    if (body) socket.write(body);
  });
}

describe('server.mjs: 413/411 без закриття зʼєднання', () => {
  let server;
  let port;

  beforeAll(async () => {
    server = await startSmokeServer({}, makeHandler());
    port = Number(new URL(server.baseUrl).port);
  }, 30_000);

  afterAll(() => server?.stop());

  it('Content-Length понад стелю + перші 64 КБ тіла → 413, зʼєднання живе', async () => {
    const result = await rawExchange(
      port,
      'POST /_serverFn/x HTTP/1.1\r\nHost: shop.test\r\n' +
        'Content-Type: application/octet-stream\r\n' +
        // Стеля — 26 МіБ (5×5 МіБ + overhead), тож «10485760» з брифу її не
        // перевищує; беремо межу + 1 з ядра.
        `Content-Length: ${MAX_REQUEST_BODY_BYTES + 1}\r\n\r\n`,
      Buffer.alloc(64 * 1024, 0x61),
    );
    expect(result.status).toBe(413);
    expect((result.headers.connection ?? '').toLowerCase()).not.toBe('close');
    expect(result.closedBy).toBeNull();
  });

  it('chunked multipart без Content-Length → 411, зʼєднання живе', async () => {
    const result = await rawExchange(
      port,
      'POST /_serverFn/x HTTP/1.1\r\nHost: shop.test\r\n' +
        'Content-Type: multipart/form-data; boundary=zz\r\n' +
        'Transfer-Encoding: chunked\r\n\r\n',
      '4\r\nabcd\r\n',
    );
    expect(result.status).toBe(411);
    expect((result.headers.connection ?? '').toLowerCase()).not.toBe('close');
    expect(result.closedBy).toBeNull();
  });

  it('контроль: малий POST у межах стелі проходить до хендлера', async () => {
    const result = await rawExchange(
      port,
      'POST /_serverFn/x HTTP/1.1\r\nHost: shop.test\r\n' +
        'Content-Type: application/json\r\nContent-Length: 2\r\n\r\n',
      '{}',
    );
    expect(result.status).toBe(200);
  });
});

const MIB = 1024 * 1024;
const multipart = 'multipart/form-data; boundary=zz';
const head = (path, type, length) =>
  `POST ${path} HTTP/1.1\r\nHost: shop.test\r\nContent-Type: ${type}\r\n` +
  `Content-Length: ${length}\r\n\r\n`;

describe('server.mjs: стеля тіла на всі шляхи (Р20)', () => {
  let server;
  let port;
  const calls = async () =>
    (await (await fetch(`${server.baseUrl}/__calls`)).json()).calls;

  beforeAll(async () => {
    server = await startSmokeServer({}, makeHandler());
    port = Number(new URL(server.baseUrl).port);
  }, 30_000);

  afterAll(() => server?.stop());

  it('парність: 26 МіБ у раннері = MAX_REQUEST_BODY_BYTES ядра', () => {
    expect(SERVER_FN_BODY_LIMIT).toBe(MAX_REQUEST_BODY_BYTES);
  });

  it('парність: тіло 413 раннера = PAYLOAD_TOO_LARGE_CODE ядра', () => {
    expect(RUNNER_PAYLOAD_CODE).toBe(PAYLOAD_TOO_LARGE_CODE);
  });

  it('/%5FserverFn/x multipart 2 МіБ → 413, хендлер не викликано', async () => {
    const before = await calls();
    const result = await rawExchange(
      port,
      head('/%5FserverFn/x', multipart, 2 * MIB),
      Buffer.alloc(1024, 0x61),
    );
    expect(result.status).toBe(413);
    expect(await calls()).toBe(before);
  });

  it('/api/auth/sign-up/email JSON 2 МіБ → 413', async () => {
    const before = await calls();
    const result = await rawExchange(
      port,
      head('/api/auth/sign-up/email', 'application/json', 2 * MIB),
      Buffer.alloc(1024, 0x61),
    );
    expect(result.status).toBe(413);
    expect(await calls()).toBe(before);
  });

  it('/_serverFn/x application/json 2 МіБ → 413 (мала стеля: не multipart)', async () => {
    const result = await rawExchange(
      port,
      head('/_serverFn/x', 'application/json', 2 * MIB),
      Buffer.alloc(1024, 0x61),
    );
    expect(result.status).toBe(413);
  });

  it('/_serverFn/x multipart 20 МіБ → до хендлера, 27 МіБ → 413', async () => {
    const ok = await rawExchange(
      port,
      head('/_serverFn/x', multipart, 20 * MIB),
      Buffer.alloc(20 * MIB, 0x61),
      1500,
    );
    expect(ok.status).toBe(200);
    const before = await calls();
    const big = await rawExchange(
      port,
      head('/_serverFn/x', multipart, 27 * MIB),
      Buffer.alloc(1024, 0x61),
    );
    expect(big.status).toBe(413);
    expect(await calls()).toBe(before);
  }, 30_000);

  it('chunked 2 МіБ на /api/auth/x → зʼєднання знищено, хендлер повного тіла не отримав', async () => {
    const bytesBefore = (
      await (await fetch(`${server.baseUrl}/__calls`)).json()
    ).bytes;
    const chunk = Buffer.alloc(64 * 1024, 0x61);
    const frame = Buffer.concat([
      Buffer.from(`${chunk.length.toString(16)}\r\n`),
      chunk,
      Buffer.from('\r\n'),
    ]);
    const outcome = await new Promise((resolve) => {
      const socket = connect(port, '127.0.0.1');
      let sent = 0;
      socket.on('error', () => resolve('destroyed'));
      socket.on('close', () => resolve('destroyed'));
      socket.write(
        'POST /api/auth/x HTTP/1.1\r\nHost: shop.test\r\n' +
          'Content-Type: application/json\r\nTransfer-Encoding: chunked\r\n\r\n',
      );
      const timer = setInterval(() => {
        if (socket.destroyed || sent >= 32) {
          clearInterval(timer);
          return;
        }
        sent++;
        socket.write(frame);
      }, 5);
      setTimeout(() => resolve('alive'), 5000).unref();
    });
    expect(outcome).toBe('destroyed');
    const state = await (await fetch(`${server.baseUrl}/__calls`)).json();
    expect(state.bytes - bytesBefore).toBeLessThanOrEqual(MIB);
  }, 15_000);

  it('chunked 512 КіБ → проходить', async () => {
    const chunk = Buffer.alloc(64 * 1024, 0x61);
    const body = Buffer.concat([
      ...Array.from({ length: 8 }, () =>
        Buffer.concat([
          Buffer.from(`${chunk.length.toString(16)}\r\n`),
          chunk,
          Buffer.from('\r\n'),
        ]),
      ),
      Buffer.from('0\r\n\r\n'),
    ]);
    const result = await rawExchange(
      port,
      'POST /api/auth/x HTTP/1.1\r\nHost: shop.test\r\n' +
        'Content-Type: application/json\r\nTransfer-Encoding: chunked\r\n\r\n',
      body,
    );
    expect(result.status).toBe(200);
  });
});

describe('server.mjs: база serverFn читається ПІСЛЯ імпорту бандла (Р20)', () => {
  let server;
  let port;

  beforeAll(async () => {
    server = await startSmokeServer({}, makeHandler('/_custom/fn/'));
    port = Number(new URL(server.baseUrl).port);
  }, 30_000);

  afterAll(() => server?.stop());

  it('multipart 20 МіБ на /_custom/fn/x проходить, на /_serverFn/x → 413', async () => {
    const ok = await rawExchange(
      port,
      head('/_custom/fn/x', multipart, 20 * MIB),
      Buffer.alloc(20 * MIB, 0x61),
      1500,
    );
    expect(ok.status).toBe(200);
    const old = await rawExchange(
      port,
      head('/_serverFn/x', multipart, 20 * MIB),
      Buffer.alloc(1024, 0x61),
    );
    expect(old.status).toBe(413);
  }, 30_000);
});
