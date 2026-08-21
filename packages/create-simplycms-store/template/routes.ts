import { realpathSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { physical, rootRoute } from '@tanstack/virtual-file-routes';

const STORE_ROOT = dirname(fileURLToPath(import.meta.url));
const ROUTES_DIR = resolve(STORE_ROOT, 'src/routes');

/**
 * Шлях до підтеки `routes/<sub>` пакета ядра — з РОЗГОРНУТИМ симлінком.
 *
 * 🔴 Чому не просто `../../node_modules/simplycms/routes/<sub>`. pnpm розкладає
 * залежності ізольовано: `node_modules/simplycms` — це симлінк на
 * `node_modules/.pnpm/simplycms@<версія>_<хеш>/node_modules/simplycms`. Vite
 * симлінки резолвить (`preserveSymlinks` за замовчуванням вимкнено), тож
 * module-id, який доходить до плагінів, — це РЕАЛЬНИЙ шлях через `.pnpm/`.
 *
 * Code-splitter TanStack Router шукає роут у `TSR_ROUTES_BY_ID_MAP` саме за цим
 * module-id, а заповнює мапу генератор — тими шляхами, які він сканував. Якщо
 * генератору дати шлях через симлінк, ключі не збігаються, збіг не знаходиться
 * і роут НЕ спліриться. Мовчки: збірка успішна, гейти на місці, просто весь
 * застосунок (включно з адмінкою й редактором) їде одним initial-чанком.
 * Заміряно на скретч-магазині: 3 чанки замість 207, уся адмінка в initial.
 *
 * `realpathSync` прибирає розбіжність у корені: генератор дістає той самий
 * шлях, який Vite потім віддасть плагінам. Під плоским деревом (npm) виклик —
 * тотожність, тож правка нічого не змінює.
 *
 * Розгортається САМЕ корінь `routes/` пакета, а підтека приклеюється після:
 * так один `realpathSync` обслуговує всі роут-теки ядра.
 *
 * Слід у `src/routeTree.gen.ts` (шляхи з хешем `.pnpm`) нікого не турбує: файл
 * генерований і лежить у `.gitignore`.
 */
const coreRoutes = (sub: string) =>
  relative(
    ROUTES_DIR,
    join(
      realpathSync(resolve(STORE_ROOT, 'node_modules', 'simplycms', 'routes')),
      sub,
    ),
  );

/**
 * Віртуальна конфігурація роутів магазину.
 *
 * Каркас (вітрина + адмінка) приходить теками роутів із `node_modules` —
 * пакетом ядра `simplycms`, а не файлами магазину. Файлове сканування
 * `src/routes` вимкнене: у роутер потрапляє лише явно змонтоване нижче.
 */
export const routes = rootRoute('__root.tsx', [
  physical('', coreRoutes('storefront')),
  physical('', coreRoutes('admin')),
  // plugin admin routes — місце монтажу роутів адмінки плагінів: додай сюди
  // рядок physical() після встановлення плагіна з adminRoutes (автоматичну
  // вставку через `simplycms add` відкладено — див. cli.md §9). Шлях плагіна
  // будується так само, через realpathSync: без нього роути плагіна мовчки
  // втрачають code-splitting (див. коментар вище).
  // Кастомні роути цього магазину (спочатку — порожня тека).
  physical('', 'my'),
]);
