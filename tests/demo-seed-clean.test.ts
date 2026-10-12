import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Демо-сід — продуктові дані КОЖНОГО магазину (власник бачить їх в адмінці, агент копіює як зразок
 * контенту). Брудної розмітки там бути не може. Проба санітайзера для пілота живе окремим оверлеєм
 * `scripts/pilot-pack/sanitize-probe.sql` (поза пакетом і шаблоном).
 */
const ROOT = join(import.meta.dirname, '..');
const DIRS = [
  'packages/simplycms/migrations/demo',
  'packages/create-simplycms-store/template/db/migrations/demo',
];
const DIRTY = /<script|onerror|javascript:/i;

describe('демо-сід без брудної розмітки', () => {
  it.each(DIRS)('%s', (dir) => {
    const files = readdirSync(join(ROOT, dir), { recursive: true }).map(String);
    expect(files.length).toBeGreaterThan(0);
    for (const file of files.filter((f) => f.endsWith('.sql'))) {
      expect(
        DIRTY.test(readFileSync(join(ROOT, dir, file), 'utf8')),
        `${dir}/${file}: <script|onerror|javascript:`,
      ).toBe(false);
    }
  });
});
