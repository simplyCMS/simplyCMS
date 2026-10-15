import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/** Файл, який пише плагін збірки `simplycms/vite` поруч зі статикою клієнта. */
export const PUBLIC_MANIFEST_PATH = 'dist/client/.simplycms-public.json';

const cache = new Map<string, readonly string[]>();

/**
 * Верхньорівневі імена `public/` магазину (майстер §3.2): статика віддається
 * раніше за роутер, тож адреса сутності не може їм дорівнювати. Без маніфесту
 * (dev, тести) — `[]`. Кеш на процес: після збірки маніфест не змінюється.
 * `root` — корінь магазину; типово `process.cwd()` (так стартує прод).
 */
export function publicNames(root: string = process.cwd()): readonly string[] {
  const file = resolve(root, PUBLIC_MANIFEST_PATH);
  const hit = cache.get(file);
  if (hit) return hit;
  let names: readonly string[] = [];
  if (existsSync(file)) {
    const parsed: unknown = JSON.parse(readFileSync(file, 'utf8'));
    if (Array.isArray(parsed))
      names = parsed.filter((v): v is string => typeof v === 'string');
  }
  cache.set(file, names);
  return names;
}

/** Лише для тестів: скинути кеш між тимчасовими теками. */
export function resetPublicNamesCache(): void {
  cache.clear();
}
