# @simplycms/catalog-ui

React-компоненти каталогу SimplyCMS: картка товару, галерея, характеристики,
вибір модифікації, наявність і панель фільтрів. З них зібрані канонічні
сторінки каталогу та картки товару в `@simplycms/storefront-routes`.

Пакет ядра [SimplyCMS](https://github.com/simplyCMS/simplyCMS) — відкритої
e-commerce CMS на TanStack Start + Supabase. Окремо ставити зазвичай не треба:
магазин створюється скаффолдером `pnpm create simplycms-store`, який приводить
усе ядро разом.

## Встановлення

```bash
pnpm add @simplycms/catalog-ui
```

Peer-залежності: `react` (18/19), `@tanstack/react-query`,
`@tanstack/react-router`, `lucide-react`.

## Що всередині

| Експорт | Що це |
|---------|-------|
| `ProductCard` | Картка товару в сітці: зображення, ціна й стара ціна, бейдж наявності, рейтинг |
| `ProductGallery` | Галерея зображень товару з мініатюрами й перемиканням стрілками |
| `ProductCharacteristics` | Характеристики товару; значення з опцією лінкує на `/properties/$propertySlug/$optionSlug` |
| `ModificationSelector`, `ModificationStockInfo` | Вибір модифікації з цінами й наявністю; ховається, якщо модифікація одна |
| `StockDisplay`, `StockBadge` | Наявність: кількість і розбивка по точках видачі / короткий бейдж статусу |
| `FilterSidebar`, `FilterValue` | Фільтри секції: властивості з лічильниками опцій, діапазони ціни й числових властивостей |
| `ActiveFilters`, `ActiveFilter` | Чипи застосованих фільтрів — зняти поодинці або очистити все |
| `CatalogLayout` | Каркас каталогу з хедером і слотами-render-props (`renderCartButton`, `renderThemeToggle`, …) |

Те саме доступне окремими subpath-ами (`exports` має `"./*"`):
`import { ProductCard } from '@simplycms/catalog-ui/ProductCard'`.

## Приклад

Серверна сітка товарів (`@simplycms/storefront-routes`, `SsrProductGrid`):

```tsx
import { ProductCard } from '@simplycms/catalog-ui/ProductCard';

export function SsrProductGrid({ items }: { items: ProductListItem[] }) {
  return items.map((item) => (
    <ProductCard
      key={item.id}
      product={{
        id: item.id,
        name: item.name,
        slug: item.slug,
        images: item.imageUrl ? [item.imageUrl] : [],
        section: item.sectionSlug ? { slug: item.sectionSlug } : null,
        price: item.price,
      }}
    />
  ));
}
```

## 🔴 Не всі компоненти presentational

`FilterSidebar` сам ходить у БД (`useSupabaseClient()` + `useQuery`), а
`StockDisplay` і `CatalogLayout` беруть хуки з legacy-фасаду `@simplycms/core`:
вони працюють лише всередині `QueryClientProvider` + `SupabaseProvider` (у
магазині їх ставить `CMSProvider`). Render-props `renderButton` /
`renderCheckbox` / … у `FilterSidebar` оголошені в типі, але компонент їх не
використовує — розмітка там власна.

## Ліцензія

MIT
