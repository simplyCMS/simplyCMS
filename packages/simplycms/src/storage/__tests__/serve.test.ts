import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { localFsDriver } from '../local-fs';
import { serveMedia, type MediaServeVerdict } from '../serve';

const KEY = 'ab/ab000000-0000-4000-8000-000000000000.png';
const PNG = Uint8Array.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 7, 7, 7, 7,
]);

describe('serveMedia', () => {
  let root: string;
  let driver: ReturnType<typeof localFsDriver>;
  let verdict: MediaServeVerdict = { personal: false };
  const lookup = async () => verdict;
  const get = (path: string, init?: RequestInit) =>
    serveMedia(
      { request: new Request(`http://localhost${path}`, init) },
      { lookup },
      driver,
    );
  const openSpy = () => {
    const open = driver.open.bind(driver);
    let calls = 0;
    driver.open = async (key) => {
      calls += 1;
      return open(key);
    };
    return () => calls;
  };

  beforeEach(async () => {
    verdict = { personal: false };
    root = await mkdtemp(join(tmpdir(), 'simplycms-serve-'));
    driver = localFsDriver(root);
    await driver.put(KEY, PNG);
  });
  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('віддає байти з правильним Content-Type', async () => {
    const response = await get(`/media/${KEY}`);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/png');
    expect(response.headers.get('content-length')).toBe(String(PNG.length));
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(PNG);
  });

  // 🔴 Без nosniff браузер сам вирішує, чим є вміст, — і виконує те, що
  // «схоже на HTML». Це другий рубіж після заборони SVG на upload.
  it('ставить nosniff та іммутабельний кеш', async () => {
    const response = await get(`/media/${KEY}`);
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(response.headers.get('cache-control')).toBe(
      'public, max-age=31536000, immutable',
    );
    expect(response.headers.get('etag')).toBe(`"${KEY}"`);
  });

  // 🔴 HEAD окремим кейсом: Start не виводить його з GET, і без явної
  // реєстрації запит віддає HTML замість заголовків файлу — те, що кешують
  // CDN і проксі.
  it('HEAD віддає ті самі заголовки без тіла', async () => {
    const response = await get(`/media/${KEY}`, { method: 'HEAD' });
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/png');
    expect(response.headers.get('content-length')).toBe(String(PNG.length));
    expect(response.body).toBeNull();
  });

  it('404 на відсутній ключ правильної форми', async () => {
    const response = await get(
      '/media/cd/cd000000-0000-4000-8000-000000000000.png',
    );
    expect(response.status).toBe(404);
  });

  it.each([
    '/media/../../etc/passwd',
    '/media/ab/../../../etc/passwd',
    '/media/ab/ab000000-0000-4000-8000-000000000000.svg',
    '/media/',
    '/media/ab',
  ])('404 на неприпустимий ключ: %s', async (path) => {
    const response = await get(path);
    expect(response.status).toBe(404);
  });

  // 🔴 ДИСКРИМІНУЮЧИЙ кейс гарда форми — єдиний, що падає саме на
  // `MEDIA_KEY_RE`. Файл існує, лежить під коренем сховища і має дозволене
  // розширення, тож усі інші рубежі його пропускають: `new URL()` тут нічого
  // не нормалізує, `MIME_BY_EXT['png']` є, драйвер віддає обʼєкт. Без звірки
  // з формою роздача віддала б 200 на файл, якого порт не створював.
  //
  // 🔴 Саме цей рубіж поїде в драйвер S3 (К4), де перевірки кореня ФС —
  // другого рубежа — не буде взагалі.
  it('404 на ключ поза формою, який РЕАЛЬНО існує під коренем', async () => {
    await writeFile(join(root, 'ab', 'plain.png'), PNG);
    const response = await get('/media/ab/plain.png');
    expect(response.status).toBe(404);
  });

  // 🔴 Кодований traversal — окремий кейс: `%2e%2e` доходить до хендлера
  // вже розкодованим, тож перевірка мусить стояти ПІСЛЯ декодування.
  it('404 на traversal у процентному кодуванні', async () => {
    const response = await get('/media/%2e%2e%2f%2e%2e%2fetc%2fpasswd');
    expect(response.status).toBe(404);
  });

  it('тіло 404 не називає ні шляху, ні кореня сховища', async () => {
    const response = await get('/media/../../etc/passwd');
    const body = await response.text();
    expect(body).not.toContain(root);
    expect(body).not.toContain('etc/passwd');
  });

  // Е6д-21: рядок `media` і видимість перевіряє `lookup`, а не роут.
  it.each(['missing', 'hidden'] as const)(
    "вердикт '%s' → 404 і драйвер не відкривали",
    async (v) => {
      verdict = v;
      const calls = openSpy();
      const response = await get(`/media/${KEY}`);
      expect(response.status).toBe(404);
      expect(calls()).toBe(0);
    },
  );

  it('персональний файл — private, no-cache', async () => {
    verdict = { personal: true };
    const response = await get(`/media/${KEY}`);
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-cache');
  });

  it('If-None-Match зі збігом при видимому файлі → 304 без driver.open', async () => {
    const calls = openSpy();
    const response = await get(`/media/${KEY}`, {
      headers: { 'if-none-match': `"${KEY}"` },
    });
    expect(response.status).toBe(304);
    expect(response.body).toBeNull();
    expect(calls()).toBe(0);
  });

  // 🔴 304 не можна віддавати до lookup: прихований файл підтвердив би себе.
  it('If-None-Match при hidden → 404, не 304', async () => {
    verdict = 'hidden';
    const response = await get(`/media/${KEY}`, {
      headers: { 'if-none-match': `"${KEY}"` },
    });
    expect(response.status).toBe(404);
  });
});
