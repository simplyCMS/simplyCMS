#!/usr/bin/env node
// `pnpm api:snapshot`: перегенерує packages/simplycms/api/openapi.core.json.
// Знімок пише сам тест рівності (він і є єдиним генератором), щоб файл не міг
// розійтися з тим, що перевіряється: окремий скрипт-копія `buildOpenApi` дав би
// другу реалізацію. Запуск — vitest з UPDATE_API_SNAPSHOT=1.
import { spawnSync } from 'node:child_process';

const run = spawnSync(
  'pnpm',
  [
    'exec',
    'vitest',
    'run',
    'packages/simplycms/src/admin-server/impl/__tests__/openapi-snapshot.test.ts',
  ],
  { stdio: 'inherit', env: { ...process.env, UPDATE_API_SNAPSHOT: '1' } },
);
if (run.status !== 0) process.exit(run.status ?? 1);
// Знімок комітиться у форматі Prettier (гейт format:check), тож форматуємо одразу.
const fmt = spawnSync(
  'pnpm',
  ['exec', 'prettier', '--write', 'packages/simplycms/api/openapi.core.json'],
  { stdio: 'inherit' },
);
process.exit(fmt.status ?? 1);
