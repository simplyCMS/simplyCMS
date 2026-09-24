/**
 * Крок аватара — ЄДИНИЙ живий доказ порту сховища (етап К3-Е2).
 *
 * 🔴 Тести цього не доводять і не можуть: у них немає ні реального
 * multipart-тіла, ні реальної файлової системи сервера, ні роздачі роутом.
 * Тут проходить увесь ланцюг: браузер → serverFn → файл на диску →
 * `/media/<key>` → `<img>` — і те, що в колонці профілю лежить РЕФЕРЕНС,
 * а не URL (рішення Е2-1), перевіряється прямим SQL.
 *
 * Виклик — після `register`, поки покупець залогінений.
 */
import { sql } from './sql.mjs';

/**
 * Найменший валідний PNG: сигнатура + IHDR + мінімальний IDAT. Експортовано
 * (К3-Е3): той самий буфер бере `admin-catalog.mjs` для завантаження
 * зображення товару — окремого маленького PNG для другого споживача не
 * заводимо.
 */
export const PNG = Buffer.from(
  '89504e470d0a1a0a0000000d4948445200000001000000010806000000' +
    '1f15c4890000000a49444154789c6300010000050001',
  'hex',
);

export async function runAvatarStep({ page, base, dbUrl, check }) {
  await page.goto(`${base}/profile/settings`, { waitUntil: 'networkidle' });
  await page.setInputFiles('[data-testid="avatar-file-input"]', {
    name: 'avatar.png',
    mimeType: 'image/png',
    buffer: PNG,
  });

  const src = await page
    .locator('img[src^="/media/"]')
    .first()
    .getAttribute('src', { timeout: 10_000 });
  check('аватар: <img> отримав /media-URL', Boolean(src), src ?? '—');

  const served = await page.request.get(`${base}${src}`);
  const headers = served.headers();
  check(
    'аватар: роздача — 200 image/png із nosniff та immutable',
    served.status() === 200 &&
      headers['content-type'] === 'image/png' &&
      headers['x-content-type-options'] === 'nosniff' &&
      (headers['cache-control'] ?? '').includes('immutable'),
    `${served.status()} ${headers['content-type']} ${headers['cache-control']}`,
  );

  const [profile] = await sql(
    dbUrl,
    `select avatar_url from public.profiles where avatar_url is not null limit 1`,
  );
  const ref = profile?.avatar_url ?? '';
  check(
    'аватар: у profiles.avatar_url РЕФЕРЕНС, не URL',
    /^[0-9a-f]{2}\/[0-9a-f-]{36}\.png$/.test(ref),
    ref || '—',
  );
  check(
    'аватар: URL = база + референс',
    src === `/media/${ref}`,
    `${src} vs /media/${ref}`,
  );

  const [row] = await sql(
    dbUrl,
    `select storage_key, size_bytes, mime_type
       from public.media where entity_type = 'avatar'`,
  );
  check(
    'аватар: рядок media несе фактичний розмір і MIME',
    row?.storage_key === ref &&
      row?.size_bytes === PNG.length &&
      row?.mime_type === 'image/png',
    `${row?.size_bytes} Б / ${row?.mime_type}`,
  );

  // Видалення — друга половина інваріанта Е2-7: спершу рядок, потім обʼєкт.
  await page.getByRole('button', { name: 'Видалити фото' }).click();
  await page.waitForFunction(
    () => !document.querySelector('img[src^="/media/"]'),
    undefined,
    { timeout: 10_000 },
  );
  const gone = await page.request.get(`${base}/media/${ref}`);
  const [left] = await sql(
    dbUrl,
    `select count(*)::int as n from public.media where storage_key = $1`,
    [ref],
  );
  check(
    'аватар: видалення прибрало і обʼєкт, і рядок',
    gone.status() === 404 && left.n === 0,
    `GET ${gone.status()}, рядків ${left.n}`,
  );
}
