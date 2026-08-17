---
applyTo: "src/**/*.{ts,tsx},packages/ui/**/*.{ts,tsx},themes/**/*.{ts,tsx},packages/simplycms-theme-*/**/*.{ts,tsx}"
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
3. **Додай** — компонент в `packages/ui/src/`.
4. **Аудит** — `get_audit_checklist` після додавання.

## Система тем

### ThemeModule Contract (v2.2)
```typescript
interface ThemeModule {
  manifest: ThemeManifest;                 // name, displayName, version, engines.simplycms
  tokens: DesignTokens;                    // значення НАЯВНИХ semantic-змінних shadcn + dark-перекриття
                                           // + 'font-sans'/'font-heading' (повний font-family stack рядком)
  components: ThemeComponents;             // Header, Footer (обовʼязкові) + HeroBanner?, HomeSections?
  settings?: Record<string, ThemeSettingDefinition>;
  messages?: ThemeMessages;                // опційний каталог uk/en (v2.1)
  fonts?: ReadonlyArray<{ stylesheet: string }>;  // абсолютні https:-URL зовнішніх stylesheet (v2.2)
}
```

🔴 Тема **не** постачає сторінок і лейаутів. `MainLayout`, `CatalogLayout`,
`ProfileLayout`, `theme.pages` видалені (рішення D3/D4). Джерело контракту —
`packages/theme-system/src/types.ts`.

🔴 Типографіка і шрифти (v2.2): `font-heading` застосовується до `h1..h6`
через `@layer base`, fallback-значення обох змінних — `:root` у
`src/styles/globals.css` (невизначена `var()` у `font-family` робить УСЮ
декларацію недійсною). `fonts` фільтрує `safeFontStylesheets` — імпорт
**лише** субшляхом `@simplycms/themes/safeFontStylesheets` (barrel затягнув
би серверний `anon-client` у клієнтський бандл); рендер — `ThemeFonts` у
`StorefrontShell` і `ProtectedShell`. `@font-face`/self-hosted шрифти теми —
поза межею v2.2. Brand-змінних (`--brand-*`, `colors.brand`) більше немає:
`.gradient-brand*` фарбуються `--primary`.

### Структура теми
```
themes/default/                          # Локальна тема (dev-loop/copy-in, аліас @themes/*)
├── manifest.ts          # Метадані + engines.simplycms
├── tokens.ts            # DesignTokens (CSS-змінні, включно з dark)
├── components/          # Header, Footer (+ опційні HeroBanner, HomeSections)
├── messages.ts           # Опційний каталог uk/en (контракт v2.1)
├── index.ts             # ThemeModule export
└── package.json
```

Ніяких `pages/`, `layouts/`, `styles/theme.css` — токени розкладає `applyTokens`.

🔴 Тема може також бути **npm-пакетом** (Фаза 4): референс ядра —
`packages/simplycms-theme-<name>/` (npm `@simplycms/theme-<name>`), стороння
— `simplycms-theme-<name>`/`@vendor/simplycms-theme-<name>`. Та сама
структура файлів, лише в `src/` пакета + tsup-збірка. Установка —
`simplycms add <pkg> --theme` (голий пакет) або `--theme --copy`
(копія `src/*` у `themes/<key>/`, shadcn-модель). Деталі — `docs/architecture/themes.md`.

### Де рендеряться сторінки
Канонічні сторінки живуть у `@simplycms/storefront-routes/src/pages/`.
Каркаси `StorefrontShell` / `ProtectedShell` беруть `Header`/`Footer` і `tokens`
з активної теми та обгортають канонічну сторінку — route-файл теми не торкається:

```typescript
// packages/storefront-routes/routes/_storefront.tsx (спрощено)
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
- Не хардкодь шрифти й не став `font-serif`/`font-mono` у core-компонентах —
  заголовки беруть `font-heading`, решта — `font-sans` (у темах вибір шрифту
  утиліт-класами законний).
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
- `packages/theme-system/src/types.ts` — контракт `ThemeModule` (`manifest + tokens + components + settings?`, без `pages`).
- `CLAUDE.md` розділ «Theme System (контракт v2)» — реєстрація та SSR-резолв.
- `packages/ui/src/` — всі shadcn/ui компоненти.
- `themes/default/` — еталонна реалізація локальної теми (fallback-токени);
  `packages/simplycms-theme-solarstore/` — еталон пакетної форми (npm).
- `docs/architecture/themes.md` — повний механізм: пакування, `bootstrapThemes`,
  conformance-kit, чекліст автора.
