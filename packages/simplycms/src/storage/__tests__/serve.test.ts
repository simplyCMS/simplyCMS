import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { localFsDriver } from '../local-fs';
import { serveMedia } from '../serve';

const KEY = 'ab/ab000000-0000-4000-8000-000000000000.png';
const PNG = Uint8Array.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 7, 7, 7, 7,
]);

describe('serveMedia', () => {
  let root: string;
  let driver: ReturnType<typeof localFsDriver>;
  const get = (path: string) =>
    serveMedia({ request: new Request(`http://localhost${path}`) }, driver);

  beforeEach(async () => {
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
    const response = await serveMedia(
      {
        request: new Request(`http://localhost/media/${KEY}`, {
          method: 'HEAD',
        }),
      },
      driver,
    );
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
});
