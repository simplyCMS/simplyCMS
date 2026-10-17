/**
 * Стеля тіла запиту (К3-Е6д-2) — живий доказ на справжньому Node-сервері.
 *
 * 🔴 Юніт `checkBodyLimit` не доводить двох речей, які тут і перевіряються:
 * (1) запас стелі достатній для НАЙБІЛЬШОГО легітимного запиту — подача
 * відгуку з 5 файлами по `MAX_REVIEW_IMAGE_BYTES - 1024` проходить браузером
 * наскрізь (multipart-обгортка реальна, не вирахувана); (2) міддлвара справді
 * стоїть перед `formData()` обробника: 413 за заголовком і 411 для chunked.
 *
 * Сирі запити йдуть через `node:http`, не `fetch`: undici не дозволяє
 * `Content-Length` понад фактичне тіло, а нам потрібно саме заявити більше й
 * не надсилати його (сервер має відмовити за заголовком, не читаючи тіла).
 */
import http from 'node:http';
import { tsImport } from 'tsx/esm/api';
import { PNG } from './avatar.mjs';
import { reviewByTitle } from './admin-content-sql.mjs';
import { sql } from './sql.mjs';
import { joinPrimaryPath } from './product-address.mjs';

// Константи ядра беруться з джерела, а не копіюються: стеля виводиться з них.
// `tsImport` із `tsx/esm/api` — без залежності від type-stripping Node (на відміну
// від `owner-invite.mts`, що запускається самим бінарем `tsx`).
const { MAX_REQUEST_BODY_BYTES, MAX_REVIEW_IMAGE_BYTES } = await tsImport(
  '../../packages/simplycms/src/domain/media.ts',
  import.meta.url,
);

/** Сирий POST: статус і тіло відповіді; `chunked` — без Content-Length. */
function rawPost(base, path, { headers, chunk }) {
  const url = new URL(base);
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: url.hostname,
        port: url.port,
        path,
        method: 'POST',
        headers: { origin: base, ...headers },
      },
      (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (d) => (body += d));
        res.on('end', () => resolve({ status: res.statusCode, body }));
      },
    );
    req.on('error', reject);
    req.flushHeaders();
    if (chunk) req.write(chunk);
    if (chunk) req.end();
    // Сервер відмовляє за заголовками; тіло, що лишилось, не надсилаємо.
    else setTimeout(() => req.destroy(), 3000).unref();
  });
}

export async function bodyLimitPart({ pages, base, dbUrl, check, st }) {
  const page = pages.buyer;
  // Інший товар: на перший покупець уже залишив відгук (унікальність).
  const [other] = await sql(
    dbUrl,
    `select up.path as slug, s.slug as section from public.products p
       ${joinPrimaryPath()}
       join public.sections s on s.id = p.section_id
      where p.is_active = true and p.id <> $1 order by up.path limit 1`,
    [st.productId],
  );
  const title = `Е6д-2 стеля ${Date.now().toString(36)}`;
  await page.goto(`${base}/${other.slug}`, {
    waitUntil: 'networkidle',
  });
  await page.getByRole('button', { name: 'Написати відгук' }).click();
  await page.locator('form [role="group"] button').nth(4).click();
  await page.locator('#review-title').fill(title);
  await page.locator('#review-content').fill('Е6д-2: п’ять великих фото');
  const size = MAX_REVIEW_IMAGE_BYTES - 1024;
  const file = (i) => ({
    name: `big-${i}.png`,
    mimeType: 'image/png',
    // Сигнатура PNG + нулі: сервер звіряє магічні байти, не декодує піксели.
    buffer: Buffer.concat([PNG, Buffer.alloc(size - PNG.length)]),
  });
  await page.setInputFiles(
    '[data-testid="review-images-input"]',
    [0, 1, 2, 3, 4].map(file),
  );
  const posted = page.waitForResponse(
    (r) =>
      r.request().method() === 'POST' &&
      new URL(r.url()).pathname.startsWith('/_serverFn/'),
    { timeout: 60_000 },
  );
  await page.getByRole('button', { name: 'Надіслати відгук' }).click();
  const res = await posted;
  const fnPath = new URL(res.url()).pathname;
  let row = null;
  for (let i = 0; i < 30 && !row; i++) {
    row = await reviewByTitle(dbUrl, title);
    if (!row) await new Promise((r) => setTimeout(r, 500));
  }
  st.bigReviewId = row?.id ?? null;
  check(
    'стеля тіла: відгук із 5 файлами по MAX-1 КБ проходить (запас достатній)',
    res.status() === 200 &&
      Array.isArray(row?.images) &&
      row.images.length === 5,
    `${res.status()} images=${row?.images?.length ?? '—'}`,
  );

  const over = String(MAX_REQUEST_BODY_BYTES + 1);
  const big = await rawPost(base, fnPath, {
    headers: {
      'content-type': 'multipart/form-data; boundary=x',
      'content-length': over,
    },
  });
  check(
    'стеля тіла: multipart із Content-Length понад стелю → 413 до читання тіла',
    big.status === 413 && big.body === 'request/payload-too-large',
    `${big.status} ${big.body}`,
  );
  const json = await rawPost(base, fnPath, {
    headers: { 'content-type': 'application/json', 'content-length': over },
  });
  check(
    'стеля тіла: JSON із Content-Length понад стелю → 413',
    json.status === 413,
    String(json.status),
  );
  const chunked = await rawPost(base, fnPath, {
    headers: { 'content-type': 'multipart/form-data; boundary=x' },
    chunk: '--x--\r\n',
  });
  check(
    'стеля тіла: chunked multipart без Content-Length → 411',
    chunked.status === 411 && chunked.body === 'request/length-required',
    `${chunked.status} ${chunked.body}`,
  );
}
