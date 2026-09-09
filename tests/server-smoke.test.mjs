/**
 * Смок production-runner-а `server.mjs` — файла, яким магазин реально
 * стартує (`pnpm start`) і якого до 2026-08-21 не ВИКОНУВАВ жоден гейт.
 *
 * Посилалися на нього лише ті контури, що в CI не ганяються: пілот
 * (`scripts/pilot-pack/{build,gate-b}.mjs` — потребує живої БД) і два тести,
 * які читають його як ТЕКСТ (`create-store-invite-setup`, `cli-update`).
 * `playwright.config.ts` піднімає `vite dev`, а `server-runtime.test.mjs`
 * покриває лише сусідній модуль конвертації. Тобто ані цикл наповнення env,
 * ані гілка `sirv`, ані 500-хендлер не виконувалися ніде.
 *
 * Тут вони виконуються — на справжньому `server.mjs`, але поверх заглушки
 * fetch-handler-а (`tests/server-smoke/sandbox.mjs`), тож тесту не потрібні
 * ані `pnpm build`, ані Supabase, ані мережа. Що лишається за цим гейтом:
 * рендер реального `dist/server/server.js` — це Gate B пілота.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { startSmokeServer } from './server-smoke/sandbox.mjs';

describe('server.mjs: production-runner піднімається й обслуговує запити', () => {
  let server;

  beforeAll(async () => {
    server = await startSmokeServer();
  }, 30_000);

  afterAll(() => server?.stop());

  it('віддає 200 і HTML на /', async () => {
    const response = await fetch(`${server.baseUrl}/`);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/html');
    await expect(response.text()).resolves.toContain('<!doctype html>');
  });

  it('статика з /assets/* — immutable на рік', async () => {
    const asset = await fetch(`${server.baseUrl}/assets/app-smoke123.js`);

    expect(asset.status).toBe(200);
    expect(asset.headers.get('cache-control')).toBe(
      'public, max-age=31536000, immutable',
    );

    // Контроль умовності гілки: файл поза `/assets/` хеша в імені не має,
    // тож вічний кеш йому не ставиться.
    const favicon = await fetch(`${server.baseUrl}/favicon.ico`);
    expect(favicon.status).toBe(200);
    expect(favicon.headers.get('cache-control') ?? '').not.toContain(
      'immutable',
    );
  });

  it('помилка запиту → 500, процес живий', async () => {
    const boom = await fetch(`${server.baseUrl}/__boom`);

    expect(boom.status).toBe(500);
    await expect(boom.text()).resolves.toBe('Internal Server Error');

    // Наступний запит мусить обслужитися — 500 не валить сервер.
    const after = await fetch(`${server.baseUrl}/`);
    expect(after.status).toBe(200);
  });

  it('env наповнюється лише для ВІДСУТНІХ ключів', async () => {
    const env = await (await fetch(`${server.baseUrl}/__env`)).json();

    expect(env).toEqual({
      // Реальний env процесу б'є обидва файли.
      SMOKE_FROM_PROCESS: 'from-process',
      // `.env.local` читається першим, тож `.env` його не перетирає.
      SMOKE_SHARED: 'from-env-local',
      SMOKE_ONLY_LOCAL: 'from-env-local',
      // Ключ, якого немає ні в процесі, ні в `.env.local`, бере `.env`.
      SMOKE_ONLY_ENV: 'from-env',
    });
  });
});
