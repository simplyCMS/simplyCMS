import { redactUrls } from 'simplycms/env';

/** Одна відповідь «немає» на всі відмови (див. докблок `serveMedia`). */
export const notFound = (): Response =>
  new Response('Not found', {
    status: 404,
    // 🔴 `no-store`: 404 прихованого файлу (pending-фото) інакше осів би в
    // CDN за URL і віддавався б автору, а після схвалення — усім.
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'no-store',
    },
  });

/** Сховище тимчасово недоступне: клієнт і CDN не мусять запамʼятовувати це як «файла немає». */
export const unavailable = (): Response =>
  new Response('Service unavailable', {
    status: 503,
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'no-store',
    },
  });

/** Збій `lookup` (БД недоступна): 500 без деталей, не кешується. */
export const serverError = (): Response =>
  new Response('Internal error', {
    status: 500,
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'no-store',
    },
  });

/**
 * Опис помилки драйвера для логу: `імʼя[код]: повідомлення`, де в повідомленні
 * все, що схоже на `scheme://userinfo@`, замасковано повністю (`scheme://***@`).
 * Маскується весь userinfo, а не лише пароль: імʼя користувача — теж
 * ідентифікатор ключа доступу (AKID).
 */
export function describeDriverError(error: unknown): string {
  if (!(error instanceof Error)) return 'unknown';
  const code = (error as { code?: unknown }).code;
  const head = typeof code === 'string' ? `${error.name}[${code}]` : error.name;
  return `${head}: ${redactUrls(error.message)}`;
}
