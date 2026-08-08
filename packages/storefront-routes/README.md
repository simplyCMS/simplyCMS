# @simplycms/storefront-routes

Каркас вітрини SimplyCMS: файлові роути (`routes/` — зони `_storefront`,
`_protected`, `auth`, `api`), канонічні сторінки, каркаси-лейаути, серверний шар
на `createServerFn` і SEO-генератори. Сторінки живуть тут, а не в темі: тема дає
лише Header/Footer і токени.

Пакет ядра [SimplyCMS](https://github.com/simplyCMS/simplyCMS) — відкритої
e-commerce CMS на TanStack Start + Supabase. Окремо ставити зазвичай не треба:
магазин створюється скаффолдером `pnpm create simplycms-store`, який приводить
усе ядро разом.

## Встановлення

```bash
pnpm add @simplycms/storefront-routes
```

## Що всередині

| Subpath                                     | Що дає                                                                                                                                        |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `@simplycms/storefront-routes`              | Барель: `StorefrontShell`, `ProtectedShell`, `useActiveThemeModule`, `BannerSlider`, `ProductCarousel`, `HomePage`                            |
| `@simplycms/storefront-routes/routes/*`     | Сирі `.tsx` файлові роути: `_storefront/*`, `_protected/profile/*`, `auth/*`, `api/*`                                                         |
| `@simplycms/storefront-routes/pages/*`      | Канонічні сторінки: `Home`, `Catalog`, `CatalogSection`, `ProductDetail`, `Cart`, `Checkout`, `OrderSuccess`, `Profile*`, `Auth*`, `NotFound` |
| `@simplycms/storefront-routes/shells/*`     | Каркаси: `StorefrontShell`, `ProtectedShell`, `ThemeTokens`, `useActiveThemeModule`                                                           |
| `@simplycms/storefront-routes/components/*` | `BannerSlider`, `ProductCarousel`, `SsrProductGrid`, `SetPasswordForm`                                                                        |
| `@simplycms/storefront-routes/server/*`     | `createServerFn`-лоадери: `auth` (`getUser`, `isAdmin`), `products`, `sections`, `properties`, `home`, `themes`, `revalidate-theme`           |
| `@simplycms/storefront-routes/seo/*`        | `buildSitemapXml`, `buildRobotsTxt`, `createSeoInterceptor` + `withSeoInterceptor`                                                            |
| `@simplycms/storefront-routes/active-theme` | `serializeActiveThemeScript` / `readActiveThemeName` — передача активної теми SSR → клієнт                                                    |

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

`/sitemap.xml` і `/robots.txt` відповідають ще до роутера — через
`withSeoInterceptor(createSeoInterceptor({ sitemap, robots }), startHandler)` у
серверному вході магазину (`src/server.ts`).

## 🔴 Дві пастки

**Шлях мусить пройти через `realpathSync`.** pnpm розкладає залежності
симлінками, Vite їх резолвить — тож module-id, який доходить до плагінів, іде
через `.pnpm/`, а мапу роутів заповнює генератор — шляхами, які сканував. Дати
генератору симлінк: ключі не збігаються, роут не спліриться, збірка успішна й
гейти зелені, але застосунок їде одним initial-чанком (3 чанки замість 207).

**Export-ключ `./routes/*` ніколи не переводиться на `dist`.** `src/**`
публікується зібраним `dist/**` (ESM + `.d.ts`, tsup), а `routes/**` — **сирими
`.tsx`**: генератор роутів host-а (`virtualRouteConfig` +
`@tanstack/router-generator`) сканує файли, а не імпортує модулі. Те саме діє
для `@simplycms/admin-routes`. Інваріант тримає packaging-suite
`tests/published-exports-parity.test.ts` — кожна ціль export-а мусить існувати
в tarball-і; але сам напрямок «сирці, не dist» є архітектурним рішенням, а не
випадковістю збірки.

## Ліцензія

MIT
