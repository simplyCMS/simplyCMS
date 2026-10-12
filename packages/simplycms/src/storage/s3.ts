import { AwsClient } from 'aws4fetch';
import type { MediaEnv } from 'simplycms/env';
import {
  MediaKeyCollisionError,
  MediaKeyError,
  type MediaObject,
  type MediaStorageDriver,
} from './driver';
import { MIME_BY_EXT } from './keys';

type S3Config = Extract<MediaEnv, { driver: 's3' }>;

/**
 * Скільки разів `aws4fetch` повторює запит на 5xx/429/збій мережі. Дефолт
 * бібліотеки — 10 повторів з подвоєнням паузи: збій S3 тримав би запит
 * роздачі хвилинами, а нам треба швидкий 503 (Е8-Р14).
 */
const RETRIES = 2;

/** Сегмент `.`/`..`/порожній у шляху S3 нормалізував би URL — це вихід за межі ключа. */
const isSafeKey = (key: string): boolean =>
  key.length > 0 &&
  key.split('/').every((s) => s !== '' && s !== '.' && s !== '..');

/**
 * Драйвер S3-сумісного сховища (Garage, MinIO, AWS) — другий за контрактом
 * `MediaStorageDriver`, без жодної зміни самого контракту.
 *
 * 🔴 Помилки несуть лише метод і статус: тіло відповіді S3 і підписані
 * заголовки лягають у логи контейнера, а там не місце ключам доступу.
 * 🔴 Клієнт ліниво: конфіг приходить аргументом, але підпис і мережа — при
 * першому зверненні, тож збірка й імпорт нічого не потребують.
 * Path-style: Garage не резолвить піддомени бакетів.
 */
export function s3Driver(cfg: S3Config): MediaStorageDriver {
  let client: AwsClient | undefined;
  const aws = (): AwsClient =>
    (client ??= new AwsClient({
      accessKeyId: cfg.accessKey,
      secretAccessKey: cfg.secretKey,
      region: cfg.region,
      service: 's3',
      retries: RETRIES,
    }));

  const urlFor = (key: string): string => {
    if (!isSafeKey(key)) throw new MediaKeyError(key);
    return `${cfg.endpoint}/${cfg.bucket}/${key
      .split('/')
      .map(encodeURIComponent)
      .join('/')}`;
  };

  const fail = (method: string, status: number): Error =>
    new Error(`S3 ${method} не вдався: ${status}`);

  return {
    async put(key, bytes) {
      const url = urlFor(key);
      // 🔴 Best-effort: `HEAD` → `PUT` не атомарний, дві одночасні публікації
      // одного ключа можуть обидві пройти. Ключ — свіжий UUID викликача, тож
      // гонка можлива лише при його повторному використанні (баг викликача).
      // Garage ігнорує `If-None-Match: *` (UPSTREAM:GARAGE-INM-1), тому
      // перевірка явна; на S3, що заголовок чесно виконує, його 412 теж колізія.
      const head = await aws().fetch(url, { method: 'HEAD' });
      await drain(head);
      if (head.status === 200) throw new MediaKeyCollisionError(key);
      if (head.status !== 404) throw fail('HEAD', head.status);

      const ext = key.slice(key.lastIndexOf('.') + 1);
      const res = await aws().fetch(url, {
        method: 'PUT',
        body: bytes as BodyInit,
        headers: {
          'content-type': MIME_BY_EXT[ext] ?? 'application/octet-stream',
          'if-none-match': '*',
        },
      });
      await drain(res);
      if (res.status === 412) throw new MediaKeyCollisionError(key);
      if (!res.ok) throw fail('PUT', res.status);
    },

    async delete(key) {
      const res = await aws().fetch(urlFor(key), { method: 'DELETE' });
      await drain(res);
      // 🔴 404 = успіх: видалення ідемпотентне (рішення Е2-7), інакше повтор
      // outbox стирання по вже стертому ключу падав би вічно.
      if (!res.ok && res.status !== 404) throw fail('DELETE', res.status);
    },

    async open(key): Promise<MediaObject | null> {
      const url = urlFor(key);
      // `HEAD` дає розмір без відкритого тіла: HEAD-запит роздачі стрім не
      // читає, і відкритий `GET` висів би зʼєднанням. Тіло — окремий `GET` на
      // кожен `stream()`, бо контракт вимагає кілька незалежних стрімів.
      const head = await aws().fetch(url, { method: 'HEAD' });
      await drain(head);
      if (head.status === 404) return null;
      if (!head.ok) throw fail('HEAD', head.status);
      const length = head.headers.get('content-length');
      if (length === null || !/^\d+$/.test(length))
        throw new Error('S3 HEAD не віддав розмір обʼєкта');
      return {
        size: Number(length),
        stream: () => lazyBody(aws, url, fail),
      };
    },
  };
}

/** Стрім, що відкриває `GET` на першому читанні й закриває його на `cancel`. */
function lazyBody(
  aws: () => AwsClient,
  url: string,
  fail: (method: string, status: number) => Error,
): ReadableStream<Uint8Array> {
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (!reader) {
        const res = await aws().fetch(url);
        if (!res.ok || !res.body) {
          await drain(res);
          throw fail('GET', res.status);
        }
        reader = res.body.getReader();
      }
      const { done, value } = await reader.read();
      if (done) controller.close();
      else controller.enqueue(value);
    },
    async cancel(reason) {
      await reader?.cancel(reason);
    },
  });
}

/** Тіло відповіді не читаємо — звільняємо зʼєднання. */
async function drain(res: Response): Promise<void> {
  await res.body?.cancel().catch(() => undefined);
}
