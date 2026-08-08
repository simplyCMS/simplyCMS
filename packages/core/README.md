# @simplycms/core

Legacy-фасад SimplyCMS: провайдери магазину, клієнтські хуки (auth, залишки,
відгуки, банери, знижки) і зворотно-сумісні адреси для логіки, вже винесеної в
окремі пакети ядра.

Пакет ядра [SimplyCMS](https://github.com/simplyCMS/simplyCMS) — відкритої
e-commerce CMS на TanStack Start + Supabase. Окремо ставити зазвичай не треба:
магазин створюється скаффолдером `pnpm create simplycms-store`, який приводить
усе ядро разом.

## Встановлення

```bash
pnpm add @simplycms/core
```

Peer-залежності: `react` (18/19) + `react-dom`, `@supabase/supabase-js`,
`@tanstack/react-query`, `@tanstack/react-router`, `react-hook-form` + `zod` +
`@hookform/resolvers`, `lucide-react`, `next-themes`, `clsx`, `tailwind-merge`.
Tiptap — `optional`.

## Що всередині

| Subpath | Що це |
|---------|-------|
| `.` | Барель: `CMSProvider`, `useAuth`, `useCart`, `useToast`, `useStock`, `useProductReviews`, `cn`, `resolvePrice`, `resolveDiscount`, `calculateShipping` + компоненти каталогу/кошика/чекауту/профілю/відгуків |
| `./providers/CMSProvider` | `CMSProvider` — одним обгортанням `QueryClientProvider` + `SupabaseProvider` + `AuthProvider` + `CartProvider`; приймає власний `customQueryClient` |
| `./hooks/*` | `useAuth`, `useStock`, `useProductReviews`, `useBanners`, `useDiscountedPrice`, `usePriceType`, `useProductsWithStock`, `use-toast`, `use-mobile`, `useCart`, `useThemeSettings` |
| `./lib/*` | `utils` (`cn`), `supabase` (`signUp`/`signIn`/`signOut`/`resetPassword`/`getSession`), `priceUtils`, `discountEngine`, `bannerUtils` |
| `./lib/shipping` | `calculateShipping`, `calculateShippingCost`, `formatShippingCost`, `findShippingZone` + типи доставки |
| `./components/*` | `NavLink`, `ThemeToggle` + сумісні адреси `catalog/`, `cart/`, `checkout/`, `profile/`, `reviews/` |
| `./types` | `Database` — тип згенерованої схеми БД |

## Приклад

Корінь магазину (`src/routes/__root.tsx` шаблону скаффолдера):

```tsx
import { CMSProvider } from '@simplycms/core/providers/CMSProvider';

<ThemeProvider attribute="class" defaultTheme="system" enableSystem>
  <CMSProvider>
    <Outlet />
  </CMSProvider>
</ThemeProvider>;
```

## 🔴 Це фасад, що розчиняється

Більшість subpath-ів — тонкі re-export-и в цільові пакети: `./lib/utils` і
`./hooks/use-toast` → `@simplycms/ui`, `./hooks/useCart` →
`@simplycms/react-query`, `./lib/priceUtils` і `./lib/discountEngine` →
`@simplycms/domain`, `./components/reviews/*` → `@simplycms/reviews-ui` (так
само решта feature-UI). Новий код пишіть проти цільових пакетів; власна
реалізація тут лишилась у `CMSProvider`, `useAuth`, `useStock`,
`useProductReviews`, `useBanners`, `useDiscountedPrice`, `usePriceType`,
`lib/supabase` і `findShippingZone`.

Ще одна пастка: `./hooks` — **не** барель, а сам модуль `useAuth` (рівно
`AuthProvider` і `useAuth`); решта хуків — повним шляхом.

## Ліцензія

MIT
