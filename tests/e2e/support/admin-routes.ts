/**
 * Список сторінок адмінки, виведений зі структури файлів пакета —
 * `packages/simplycms/routes/admin/**`, а не захардкоджений список: новий
 * роут потрапляє в обхід `layout-overflow` автоматично.
 */
import { readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ADMIN_ROUTES_ROOT = join(
  HERE,
  '../../../packages/simplycms/routes/admin',
);

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
 * Динамічні роути, чия сторінка РОЗУМІЄ сентинел `new` (має гілку
 * `id === 'new'` / `isNew`). Тільки їх можна відкривати як `/…/new`.
 *
 * 🔴 Список явний, а не виведений автоматично, і це свідомо. Спершу генератор
 * підставляв `new` у КОЖЕН `$param` — і сім роутів давали `400 Bad Request`:
 * сторінка виконувала `.eq('id', 'new')` по колонці типу `uuid`, Postgres
 * відхиляв літерал, а тест звинувачував у цьому продукт. Тобто тест перевіряв
 * вигадані URL і сам собі створював «дефекти».
 *
 * Як оновити: `git grep -l "=== 'new'\|isNew" -- packages/simplycms/src/admin/pages`.
 */
const NEW_CAPABLE = new Set([
  'banners/$bannerId',
  'discounts/$discountId',
  'discounts/groups/$groupId',
  'price-types/$priceTypeId',
  'products/$productId',
  'sections/$sectionId',
  'shipping/methods/$methodId',
  'shipping/pickup-points/$pointId',
  'shipping/zones/$zoneId',
  'user-categories/$categoryId',
  'user-categories/rules/$ruleId',
]);

/**
 * Динамічні роути, які обхід ПРОПУСКАЄ: їхня сторінка працює лише з реальним
 * записом, а сентинела `new` не має. Щоб їх покрити, потрібні id із сіду —
 * це окрема робота (борг у роадмапі), і мовчки вдавати покриття гірше, ніж
 * назвати прогалину.
 */
const REQUIRES_REAL_ID = new Set([
  'orders/$orderId',
  'plugins/$pluginId/settings',
  'properties/$propertyId',
  'properties/$propertyId/options/$optionId',
  'reviews/$reviewId',
  'themes/$themeId/settings',
  'users/$userId',
]);

/** Ключ класифікації: шлях відносно `routes/admin/`, з `$`-сегментами як є. */
function classificationKey(file: string): string | null {
  const rel = relative(ADMIN_ROUTES_ROOT, file).replace(/\.tsx$/, '');
  const segments = rel.split('/');
  if (segments.at(-1) === 'index') segments.pop();
  if (segments[0] !== 'admin') return null;
  const tail = segments.slice(1);
  return tail.some((s) => s.startsWith('$')) ? tail.join('/') : null;
}

/**
 * Файл роуту → URL-шлях за конвенцією TanStack Router file-based routing:
 * `index.tsx` — сторінка батьківської теки; `$param` (сегмент або тека) —
 * динамічний параметр, який замінюється на `new`.
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

/**
 * Усі навідувані сторінки адмінки, без дублів (`admin.tsx` і
 * `admin/index.tsx` → `/admin`).
 *
 * 🔴 Кидає, якщо зʼявився динамічний роут, не віднесений НІ до
 * `NEW_CAPABLE`, НІ до `REQUIRES_REAL_ID`. Без цього новий роут просто тихо
 * поповнив би обхід сміттєвим URL-ом — саме так і виникли ті сім 400-к.
 */
export function adminRoutePaths(): string[] {
  const files = collectTsxFiles(ADMIN_ROUTES_ROOT);

  const unclassified = files
    .map(classificationKey)
    .filter((key): key is string => key !== null)
    .filter((key) => !NEW_CAPABLE.has(key) && !REQUIRES_REAL_ID.has(key));

  if (unclassified.length > 0) {
    throw new Error(
      'Нові динамічні роути адмінки не класифіковані в ' +
        'tests/e2e/support/admin-routes.ts:\n  ' +
        [...new Set(unclassified)].join('\n  ') +
        '\n\nДодай кожен у NEW_CAPABLE (сторінка розуміє `new`) або в ' +
        'REQUIRES_REAL_ID (потрібен справжній запис).',
    );
  }

  const visitable = files.filter((file) => {
    const key = classificationKey(file);
    return key === null || NEW_CAPABLE.has(key);
  });

  return Array.from(new Set(visitable.map(fileToPath))).sort();
}

/** Роути, свідомо не покриті обходом, — щоб прогалина була видимою у звіті. */
export function skippedAdminRoutes(): string[] {
  return [...REQUIRES_REAL_ID].sort();
}
