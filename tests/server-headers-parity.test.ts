/**
 * Парність переліку заголовків безпеки (Р27): `server.mjs` ядро не імпортує
 * (Е8-Р7′) і тримає копію в `server-headers.mjs`; ядро — джерело
 * (`simplycms/server-guard`). Розбіжність дала б різні заголовки на статиці й
 * на SSR. Зразок — `STRIPPED_ENV` ↔ `start-core` (`tests/start-core.test.ts`).
 */
import { describe, expect, it } from 'vitest';
import {
  HSTS_HEADER,
  SECURITY_HEADERS,
  securityHeaders,
} from 'simplycms/server-guard';
import * as runner from '../server-headers.mjs';

describe('server-headers.mjs ↔ simplycms/server-guard', () => {
  it('базовий перелік однаковий (імена, значення, порядок)', () => {
    expect(runner.SECURITY_HEADERS).toEqual(SECURITY_HEADERS);
  });

  it('HSTS однаковий', () => {
    expect(runner.HSTS_HEADER).toEqual(HSTS_HEADER);
  });

  it.each([
    ['https://shop.test', true],
    ['http://shop.test', false],
  ])('набір для %s однаковий, HSTS=%s', (site, hsts) => {
    const fromRunner = runner.securityHeaders(new URL(site).origin);
    expect(fromRunner).toEqual(Object.fromEntries(securityHeaders(site)));
    expect('Strict-Transport-Security' in fromRunner).toBe(hsts);
  });
});
