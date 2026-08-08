# @simplycms/storefront

SSR-лоадери вітрини (товари, розділи, характеристики, головна) і генератори
`sitemap.xml` / `robots.txt`. Пакет не створює Supabase-клієнт і не знає про
фреймворк: клієнт та `baseUrl` інжектує host, який сам загортає виклик у
`createServerFn`.

Пакет ядра [SimplyCMS](https://github.com/simplyCMS/simplyCMS) — відкритої
e-commerce CMS на TanStack Start + Supabase. Окремо ставити зазвичай не треба:
магазин створюється скаффолдером `pnpm create simplycms-store`, який приводить
усе ядро разом.

## Встановлення

```bash
pnpm add @simplycms/storefront
```

## Що всередині

| Subpath | Експорти |
|---------|----------|
| `@simplycms/storefront`          | Тип `StorefrontClient` + реекспорт `./loaders` і `./seo` |
| `@simplycms/storefront/loaders`  | `loadHomePageData`, `loadProduct`, `loadProducts`, `loadProductsBySectionId`, `loadSections`, `loadSectionBySlug`, `loadRootSections`, `loadProperties`, `loadPropertyBySlug`, `loadPropertyOption`, `loadDefaultPriceTypeId`, константи `PRODUCT_FULL_SELECT` / `PRODUCT_LIST_SELECT`, тип `RootSection` |
| `@simplycms/storefront/seo`      | `buildSitemapXml(client, baseUrl)`, `buildRobotsTxt(baseUrl)` |

Перший аргумент кожного лоадера — `StorefrontClient` (це `SupabaseClient` без
фіксованої `Database`, тож типізований клієнт магазину підходить структурно).

## Приклад

```ts
// packages/storefront-routes/src/server/home.ts — host-glue навколо лоадера
import { createServerFn } from '@tanstack/react-start';
import { loadHomePageData } from '@simplycms/storefront/loaders';
import { createServerSupabase } from '@simplycms/supabase/server-client';

export const getHomePageData = createServerFn({ method: 'GET' }).handler(
  async () => loadHomePageData(createServerSupabase()),
);

// packages/storefront-routes/src/seo/sitemap.ts — той самий принцип для SEO
import { createAnonSupabaseClient } from '@simplycms/supabase/anon-client';
import { buildSitemapXml as buildSitemap } from '@simplycms/storefront/seo';

const BASE_URL = import.meta.env.VITE_SITE_URL || 'https://example.com';

export function buildSitemapXml(): Promise<string> {
  return buildSitemap(createAnonSupabaseClient(), BASE_URL);
}
```

## 🔴 `buildSitemapXml` кидає, а не віддає порожню карту

Помилку запиту sitemap НЕ ковтає: карта з самих лише статичних URL виглядає як
успіх, і кеш-заголовок (година + SWR) зафіксував би цю неправду для пошукових
роботів. Краще 5xx без кешу — обробляти виняток має host.

## Ліцензія

MIT
