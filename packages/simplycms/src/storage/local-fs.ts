import { randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { link, mkdir, rm, stat, unlink, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import { Readable } from 'node:stream';

import {
  MediaKeyCollisionError,
  MediaKeyError,
  type MediaObject,
  type MediaStorageDriver,
} from './driver';
import { mediaRoot } from './env';

/** Код помилки Node (`fs` кидає `Error` із полем `code`). */
const codeOf = (error: unknown): string | undefined =>
  typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code: unknown }).code)
    : undefined;

/**
 * Драйвер диска — дефолт self-host (B4).
 *
 * 🔴 Запис: тимчасовий файл → `link()` → прибирання тимчасового. Саме
 * `link`, а не `rename`: `rename` атомарний, але МОВЧКИ перезаписує ціль,
 * а нам потрібні обидві властивості одразу — і атомарна публікація
 * (частково записаний файл не видно роуту роздачі), і виключність
 * (іммутабельний ключ, рішення Е2-8). `link` дає обидві: він падає з
 * `EEXIST`, якщо ціль є, і публікує повністю записаний вміст одним кроком.
 * Тимчасовий файл лежить у ТІЙ САМІЙ шард-теці — `link` не працює через
 * межу файлової системи.
 */
export function localFsDriver(root: string = mediaRoot()): MediaStorageDriver {
  const base = resolve(root);

  const pathFor = (key: string): string => {
    // 🔴 `resolve` спершу, перевірка ПОТІМ: перевіряти сирий рядок марно —
    // `ab/../../x` виглядає невинно, доки його не нормалізувати.
    const target = resolve(base, key);
    if (target !== base && !target.startsWith(base + sep))
      throw new MediaKeyError(key);
    if (target === base) throw new MediaKeyError(key);
    return target;
  };

  return {
    async put(key, bytes) {
      const target = pathFor(key);
      const shard = dirname(target);
      await mkdir(shard, { recursive: true });
      // 🔴 Імʼя тимчасового файлу НЕ МАЄ матчити `MEDIA_KEY_RE`: інакше
      // частково записаний файл віддавався б роутом роздачі як валідний
      // обʼєкт. Префікс `.tmp-` виводить його з-під регексу і за розширенням
      // (його немає з дозволених), і за початковою крапкою.
      const tmp = join(shard, `.tmp-${randomUUID()}`);
      await writeFile(tmp, bytes, { flag: 'wx' });
      try {
        await link(tmp, target);
      } catch (error) {
        if (codeOf(error) === 'EEXIST') throw new MediaKeyCollisionError(key);
        throw error;
      } finally {
        // 🔴 Прибирання best-effort: обʼєкт уже опублікований `link`-ом, тож
        // невдалий `unlink` нічого не ламає. Названа межа Е2: падіння процесу
        // МІЖ `link` і `unlink` лишає сироту `.tmp-*` — її змітає sweep К4,
        // а роздача її не віддасть (імʼя поза `MEDIA_KEY_RE`).
        await rm(tmp, { force: true }).catch(() => undefined);
      }
    },

    async delete(key) {
      const target = pathFor(key);
      try {
        await unlink(target);
      } catch (error) {
        // 🔴 ENOENT = успіх: видалення ідемпотентне, інакше повтор після
        // невдалого видалення рядка `media` (рішення Е2-7) падав би вічно.
        if (codeOf(error) !== 'ENOENT') throw error;
      }
    },

    async open(key): Promise<MediaObject | null> {
      const target = pathFor(key);
      let size: number;
      try {
        const info = await stat(target);
        if (!info.isFile()) return null;
        size = info.size;
      } catch (error) {
        if (codeOf(error) === 'ENOENT') return null;
        throw error;
      }
      return {
        size,
        stream: () =>
          Readable.toWeb(
            createReadStream(target),
          ) as ReadableStream<Uint8Array>,
      };
    },
  };
}

let cached: MediaStorageDriver | null = null;

/**
 * Дефолтний драйвер магазину. Мемоізований — але саме тут, а не в
 * модуль-рівневому `const`: інстанс створюється при ПЕРШОМУ виклику, коли
 * `process.env.MEDIA_ROOT` уже наповнено (`server.mjs` робить це перед
 * динамічним імпортом хендлера).
 */
export function getMediaDriver(): MediaStorageDriver {
  cached ??= localFsDriver();
  return cached;
}

export { MediaKeyCollisionError, MediaKeyError };
