/**
 * Список сторінок адмінки, виведений зі структури файлів пакета —
 * `packages/admin-routes/routes/admin/**`, а не захардкоджений список: новий
 * роут потрапляє в обхід `layout-overflow` автоматично.
 */
import { readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ADMIN_ROUTES_ROOT = join(HERE, '../../../packages/admin-routes/routes');

/** Рекурсивно збирає всі `.tsx`-файли під текою роутів адмінки. */
function collectTsxFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...collectTsxFiles(full));
    } else if (entry.endsWith('.tsx')) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Файл роуту → URL-шлях за конвенцією TanStack Router file-based routing:
 * `index.tsx` — сторінка батьківської теки; `$param` (сегмент або тека) —
 * динамічний параметр. Для `$id`-сегментів беремо `new` — задача явно просить
 * саме це значення, і це водночас реальний, підтримуваний маршрут (сторінки
 * редагування самі перевіряють `id === 'new'` — `isNew` у `ProductEdit.tsx`
 * та ін.), а не вигадана неіснуюча сутність.
 */
function fileToPath(file: string): string {
  const rel = relative(ADMIN_ROUTES_ROOT, file).replace(/\.tsx$/, '');
  const segments = rel.split('/');
  if (segments.at(-1) === 'index') segments.pop();
  const mapped = segments.map((segment) =>
    segment.startsWith('$') ? 'new' : segment,
  );
  return `/${mapped.join('/')}`;
}

/** Усі навідувані сторінки адмінки, без дублів (`admin.tsx` і `admin/index.tsx` → `/admin`). */
export function adminRoutePaths(): string[] {
  const paths = collectTsxFiles(ADMIN_ROUTES_ROOT).map(fileToPath);
  return Array.from(new Set(paths)).sort();
}
