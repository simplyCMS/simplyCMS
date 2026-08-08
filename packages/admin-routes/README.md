# @simplycms/admin-routes

Файлові роути адмінки SimplyCMS — 43 `.tsx`-файли зони `/admin`, тонкі обгортки
над сторінками `@simplycms/admin`. Магазин монтує цю теку у свій роутер і дістає
готову адмінку, не копіюючи до себе жодного роута.

Пакет ядра [SimplyCMS](https://github.com/simplyCMS/simplyCMS) — відкритої
e-commerce CMS на TanStack Start + Supabase. Окремо ставити зазвичай не треба:
магазин створюється скаффолдером `pnpm create simplycms-store`, який приводить
усе ядро разом.

## Встановлення

```bash
pnpm add @simplycms/admin-routes
```

## Що всередині

| Subpath                            | Що дає                                                     |
| ---------------------------------- | ---------------------------------------------------------- |
| `@simplycms/admin-routes/routes/*` | Єдиний export-ключ: сирі `.tsx`-файли роутів зони `/admin` |

`routes/admin.tsx` — layout-роут зони: `ssr: false`, guard у `beforeLoad` через
`getUser`/`isAdmin` з `@simplycms/storefront-routes/server/auth`, `AdminLayout`
навколо `<Outlet/>`. Решта — сторінки: `products`, `orders`, `sections`,
`properties`, `discounts`, `shipping`, `price-types`, `reviews`, `banners`,
`users`, `user-categories`, `themes`, `plugins`, `settings`, …

## Приклад

Монтування в `routes.ts` магазину (шаблон скаффолдера):

```ts
import { realpathSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { physical, rootRoute } from '@tanstack/virtual-file-routes';

const STORE_ROOT = dirname(fileURLToPath(import.meta.url));
const ROUTES_DIR = resolve(STORE_ROOT, 'src/routes');

const coreRoutes = (name: string) =>
  relative(
    ROUTES_DIR,
    realpathSync(resolve(STORE_ROOT, 'node_modules', name, 'routes')),
  );

export const routes = rootRoute('__root.tsx', [
  physical('', coreRoutes('@simplycms/storefront-routes')),
  physical('', coreRoutes('@simplycms/admin-routes')),
  physical('', 'my'), // кастомні роути магазину
]);
```

## 🔴 Дві пастки

**Шлях мусить пройти через `realpathSync`.** pnpm розкладає залежності
симлінками, Vite їх резолвить — тож module-id, який доходить до плагінів, іде
через `.pnpm/`, а мапу роутів заповнює генератор — шляхами, які сканував. Дати
генератору симлінк: ключі не збігаються, роут не спліриться, збірка успішна й
гейти зелені, але вся адмінка їде в initial-чанку (3 чанки замість 207).

**Export-ключ `./routes/*` ніколи не переводиться на `dist`.** Пакет не
збирається: `src/` у ньому немає, лише `routes/`. Генератор роутів host-а
(`virtualRouteConfig` + `@tanstack/router-generator`) **сканує файли**, а не
імпортує модулі, тож зібраний бандл йому не підходить.

## Ліцензія

MIT
