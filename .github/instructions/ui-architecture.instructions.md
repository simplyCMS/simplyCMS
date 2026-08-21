---
applyTo: "src/**/*.{ts,tsx},packages/simplycms/src/{ui,storefront-routes,cart-ui,catalog-ui,checkout-ui,profile-ui,reviews-ui,themes}/**/*.{ts,tsx},themes/**/*.{ts,tsx},packages/simplycms-theme-*/**/*.{ts,tsx}"
description: "Правила побудови UI, система тем та shadcn/ui компоненти"
---

# UI Architecture Rules

## Дизайн-система (`simplycms/ui`)

- 50+ компонентів на базі **shadcn/ui** + Radix UI.
- Стилі через **Tailwind v4** + `class-variance-authority`.
- Утиліта `cn()` з `simplycms/ui` для злиття класів (ui — T3, self-contained, без залежності від core).

### Додавання нових UI компонентів

1. **Перевір MCP shadcn** — чи є компонент у реєстрі.
2. **Переглянь приклади** — `get_item_examples_from_registries`.
3. **Додай** — компонент в `packages/simplycms/src/ui/`.
4. **Аудит** — `get_audit_checklist` після додавання.

## Система тем

### ThemeModule Contract (v3)
```typescript
interface ThemeModule {
  manifest: ThemeManifest;                 // name, displayName, version, engines.simplycms
  tokens: DesignTokens;                    // значення НАЯВНИХ semantic-змінних shadcn + dark-перекриття
                                           // + 'font-sans'/'font-heading' (повний font-family stack рядком)
  components: ThemeComponents;             // Header, Footer (обовʼязкові) + HeroBanner?, HomeSections?
  settings?: Record<string, ThemeSettingDefinition>;
  messages?: ThemeMessages;                // опційний каталог uk/en (v2.1)
  fonts?: ReadonlyArray<{ stylesheet: string }>;  // абсолютні https:-URL зовнішніх stylesheet (v2.2)
  views?: ThemeViews;                      // опційний view-шар пʼяти сторінок вітрини (v3):
                                           // Home | Catalog | CatalogSection | ProductDetail | Cart
}
```

🔴 Тема **не** постачає даних, роутів і SEO. `MainLayout`, `CatalogLayout`,
`ProfileLayout`, `theme.pages` видалені (D3/D4). З контракту v3 (ревізія
D3′/D4′) тема може перевизначити **презентацію** пʼяти сторінок вітрини через
`views` — див. «Контракт v3» нижче. Джерело контракту —
`packages/simplycms/src/themes/types.ts`.

### Контракт v3: `views`, слоти, conformance

- **Container/view.** `packages/simplycms/src/storefront-routes/pages/<Name>.tsx` —
  container (дані, стан, збір view-model-а); канонічний view — сусідній
  `../views/<Name>View.tsx`. Резолв — `useStorefrontViews({ <Name>: … })`;
  🔴 хук повертає МАПУ і споживається як `<views.X {...vm}/>` — компонент у
  локальній змінній валить `react-hooks/static-components`.
- **View — чиста функція від vm.** Жодних запитів даних усередині view;
  дозволені лише `useT`/`useThemeT`/`useThemeSettings`. На цьому тримається
  conformance (рендер на фікстурах без БД).
- **View-model-и** — `simplycms/contracts/views` (секційна структура,
  форвард-сумісність із треком B); фікстури — `simplycms/contracts/views/fixtures`.
  🔴 Субшлях ПОЗА барелем теки `contracts`: тип слота вимагає `ComponentType` з react.
- **Слоти реквізитів** — `src/storefront-routes/views/slots/` пакета ядра,
  приїжджають темі в `vm.slots`; кожен малює `data-simplycms-requisite="<name>"`. Тема слоти
  РОЗСТАВЛЯЄ, логіку всередині не переписує; імпортувати їх напряму темі не
  можна. Обовʼязковий склад — `REQUIRED_REQUISITES`.
- **Гейт** — `assertThemeViewsConformance` (`simplycms/themes/conformance`);
  запуск: `simplycms theme:conformance <name>` або `conformance.test.ts` теми.
  Рантайм-fallback на канонічний view НЕ робиться свідомо.

🔴 Типографіка і шрифти (v2.2): `font-heading` застосовується до `h1..h6`
через `@layer base`, fallback-значення обох змінних — `:root` у
`src/styles/globals.css` (невизначена `var()` у `font-family` робить УСЮ
декларацію недійсною). `fonts` фільтрує `safeFontStylesheets` — імпорт
**лише** субшляхом `simplycms/themes/safeFontStylesheets` (barrel затягнув
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
├── views/               # Опційно (v3): власні view сторінок вітрини
├── conformance.test.ts  # Гейт заявлених views (скаффолд везе з коробки)
├── index.ts             # ThemeModule export
└── package.json
```

Ніяких `pages/`, `layouts/`, `styles/theme.css` — токени розкладає `applyTokens`,
а `views/` перемальовує КАНОНІЧНУ сторінку, не заводить нову.

🔴 Тема може також бути **npm-пакетом** (Фаза 4): референс ядра —
`packages/simplycms-theme-<name>/` (npm `@simplycms/theme-<name>`), стороння
— `simplycms-theme-<name>`/`@vendor/simplycms-theme-<name>`. Та сама
структура файлів, лише в `src/` пакета + tsup-збірка. Установка —
`simplycms add <pkg> --theme` (голий пакет) або `--theme --copy`
(копія `src/*` у `themes/<key>/`, shadcn-модель). Деталі — `docs/architecture/themes.md`.

### Де рендеряться сторінки
Канонічні сторінки живуть у `packages/simplycms/src/storefront-routes/pages/`.
Каркаси `StorefrontShell` / `ProtectedShell` беруть `Header`/`Footer` і `tokens`
з активної теми та обгортають канонічну сторінку — route-файл теми не торкається:

```typescript
// packages/simplycms/routes/storefront/_storefront.tsx (спрощено)
loader: async () => ({ themeName: (await getActiveTheme())?.name ?? 'default', … })
// component:
<ThemeProvider fallbackTheme="default" initialThemeName={themeName} …>
  <StorefrontShell><Outlet /></StorefrontShell>
</ThemeProvider>
```

Каркас обгортає САМ view — канонічний або темовий (`views`, v3): резолв
відбувається всередині container-а сторінки, каркаса це не стосується.

Валідація модуля теми для авторів — `validateThemeModule` з `simplycms/themes`;
гейт заявлених `views` — `assertThemeViewsConformance`
(`simplycms/themes/conformance`) або `simplycms theme:conformance <name>`.

## ✅ ALWAYS
- Використовуй `simplycms/ui` компоненти, не створюй дублікати.
- Перевіряй shadcn MCP перед додаванням нових компонентів.
- Theme-specific компоненти — лише в `themes/*/components/`.
- Бізнес-компоненти — у feature-ui теках ядра (`simplycms/catalog-ui`, `cart-ui`, `checkout-ui`, `profile-ui`, `reviews-ui`). 🔴 Реекспортів через `simplycms/core` більше немає — фасадну роль розчинено К0, імпортуй із джерела.
- Responsive дизайн (mobile-first).
- Dark mode підтримка через `next-themes` + CSS variables.
- `forwardRef` для UI-компонентів що проксують ref.

## ❌ NEVER
- Не обминай систему тем для storefront-сторінок.
- Не розміщуй бізнес-логіку в темах (теми — лише візуалізація).
- Не дублюй shadcn/ui компоненти в host-`src/` — вони мають бути в `simplycms/ui`.
- Не хардкодь кольори — використовуй CSS variables та Tailwind classes.
- Не хардкодь шрифти й не став `font-serif`/`font-mono` у core-компонентах —
  заголовки беруть `font-heading`, решта — `font-sans` (у темах вибір шрифту
  утиліт-класами законний).
- Не додавай shadcn/ui компоненти без перевірки через MCP.
- Не використовуй inline styles — лише Tailwind CSS classes.

## Компоненти за пакетами

### `simplycms/ui` (дизайн-система)
Button, Input, Dialog, Table, Card, Select, Tabs, Form, etc.

### Feature-UI теки ядра (бізнес-компоненти)
- **`simplycms/catalog-ui`:** ProductCard, FilterSidebar, ProductGallery, ModificationSelector, StockDisplay
- **`simplycms/cart-ui`:** CartButton, CartDrawer, CartItem (+ CartItemView — presentational)
- **`simplycms/checkout-ui`:** CheckoutContactForm, CheckoutDeliveryForm, CheckoutOrderSummary, etc.
- **`simplycms/reviews-ui`:** ProductReviews, ReviewCard, ReviewForm, StarRating
- **`simplycms/profile-ui`:** AddressesList, AvatarUpload, RecipientsList

### `simplycms/admin` (адмін-компоненти)
AdminLayout, AdminSidebar, ImageUpload, RichTextEditor, ProductPricesEditor, etc.

### themes/* (theme-specific)
Header, Footer, HeroBanner, HomeSections + опційні `views` (v3): власна
розмітка Home / Catalog / CatalogSection / ProductDetail / Cart.

## ℹ️ Де шукати деталі
- `packages/simplycms/src/themes/types.ts` — контракт `ThemeModule` (`manifest + tokens + components + settings? + views?`, без `pages`).
- `packages/simplycms/src/contracts/views/` — view-model-и, слот-типи, імена реквізитів.
- `CLAUDE.md` розділ «Theme System (контракт v3)» — реєстрація, SSR-резолв, views.
- `packages/simplycms/src/ui/` — всі shadcn/ui компоненти.
- `themes/default/` — еталонна реалізація локальної теми (fallback-токени);
  `packages/simplycms-theme-solarstore/` — еталон пакетної форми (npm).
- `docs/architecture/themes.md` — повний механізм: пакування, `bootstrapThemes`,
  conformance-kit, чекліст автора.
