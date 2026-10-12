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
 * Хендлер — той самий `checkBodyLimit` ядра (Node 24 вантажить `.ts` напряму;
 * `simplycms/domain/media` резолвиться самопосиланням пакета).
 */
import { connect } from 'node:net';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { MAX_REQUEST_BODY_BYTES } from 'simplycms/domain/media';

import { startSmokeServer } from './server-smoke/sandbox.mjs';

const BODY_LIMIT = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'packages/simplycms/src/runtime/body-limit.ts',
);

const HANDLER = `import { checkBodyLimit } from ${JSON.stringify(BODY_LIMIT)};
export default {
  async fetch(request) {
    return checkBodyLimit(request) ?? new Response('ok');
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
    server = await startSmokeServer({}, HANDLER);
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
