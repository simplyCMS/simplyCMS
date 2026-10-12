import { resolve } from 'node:path';
import { resolveDriverEnv, type MediaEnv } from 'simplycms/env';
import type { MediaStorageDriver } from './driver';
import { DEFAULT_MEDIA_ROOT } from './env';
import { localFsDriver } from './local-fs';
import { s3Driver } from './s3';

/** Драйвер за вже розвʼязаною групою env (чиста відповідність, без кешу). */
export function selectMediaDriver(media: MediaEnv): MediaStorageDriver {
  if (media.driver === 's3') return s3Driver(media);
  return localFsDriver(
    resolve(process.cwd(), media.root ?? DEFAULT_MEDIA_ROOT),
  );
}

let cached: MediaStorageDriver | null = null;

/**
 * Дефолтний драйвер магазину. Мемоізований — але саме тут, а не в
 * модуль-рівневому `const`: інстанс створюється при ПЕРШОМУ виклику, коли
 * `process.env` уже наповнено (`server.mjs` робить це перед динамічним
 * імпортом хендлера). Часткова група `S3_*` кидає `DriverEnvError` — гучно,
 * а не мовчазний фолбек на диск, що зникне з редеплоєм.
 */
export function getMediaDriver(): MediaStorageDriver {
  cached ??= selectMediaDriver(resolveDriverEnv(process.env).media);
  return cached;
}
