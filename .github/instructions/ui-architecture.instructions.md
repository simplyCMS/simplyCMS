---
applyTo: "src/**/*.{ts,tsx},packages/simplycms/ui/**/*.{ts,tsx},themes/**/*.{ts,tsx}"
description: "Правила побудови UI, система тем та shadcn/ui компоненти"
---

# UI Architecture Rules

## Дизайн-система (@simplycms/ui)

- 50+ компонентів на базі **shadcn/ui** + Radix UI.
- Стилі через **Tailwind v4** + `class-variance-authority`.
- Утиліта `cn()` з `@simplycms/ui` для злиття класів (ui — self-contained, без залежності від core).

### Додавання нових UI компонентів

1. **Перевір MCP shadcn** — чи є компонент у реєстрі.
2. **Переглянь приклади** — `get_item_examples_from_registries`.
3. **Додай** — компонент в `packages/simplycms/ui/src/`.
4. **Аудит** — `get_audit_checklist` після додавання.

## Система тем

### ThemeModule Contract (v2)
```typescript
interface ThemeModule {
  manifest: ThemeManifest;                 // name, displayName, version, engines.simplycms
  tokens: DesignTokens;                    // значення НАЯВНИХ semantic-змінних shadcn + dark-перекриття
  components: ThemeComponents;             // Header, Footer (обовʼязкові) + HeroBanner?, HomeSections?
  settings?: Record<string, ThemeSettingDefinition>;
}
```

🔴 Тема **не** постачає сторінок і лейаутів. `MainLayout`, `CatalogLayout`,
`ProfileLayout`, `theme.pages` видалені (рішення D3/D4). Джерело контракту —
`packages/simplycms/theme-system/src/types.ts`.

### Структура теми
```
themes/default/
├── manifest.ts          # Метадані + engines.simplycms
├── tokens.ts            # DesignTokens (CSS-змінні, включно з dark)
├── components/          # Header, Footer (+ опційні HeroBanner, HomeSections)
├── index.ts             # ThemeModule export
└── package.json
```

Ніяких `pages/`, `layouts/`, `styles/theme.css` — токени розкладає `applyTokens`.

### Де рендеряться сторінки
Канонічні сторінки живуть у `@simplycms/storefront-routes/src/pages/`.
Каркаси `StorefrontShell` / `ProtectedShell` беруть `Header`/`Footer` і `tokens`
з активної теми та обгортають канонічну сторінку — route-файл теми не торкається:

```typescript
// packages/simplycms/storefront-routes/routes/_storefront.tsx (спрощено)
loader: async () => ({ themeName: (await getActiveTheme())?.name ?? 'default', … })
// component:
<ThemeProvider fallbackTheme="default" initialThemeName={themeName} …>
  <StorefrontShell><Outlet /></StorefrontShell>
</ThemeProvider>
```

Валідація модуля теми для авторів — `validateThemeModule` з `@simplycms/themes`.

## ✅ ALWAYS
- Використовуй `@simplycms/ui` компоненти, не створюй дублікати.
- Перевіряй shadcn MCP перед додаванням нових компонентів.
- Theme-specific компоненти — лише в `themes/*/components/`.
- Бізнес-компоненти — у feature-ui пакетах (`@simplycms/catalog-ui`, `cart-ui`, `checkout-ui`, `profile-ui`, `reviews-ui`); legacy-шляхи через `@simplycms/core` — re-export шими.
- Responsive дизайн (mobile-first).
- Dark mode підтримка через `next-themes` + CSS variables.
- `forwardRef` для UI-компонентів що проксують ref.

## ❌ NEVER
- Не обминай систему тем для storefront-сторінок.
- Не розміщуй бізнес-логіку в темах (теми — лише візуалізація).
- Не дублюй shadcn/ui компоненти в `src/` — вони мають бути в `@simplycms/ui`.
- Не хардкодь кольори — використовуй CSS variables та Tailwind classes.
- Не додавай shadcn/ui компоненти без перевірки через MCP.
- Не використовуй inline styles — лише Tailwind CSS classes.

## Компоненти за пакетами

### @simplycms/ui (дизайн-система)
Button, Input, Dialog, Table, Card, Select, Tabs, Form, etc.

### Feature-UI пакети (бізнес-компоненти)
- **@simplycms/catalog-ui:** ProductCard, FilterSidebar, ProductGallery, ModificationSelector, StockDisplay
- **@simplycms/cart-ui:** CartButton, CartDrawer, CartItem (+ CartItemView — presentational)
- **@simplycms/checkout-ui:** CheckoutContactForm, CheckoutDeliveryForm, CheckoutOrderSummary, etc.
- **@simplycms/reviews-ui:** ProductReviews, ReviewCard, ReviewForm, StarRating
- **@simplycms/profile-ui:** AddressesList, AvatarUpload, RecipientsList

### @simplycms/admin (адмін-компоненти)
AdminLayout, AdminSidebar, ImageUpload, RichTextEditor, ProductPricesEditor, etc.

### themes/* (theme-specific)
Header, Footer, HeroBanner, ProductCard (override), FilterSidebar (override)

## ℹ️ Де шукати деталі
- `packages/simplycms/theme-system/src/types.ts` — контракт `ThemeModule`/`ThemePages`.
- `CLAUDE.md` розділ «Theme System (SSR)» — реєстрація та SSR-резолв.
- `packages/simplycms/ui/src/` — всі shadcn/ui компоненти.
- `themes/default/` — еталонна реалізація теми.
