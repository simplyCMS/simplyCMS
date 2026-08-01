#!/usr/bin/env node

/**
 * Перегенерація `supabase/seed.sql` із фікстур пілота.
 *
 * Правити SQL руками не можна: джерело правди — фікстури
 * (`scripts/pilot-pack/seed-fixtures.mjs`), а `tests/pilot-seed.test.ts`
 * червоніє, щойно файл розійдеться з рендером.
 *
 * Використання: node scripts/pilot-seed.mjs
 */

import { writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { renderSeedSql } from './pilot-pack/seed-sql.mjs';

const SEED_PATH = join(resolve(import.meta.dirname, '..'), 'supabase/seed.sql');

writeFileSync(SEED_PATH, renderSeedSql(), 'utf8');
console.log(`[pilot-seed] записано ${SEED_PATH}`);
