// Підміна глобального fetch для скриптів скіла онбордингу (`node --import …`).
// FAKE_ROUTES: JSON { "METHOD path": відповідь | [відповіді по черзі] }, відповідь —
// { status?, body? }; останній елемент черги повторюється. FAKE_LOG: файл, куди
// дописується кожен запит { method, path, body } (рядок JSON). Невідомий маршрут — 404.
import { appendFileSync } from 'node:fs';

const routes = JSON.parse(process.env.FAKE_ROUTES ?? '{}');
const counters = {};

globalThis.fetch = async (input, init = {}) => {
  const url = new URL(String(input));
  const method = init.method ?? 'GET';
  const path = url.pathname.replace(/^\/api\//, '');
  appendFileSync(
    process.env.FAKE_LOG,
    `${JSON.stringify({ method, path, body: init.body ? JSON.parse(init.body) : null })}\n`,
  );
  const key = `${method} ${path}`;
  let entry = routes[key];
  if (Array.isArray(entry)) {
    const i = Math.min(counters[key] ?? 0, entry.length - 1);
    counters[key] = (counters[key] ?? 0) + 1;
    entry = entry[i];
  }
  if (!entry) return new Response('not found', { status: 404 });
  return new Response(
    entry.body === undefined ? '' : JSON.stringify(entry.body),
    {
      status: entry.status ?? 200,
    },
  );
};
