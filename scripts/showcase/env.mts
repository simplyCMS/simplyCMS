/**
 * Env сіду вітрини (С-12, С-13): чим сід підключається і куди пише файли.
 *
 * 🔴 `DATABASE_URL` — під `app_runtime`, як у магазину в проді: RLS і гранти
 * працюють так само, а записи йдуть під `withActor({ role: 'app_admin' })`.
 * Суперюзерне зʼєднання обслуговує лише життєвий цикл бази (`showcase-db`).
 *
 * 🔴 Ядро читає env лише з `process.env` у рантаймі (контракт серверного env),
 * тож сід кладе значення туди ж, а не прокидає власним каналом. Медіа-драйвер
 * — навпаки, явний: `getMediaDriver()` кешується на процес, а гейт засіває
 * дві бази з двома різними медіатеками.
 */
import { randomBytes } from 'node:crypto';
import { resetAuth } from '../../packages/simplycms/src/auth/index.ts';
import {
  localFsDriver,
  type MediaStorageDriver,
} from '../../packages/simplycms/src/storage/index.ts';

/** Адреса магазину для Better Auth і вітрини під час локального запуску. */
export const SHOWCASE_SITE_URL = 'http://localhost:3000';
/** Власник демо-бази (створює наповнення, Task 6). Лише локалка. */
export const SHOWCASE_OWNER_EMAIL = 'owner@showcase.test';
/** 🔴 Фіксований пароль ЛИШЕ для локального стенда; друкується в консоль. */
export const SHOWCASE_OWNER_PASSWORD = 'showcase-owner-2026';

export type ShowcaseEnv = {
  /** Рядок підключення магазину й сіду (`app_runtime`). */
  readonly databaseUrl: string;
  readonly authSecret: string;
  readonly siteUrl: string;
  /** Абсолютний корінь медіатеки — той самий, що отримає `MEDIA_ROOT`. */
  readonly mediaRoot: string;
  /** Драйвер, яким сід пише файли (явний, не кешований синглтон). */
  readonly media: MediaStorageDriver;
};

/** Той самий кластер, інша база й роль у рядку підключення. */
export function runtimeUrl(adminUrl: string, dbName: string): string {
  const url = new URL(adminUrl);
  url.pathname = `/${dbName}`;
  url.username = 'app_runtime';
  url.password = '';
  return url.toString();
}

/** Env нового прогону: секрет щоразу новий — це локальний стенд, не прод. */
export function showcaseEnv(
  adminUrl: string,
  dbName: string,
  mediaRoot: string,
): ShowcaseEnv {
  return {
    databaseUrl: runtimeUrl(adminUrl, dbName),
    authSecret: randomBytes(32).toString('base64url'),
    siteUrl: SHOWCASE_SITE_URL,
    mediaRoot,
    media: localFsDriver(mediaRoot),
  };
}

/**
 * Кладе env у `process.env` і скидає синглтон Better Auth — наступний
 * `getAuth()` збереться вже з цим секретом і базою.
 */
export function applyProcessEnv(env: ShowcaseEnv): void {
  process.env.DATABASE_URL = env.databaseUrl;
  process.env.BETTER_AUTH_SECRET = env.authSecret;
  process.env.BETTER_AUTH_URL = env.siteUrl;
  process.env.VITE_SITE_URL = env.siteUrl;
  process.env.MEDIA_ROOT = env.mediaRoot;
  resetAuth();
}
