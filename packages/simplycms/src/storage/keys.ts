import { randomUUID } from 'node:crypto';
import { ACCEPTED_IMAGE_MIME } from 'simplycms/domain/media';

/**
 * MIME, які приймає порт.
 *
 * 🔴 Виводиться з `ACCEPTED_IMAGE_MIME` (T1), а не перелічується вдруге:
 * той самий список у двох місцях розійшовся б на першому ж новому форматі.
 */
export type MediaMime = (typeof ACCEPTED_IMAGE_MIME)[number];

export const EXT_BY_MIME: Readonly<Record<MediaMime, string>> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
};

/**
 * Ключ обʼєкта: `ab/<uuid>.<ext>`, де `ab` — перші два hex-символи того ж
 * uuid.
 *
 * 🔴 Шард не декорація: без нього тека сховища магазину на десятки тисяч
 * файлів стає плоским каталогом, який деградує і в ФС, і в будь-якому `ls`.
 * Два символи дають 256 тек — достатньо для self-host і дешево.
 *
 * 🔴 Ключ ІММУТАБЕЛЬНИЙ: нове зображення завжди новий ключ. Саме на цьому
 * тримається `Cache-Control: immutable` у роздачі (Task 4) — перезапис
 * ключа зробив би кеш брехливим на роки.
 */
export function mediaKey(mime: MediaMime): string {
  const id = randomUUID();
  return `${id.slice(0, 2)}/${id}.${EXT_BY_MIME[mime]}`;
}

/**
 * Форма ключа — саме як РЕГЕКС, а не як `path.normalize`: сюди приходить
 * рядок із URL, і єдиний безпечний спосіб — не «почистити» його, а звірити
 * з шаблоном і відбити все інше. Якорі `^`/`$` тут критичні (без них
 * `\n`-хвіст пройшов би), тому `$` — саме кінець рядка, а не кінець рядка
 * тексту: прапорця `m` у виразі немає.
 *
 * 🔴 Альтернація розширень ВИВОДИТЬСЯ з `EXT_BY_MIME` (рішення Е2-11), а не
 * пишеться третім літералом: новий формат, доданий лише в
 * `ACCEPTED_IMAGE_MIME`+`EXT_BY_MIME`, інакше пройшов би завантаження й
 * запис у БД, а роздача `/media/<key>` віддавала б 404 назавжди — і жоден
 * тест цього б не спіймав, бо регекс мовчки лишався б старим.
 */
const EXTENSIONS_ALTERNATION = Object.values(EXT_BY_MIME)
  .map((ext) => ext.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  .join('|');

export const MEDIA_KEY_RE = new RegExp(
  `^[0-9a-f]{2}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.(?:${EXTENSIONS_ALTERNATION})$`,
);

/**
 * MIME за розширенням ключа — для заголовка роздачі (Task 4).
 *
 * 🔴 ВИВОДИТЬСЯ з `EXT_BY_MIME`, а не пишеться другою таблицею. Дві
 * літеральні мапи, що мусять лишатись взаємно оберненими, — класичний
 * дрейф: додати формат в одну й забути в другій нічого не ламає одразу,
 * а виявляється тим, що роздача віддає готовий файл із 404. Стереже
 * юніт «таблиці взаємно обернені».
 */
export const MIME_BY_EXT: Readonly<Record<string, MediaMime>> =
  Object.fromEntries(
    Object.entries(EXT_BY_MIME).map(([mime, ext]) => [ext, mime as MediaMime]),
  );
