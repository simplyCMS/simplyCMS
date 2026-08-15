import { realpathSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

/**
 * Чи виконано модуль як CLI (`node <шлях>`), а не імпортовано з тестів.
 *
 * 🔴 Порівняння — через realpath: канонічний шлях запуску веде крізь симлінк
 * `.claude/skills` → `.agents/skills`, а `import.meta.url` Node резолвить у
 * РЕАЛЬНИЙ шлях — наївне ``file://${argv[1]}`` на симлінк-шляху хибне, і
 * main() мовчки не викликався (exit 0 без жодного артефакту; спіймано
 * лайв-тестом 2026-08-15). Realpath зрівнює обидві форми виклику.
 */
export function isCliEntry(metaUrl) {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return metaUrl === pathToFileURL(realpathSync(entry)).href;
  } catch {
    // Нерезолвний argv[1] (видалений файл тощо) — точно не наш CLI-запуск.
    return false;
  }
}
