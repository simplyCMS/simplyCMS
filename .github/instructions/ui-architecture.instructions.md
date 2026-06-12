---
applyTo: "app/**/*.{ts,tsx},packages/simplycms/ui/**/*.{ts,tsx},themes/**/*.{ts,tsx}"
description: "Правила побудови UI, система тем та shadcn/ui компоненти"
---

# UI Architecture Rules

## Дизайн-система (@simplysoftua/ui)

- 50+ компонентів на базі **shadcn/ui** + Radix UI.
- Стилі через **Tailwind v4** + `class-variance-authority`.
- Утиліта `cn()` з `@simplysoftua/core` для злиття класів.

### Додавання нових UI компонентів

1. **Перевір MCP shadcn** — чи є компонент у реєстрі.
2. **Переглянь приклади** — `get_item_examples_from_registries`.
3. **Додай** — компонент в `packages/simplycms/ui/src/`.
4. **Аудит** — `get_audit_checklist` після додавання.

## Система тем

### ThemeModule Contract
```typescript
interface ThemeModule {
  manifest: ThemeManifest;
  MainLayout: React.ComponentType<{ children: React.ReactNode }>;
  CatalogLayout: React.ComponentType<{ children: React.ReactNode }>;
  ProfileLayout: React.ComponentType<{ children: React.ReactNode }>;
  pages: ThemePages;
  components?: ThemeComponents;
}
```

### Структура теми
```
themes/default/
├── manifest.ts          # Метадані теми
├── index.ts             # ThemeModule export
├── layouts/             # MainLayout, CatalogLayout, ProfileLayout
├── pages/               # HomePage, CatalogPage, ProductPage, etc.
├── components/          # Theme-specific компоненти (Header, Footer, etc.)
└── styles/              # CSS variables override
```

### Використання теми в app/
```typescript
// app/(storefront)/page.tsx
import { getActiveTheme } from '@simplysoftua/themes';

export default async function HomePage() {
  const theme = await getActiveTheme();
  const { HomePage: ThemedHomePage } = theme.pages;
  return <ThemedHomePage />;
}
```

## ✅ ALWAYS
- Використовуй `@simplysoftua/ui` компоненти, не створюй дублікати.
- Перевіряй shadcn MCP перед додаванням нових компонентів.
- Theme-specific компоненти — лише в `themes/*/components/`.
- Бізнес-компоненти (ProductCard, CartItem) — в `@simplysoftua/core`.
- Responsive дизайн (mobile-first).
- Dark mode підтримка через `next-themes` + CSS variables.
- `forwardRef` для UI-компонентів що проксують ref.

## ❌ NEVER
- Не обминай систему тем для storefront-сторінок.
- Не розміщуй бізнес-логіку в темах (теми — лише візуалізація).
- Не дублюй shadcn/ui компоненти в `app/` — вони мають бути в `@simplysoftua/ui`.
- Не хардкодь кольори — використовуй CSS variables та Tailwind classes.
- Не додавай shadcn/ui компоненти без перевірки через MCP.
- Не використовуй inline styles — лише Tailwind CSS classes.

## Компоненти за пакетами

### @simplysoftua/ui (дизайн-система)
Button, Input, Dialog, Table, Card, Select, Tabs, Form, etc.

### @simplysoftua/core (бізнес-компоненти)
- **Catalog:** ProductCard, FilterSidebar, ProductGallery, ModificationSelector, StockDisplay
- **Cart:** CartButton, CartDrawer, CartItem
- **Checkout:** CheckoutContactForm, CheckoutDeliveryForm, CheckoutOrderSummary, etc.
- **Reviews:** ProductReviews, ReviewCard, ReviewForm, StarRating
- **Profile:** AddressesList, AvatarUpload, ProfileLayout, RecipientsList

### @simplysoftua/admin (адмін-компоненти)
AdminLayout, AdminSidebar, ImageUpload, RichTextEditor, ProductPricesEditor, etc.

### themes/* (theme-specific)
Header, Footer, HeroBanner, ProductCard (override), FilterSidebar (override)

## ℹ️ Де шукати деталі
- `BRD_SIMPLYCMS_NEXTJS.md` секція 7 — система тем (ThemeModule, ThemeManifest).
- `packages/simplycms/ui/src/` — всі shadcn/ui компоненти.
- `packages/simplycms/core/src/components/` — бізнес-компоненти.
- `themes/default/` — еталонна реалізація теми.
