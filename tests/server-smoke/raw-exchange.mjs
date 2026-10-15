import { connect } from 'node:net';

/**
 * Шле сирі байти, читає відповідь до кінця заголовків. Повертає статус,
 * заголовки та `closedBy` — чи закрив сервер сокет протягом `settleMs`
 * після відповіді.
 */
export function rawExchange(port, head, body, settleMs = 400) {
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
