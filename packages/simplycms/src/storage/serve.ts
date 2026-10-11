import { MEDIA_URL_BASE } from 'simplycms/domain/media';
import type { MediaStorageDriver } from './driver';
import { MEDIA_KEY_RE, MIME_BY_EXT } from './keys';
import { getMediaDriver } from './local-fs';

/**
 * Префікс роздачі — ВИВЕДЕНИЙ з `MEDIA_URL_BASE` (рішення Е2-11), а не
 * друга копія того самого рядка: розходження тут ламало б резолв URL
 * (`resolveMediaUrl`) і роздачу (`serveMedia`) мовчки — кожен читав би
 * власну «правду» про базовий шлях.
 */
const PREFIX = `${MEDIA_URL_BASE.replace(/\/+$/, '')}/`;

/**
 * Вердикт перевірки рядка `media` і видимості сутності-власника (Е6д-21).
 * `missing` (рядка немає) і `hidden` (глядач не бачить власника) віддають
 * однаковий 404: 403 підтвердив би існування файлу.
 */
export type MediaServeVerdict = 'missing' | 'hidden' | { personal: boolean };

/** Залежності роздачі: `lookup` інʼєктує маршрут (порт не знає про вітрину). */
export interface ServeMediaDeps {
  lookup: (key: string, request: Request) => Promise<MediaServeVerdict>;
}

/** Одна відповідь «немає» на всі відмови (див. докблок нижче). */
const notFound = (): Response =>
  new Response('Not found', {
    status: 404,
    // 🔴 `no-store`: 404 прихованого файлу (pending-фото) інакше осів би в
    // CDN за URL і віддавався б автору, а після схвалення — усім.
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'no-store',
    },
  });

/** Збій `lookup` (БД недоступна): 500 без деталей, не кешується. */
const serverError = (): Response =>
  new Response('Internal error', {
    status: 500,
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'no-store',
    },
  });

/**
 * GET `/media/<key>` — роздача обʼєктів драйвера сховища.
 *
 * 🔴 Ключ береться з URL і звіряється з `MEDIA_KEY_RE` ДО будь-якого
 * дотику до ФС. Це саме allowlist, а не «санітизація»: спроба почистити
 * рядок від `..` програє кодуванням і нормалізації, а звірка з формою —
 * ні. Другий рубіж — перевірка кореня всередині драйвера (Task 2).
 *
 * 🔴 Усі відмови ВАЛІДАЦІЇ (форма ключа, шлях, відсутній файл, рядка `media`
 * немає, глядач не бачить власника) віддають ОДНАКОВИЙ 404 без деталей і з
 * `no-store`: різні коди чи тексти перетворили б роут на оракул структури
 * сховища. Логу для 404 немає — ендпоінт публічний і неавтентифікований, тож
 * будь-хто наповнив би лог із URL. Єдиний залогований випадок — збій самого
 * `lookup` (БД недоступна): це 500 `no-store` з `console.error`, бо відмову БД
 * не можна видавати за «файла немає» (інакше оператор її не побачить, а
 * кеш закріпив би хибний 404).
 *
 * 🔴 `Content-Type` — з РОЗШИРЕННЯ КЛЮЧА, а не з запиту: ключ згенерував
 * сервер із просніфаного MIME (Task 2), тобто це і є перевірене значення.
 *
 * 🔴 Файл без рядка `media` не роздається (Е6д-21): `lookup` читає рядок і
 * перевіряє видимість власника, бо між COMMIT видалення і стиранням файлу
 * (outbox) обʼєкт ще живий, а фото відгуку на модерації не публічне. Це
 * один індексований SELECT на запит — ціна за те, що «видалене/приховане»
 * справді зникає, а не лишається доступним за прямим URL.
 *
 * 🔴 Кеш залежить від вердикту: публічні файли — `immutable` (ключі
 * іммутабельні, Е2-8: новий файл — новий ключ), персональні —
 * `private, no-cache`, щоб спільний кеш не пережив зміну видимості.
 *
 * 🔴 304 на `If-None-Match` віддається ПІСЛЯ `lookup`: ключ незмінний, тож
 * `etag` — сильний валідатор, але персональний файл ревалідується з
 * перевіркою видимості, а не повним перезавантаженням. Прихований файл дає
 * 404, не 304.
 */
export async function serveMedia(
  ctx: { request: Request },
  deps: ServeMediaDeps,
  driver: MediaStorageDriver = getMediaDriver(),
): Promise<Response> {
  const { pathname } = new URL(ctx.request.url);
  // 🔴 HEAD обслуговується ЦИМ САМИМ хендлером, але без тіла.
  //
  // Механізм (`createStartHandler`): Start 1.169.x робить
  //   HEAD ? handlers.HEAD ?? handlers.GET ?? handlers.ANY
  //        : handlers[METHOD] ?? handlers.ANY
  // тобто сам падає з HEAD на GET. Але 1.167.x мав простий lookup
  // `handlers[METHOD] ?? handlers.ANY` без виведення HEAD: незареєстрований
  // HEAD ішов у SSR і віддавав `text/html` на URL картинки. Магазин тягне
  // Start за peer `^1`, тож явний HEAD — захист від версії, а не надмірність.
  //
  // 🔴 Чому це фікс, а не документована межа: на цих URL стоїть
  // `Cache-Control: …, immutable`, а `immutable` означає, що клієнт НЕ
  // ревалідує взагалі — навіть примусове перезавантаження не питає сервер.
  // Зіпсований запис не лікується ні на CDN, ні в браузері, який його
  // одержав; єдиний вихід — зміна URL, а він у нас іммутабельний за
  // побудовою. Дефект на три рядки з НЕОБОРОТНИМ наслідком.
  //
  // 🔴 `ANY` (той самий lookup `handlers[METHOD] ?? handlers.ANY`) — один
  // хендлер на всі методи — тут помилка, хоч і коротша: роздача публічна й неавтентифікована, і роут
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

  let verdict: MediaServeVerdict;
  try {
    verdict = await deps.lookup(key, ctx.request);
  } catch (error) {
    // Не ковтаємо мовчки: інакше відмову БД не відрізнити від «файла немає».
    console.error(`[simplycms] media lookup failed: ${key}`, error);
    return serverError();
  }
  if (verdict === 'missing' || verdict === 'hidden') return notFound();

  const etag = `"${key}"`;
  const cacheControl = verdict.personal
    ? 'private, no-cache'
    : 'public, max-age=31536000, immutable';
  const ifNoneMatch = ctx.request.headers.get('if-none-match');
  if (
    ifNoneMatch?.split(',').some((t) => t.trim() === etag || t.trim() === '*')
  ) {
    return new Response(null, {
      status: 304,
      headers: { etag, 'cache-control': cacheControl },
    });
  }

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
      'cache-control': cacheControl,
      etag,
      'x-content-type-options': 'nosniff',
    },
  });
}
