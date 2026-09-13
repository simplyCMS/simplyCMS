import type { MediaStorageDriver } from './driver';
import { MEDIA_KEY_RE, MIME_BY_EXT } from './keys';
import { getMediaDriver } from './local-fs';

/** Префікс роздачі — дзеркало `MEDIA_URL_BASE` з `simplycms/domain/media`. */
const PREFIX = '/media/';

/** Одна відповідь «немає» на всі відмови (див. докблок нижче). */
const notFound = (): Response =>
  new Response('Not found', {
    status: 404,
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });

/**
 * GET `/media/<key>` — роздача обʼєктів драйвера сховища.
 *
 * 🔴 Ключ береться з URL і звіряється з `MEDIA_KEY_RE` ДО будь-якого
 * дотику до ФС. Це саме allowlist, а не «санітизація»: спроба почистити
 * рядок від `..` програє кодуванням і нормалізації, а звірка з формою —
 * ні. Другий рубіж — перевірка кореня всередині драйвера (Task 2).
 *
 * 🔴 Усі відмови віддають ОДНАКОВИЙ 404 без деталей: різні коди чи тексти
 * для «форма невірна» / «файла немає» / «шлях за межами» перетворили б
 * роут на оракул структури сховища. Логів тут теж немає — ендпоінт
 * публічний і неавтентифікований, тож будь-хто наповнив би лог із URL.
 *
 * 🔴 `Content-Type` — з РОЗШИРЕННЯ КЛЮЧА, а не з запиту: ключ згенерував
 * сервер із просніфаного MIME (Task 2), тобто це і є перевірене значення.
 * Читати рядок `media` тут було б зайвим походом у БД на кожну картинку.
 *
 * 🔴 `immutable`-кеш законний лише тому, що ключі іммутабельні (Е2-8):
 * новий файл — новий ключ, тож «протухлої» відповіді не існує. Після
 * видалення обʼєкта браузер і CDN можуть ще тримати копію — це прийнятно,
 * бо референс на неї вже зник із рядка сутності.
 */
export async function serveMedia(
  ctx: { request: Request },
  driver: MediaStorageDriver = getMediaDriver(),
): Promise<Response> {
  const { pathname } = new URL(ctx.request.url);
  // 🔴 HEAD обслуговується ЦИМ САМИМ хендлером, але без тіла.
  //
  // Механізм, дослівно (`createStartHandler.js:374`):
  //   handlers[request.method.toUpperCase()] ?? handlers['ANY']
  // Простий lookup по імені методу — виведення HEAD із GET там відсутнє за
  // побудовою. Незареєстрований HEAD дає `undefined`, запит іде далі по
  // ланцюгу й потрапляє в SSR, тобто віддає `text/html` на URL картинки.
  //
  // 🔴 Чому це фікс, а не документована межа: на цих URL стоїть
  // `Cache-Control: …, immutable`, а `immutable` означає, що клієнт НЕ
  // ревалідує взагалі — навіть примусове перезавантаження не питає сервер.
  // Зіпсований запис не лікується ні на CDN, ні в браузері, який його
  // одержав; єдиний вихід — зміна URL, а він у нас іммутабельний за
  // побудовою. Дефект на три рядки з НЕОБОРОТНИМ наслідком.
  //
  // 🔴 `ANY` (той самий рядок 374) — один хендлер на всі методи — тут
  // помилка, хоч і коротша: роздача публічна й неавтентифікована, і роут
  // почав би відповідати на POST/PUT/DELETE. Явний `HEAD:` лишає allowlist
  // методів закритим. Не «спрощувати».
  //
  // 🔴 `null`-тіло переживає Node-runner: `server-runtime.mjs:87-89` має
  // явну гілку `if (!response.body) { res.end(); return; }` — перевірено,
  // бо `Readable.fromWeb(null)` тут падав би.
  const bodyless = ctx.request.method === 'HEAD';
  if (!pathname.startsWith(PREFIX)) return notFound();

  let key: string;
  try {
    key = decodeURIComponent(pathname.slice(PREFIX.length));
  } catch {
    // Биті escape-послідовності — теж «немає».
    return notFound();
  }
  if (!MEDIA_KEY_RE.test(key)) return notFound();

  const ext = key.slice(key.lastIndexOf('.') + 1);
  const contentType = MIME_BY_EXT[ext];
  if (!contentType) return notFound();

  let object;
  try {
    object = await driver.open(key);
  } catch {
    return notFound();
  }
  if (!object) return notFound();

  return new Response(bodyless ? null : object.stream(), {
    status: 200,
    headers: {
      'content-type': contentType,
      'content-length': String(object.size),
      'cache-control': 'public, max-age=31536000, immutable',
      etag: `"${key}"`,
      'x-content-type-options': 'nosniff',
    },
  });
}
