# @simplycms/admin

Адмін-панель SimplyCMS: 40 готових сторінок (товари, замовлення, секції, знижки,
доставка, ціни, відгуки, плагіни, теми, користувачі), лейаут із сайдбаром і
складені форм-компоненти. Самих роутів тут немає — їх монтує
`@simplycms/admin-routes`.

Пакет ядра [SimplyCMS](https://github.com/simplyCMS/simplyCMS) — відкритої
e-commerce CMS на TanStack Start + Supabase. Окремо ставити зазвичай не треба:
магазин створюється скаффолдером `pnpm create simplycms-store`, який приводить
усе ядро разом.

## Встановлення

```bash
pnpm add @simplycms/admin
```

## Що всередині

| Subpath                         | Що дає                                                                                         |
| ------------------------------- | ---------------------------------------------------------------------------------------------- |
| `@simplycms/admin`              | Барель — усе нижче іменованими експортами                                                      |
| `@simplycms/admin/layouts/*`    | `AdminLayout` (сайдбар, хедер, вихід), `AdminSidebar`                                          |
| `@simplycms/admin/pages/*`      | 40 сторінок: `Products`, `ProductEdit`, `Orders`, `Discounts`, `Plugins`, `Themes`, `Users`, … |
| `@simplycms/admin/components/*` | 13 форм-блоків: `RichTextEditor` (Tiptap), `ImageUpload`, `ProductPricesEditor`, …             |

## Приклад

Роут адмінки — тонка обгортка над сторінкою
(`packages/admin-routes/routes/admin/products/index.tsx`):

```tsx
import { createFileRoute } from '@tanstack/react-router';
import Products from '@simplycms/admin/pages/Products';

export const Route = createFileRoute('/admin/products/')({
  component: Products,
});
```

## 🔴 Сторінки — default-експорти, барель — іменовані

`@simplycms/admin/pages/Products` віддає компонент **default**-експортом, а барель
`@simplycms/admin` реекспортує його під тим самим іменем як named. Компоненти й
лейаути — named в обох формах.

Сторінки клієнтські: тримають дані на React Query і беруть Supabase із
`useSupabaseClient()`, тож потребують `QueryClientProvider` і `SupabaseProvider`
над собою — `@simplycms/admin-routes` монтує зону `/admin` з `ssr: false`.

## Ліцензія

MIT
