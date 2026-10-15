#!/usr/bin/env node
/**
 * Гейт `test:schema` (реліз і `pnpm gates`) — `pnpm test:schema` проти повного харнеса.
 *
 * 🔴 З 1.0 він обов'язковий (Е8-В3): реліз обіцяє, що магазин із даними переживе
 * наступну версію, а доводить це лише схемний контур (накат канону через журнал,
 * `upgrade-1x`, RLS). Контрактні набори драйверів (проєкти `storage` і `mail`)
 * потребують Garage і Mailpit, тож харнес піднімається цілим: `pnpm harness:up`
 * ідемпотентний (Postgres, Garage, Mailpit). Docker на машині релізу — вимога.
 * Харнес після гейта лишається піднятим (`pnpm harness:down` прибирає його).
 */
import { execSync } from 'node:child_process';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '../..');
const run = (cmd) =>
  execSync(cmd, {
    cwd: ROOT,
    stdio: 'inherit',
    maxBuffer: 64 * 1024 * 1024,
  });

try {
  run('pnpm harness:up');
} catch {
  throw new Error(
    'Не вдалося підняти харнес (`pnpm harness:up`): Docker потрібен гейту `test:schema`.',
  );
}
run('pnpm test:schema');
