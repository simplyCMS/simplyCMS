#!/usr/bin/env node
/**
 * Накат оверлеїв-проб пілота на його БД: санітайзер (`sanitize-probe.sql`) і сервісний
 * запис із токеном для `/api/v1` (`api-probe.mjs`).
 * Використання: `node scripts/pilot-pack/apply-probe.mjs <адмін-DSN бази з демо-сідом>`.
 * Для ручного `pnpm pilot` проти власної демо-БД — те саме (без оверлею крок Gate B червоніє).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';
import { applyApiProbe } from './api-probe.mjs';

export const PROBE_SQL = join(import.meta.dirname, 'sanitize-probe.sql');

/** @param {string} connectionString адміністративний DSN бази пілота */
export async function applyProbe(connectionString) {
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    const result = await client.query(readFileSync(PROBE_SQL, 'utf8'));
    if (result.rowCount !== 1)
      throw new Error(
        'Оверлей-проба не знайшов товар invertor-merezhevyi-5kw: БД не з демо-сідом (pnpm db:demo)',
      );
    // Сервісний запис і токен для Gate B (`/api/v1`): окремий модуль, бо це не SQL-оверлей.
    await applyApiProbe(client);
  } finally {
    await client.end();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const url = process.argv[2];
  if (!url) throw new Error('Потрібен DSN: apply-probe.mjs <url>');
  await applyProbe(url);
  console.log('[pilot] оверлей sanitize-probe накочено');
}
