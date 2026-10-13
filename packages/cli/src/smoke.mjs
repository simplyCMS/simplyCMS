// simplycms smoke <url> — швидкий живий смоук розгорнутого магазину (Б §3.2): health,
// ключові сторінки, редирект адмінки, robots, стиснення br і відмова 413 на завеликому тілі.
// Тонкий мережевий шар; рішення «ок чи ні» — у smoke-checks.mjs. Код виходу: 0/1.
import {
  checkAdminRedirect,
  checkBodyLimit,
  checkBrotli,
  checkHealth,
  checkPage,
  checkRobots,
  findEntryScript,
  OVERSIZED_BODY_BYTES,
} from './smoke-checks.mjs';

const REQUEST_TIMEOUT_MS = 10_000;

/** @param {string} raw */
function parseBaseUrl(raw) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(
      `smoke: «${raw}» не адреса — приклад: simplycms smoke https://shop.example.com`,
    );
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:')
    throw new Error('smoke: очікується http(s)-адреса');
  // Облікові дані в адресі потрапили б у вивід і в логи проксі.
  if (url.username || url.password)
    throw new Error('smoke: адреса не має містити userinfo');
  return url;
}

/** Запит із таймаутом і без слідування редиректам (редирект адмінки — предмет перевірки). */
async function request(base, path, init = {}, fetchImpl = fetch) {
  return fetchImpl(new URL(path, base), {
    redirect: 'manual',
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    ...init,
  });
}

/**
 * Усі перевірки по черзі. Мережева помилка однієї перевірки — її `✗`, а не падіння команди.
 * @returns {Promise<{ name: string, ok: boolean, detail: string }[]>}
 */
export async function runSmoke(base, fetchImpl = fetch) {
  const get = (path, init) => request(base, path, init, fetchImpl);
  let html = '';
  const steps = [
    [
      '/api/health',
      async () => {
        const res = await get('/api/health');
        return checkHealth({
          status: res.status,
          json: await res.json().catch(() => null),
        });
      },
    ],
    [
      '/',
      async () => {
        const res = await get('/');
        html = await res.text();
        return checkPage(res);
      },
    ],
    ['/catalog', async () => checkPage(await get('/catalog'))],
    [
      '/admin (редирект на вхід)',
      async () => {
        const res = await get('/admin');
        return checkAdminRedirect({
          status: res.status,
          location: res.headers.get('location'),
        });
      },
    ],
    [
      '/robots.txt',
      async () => {
        const res = await get('/robots.txt');
        return checkRobots({ status: res.status, text: await res.text() });
      },
    ],
    [
      'стиснення br на статиці',
      async () => {
        const entry = findEntryScript(html);
        if (!entry)
          return { ok: false, detail: 'у HTML головної немає /assets/*.js' };
        const res = await get(entry, {
          headers: { 'accept-encoding': 'br' },
        });
        return checkBrotli({
          status: res.status,
          encoding: res.headers.get('content-encoding'),
        });
      },
    ],
    [
      'тіло 3 МБ → 413',
      async () => {
        const res = await get('/_serverFn/x', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: new Uint8Array(OVERSIZED_BODY_BYTES),
        });
        return checkBodyLimit(res);
      },
    ],
  ];
  const results = [];
  for (const [name, step] of steps) {
    try {
      results.push({ name, ...(await step()) });
    } catch (error) {
      const timedOut = error?.name === 'TimeoutError';
      results.push({
        name,
        ok: false,
        detail: timedOut
          ? `не відповів за ${REQUEST_TIMEOUT_MS} мс`
          : String(error?.cause?.code ?? error?.message ?? error),
      });
    }
  }
  return results;
}

/** @param {string[]} argv */
export async function run(argv) {
  if (argv.length !== 1)
    throw new Error('smoke: очікується одна адреса — simplycms smoke <url>');
  const base = parseBaseUrl(argv[0]);
  const results = await runSmoke(base);
  for (const { name, ok, detail } of results)
    console.log(`${ok ? '✓' : '✗'} ${name} — ${detail}`);
  const failed = results.filter((r) => !r.ok).length;
  console.log(
    failed === 0
      ? 'smoke: усе гаразд'
      : `smoke: не пройшло ${failed} з ${results.length}`,
  );
  return failed === 0 ? 0 : 1;
}
