# Task: Phase 7 — Фінальна стабілізація, cleanup і документація

## Контекст

Після Phase 0-6 весь проєкт уже має працювати на TanStack Start як на єдиному runtime. Видалення Next.js, `app/` і ранній cleanup мають відбутися в попередніх фазах, тому ця фаза — **не про ще одну міграцію**, а про фінальну стабілізацію:

- перевірити, що раннє видалення Next.js не залишило мертвих посилань;
- довести до ладу документацію та інструкції;
- зробити повну верифікацію архітектурної консистентності.

### Що перевіряється як уже видалене

| Артефакт | Причина |
|----------|---------|
| `next` npm package | Має бути видалений у ранніх фазах |
| `eslint-config-next` | Має бути видалений у ранніх фазах |
| `next.config.ts` | Має бути замінений `vite.config.ts` |
| `next-env.d.ts` | Має бути видалений |
| `app/` directory | Має бути замінена `src/routes/` |
| `proxy.ts` | Має бути замінений `beforeLoad`/`src/start.ts` |
| `.next/` build cache | Не має бути частиною робочого контуру |

### Що оновлюється

| Файл | Зміни |
|------|-------|
| `package.json` | Видалити next, eslint-config-next; оновити scripts |
| `tsconfig.json` | Видалити Next.js-specific paths, додати src/ paths |
| `eslint.config.mjs` | Замінити eslint-config-next на generic React config |
| `tailwind.config.ts` | Оновити content paths (app/ → src/) |
| `simplycms.config.ts` | Перевірити сумісність і env access strategy |
| `README.md` | Оновити інструкції (Next.js → TanStack Start) |
| `AGENTS.md` | Оновити структуру проєкту |
| `.github/instructions/*.md` | Оновити архітектурні інструкції |

## Вимоги

### Перевірка раннього cleanup

- [ ] Підтвердити, що `next`, `eslint-config-next`, `@types/next` (якщо були) вже видалені з dependency graph
- [ ] Підтвердити, що `next.config.ts`, `next-env.d.ts`, `proxy.ts`, `.next/`, `app/`, `app/theme-registry.server.ts`, `app/providers.tsx` відсутні або більше не використовуються
- [ ] Якщо якийсь із цих артефактів ще існує, прибрати його саме в цій фазі як дефект попередніх фаз, а не як запланований основний обсяг робіт

### Оновлення конфігурації

- [ ] `package.json`:
  - Перевірити що next вже відсутній у dependencies
  - Перевірити що scripts `dev`, `build`, `start` використовують TanStack Start
  - Видалити залишкові scripts для Next.js, якщо вони ще лишились
- [ ] `tsconfig.json`:
  - Перевірити що `next-env.d.ts` більше не включається
  - Перевірити що paths орієнтовані на `src/*`, а не `app/*`
  - Видалити залишкові Next.js-specific compiler options
- [ ] `eslint.config.mjs`:
  - Замінити `eslint-config-next` на generic config (eslint-plugin-react, eslint-plugin-react-hooks)
  - Додати TanStack Router ESLint plugin якщо існує
- [ ] `tailwind.config.ts`:
  - Оновити `content` paths: `app/` → `src/`
  - Перевірити що themes/ і packages/ все ще включені
- [ ] `postcss.config.mjs`:
  - Перевірити сумісність з Vite. Tailwind v4 з `@tailwindcss/vite` може не потребувати PostCSS

### Перевірка пакетів

- [ ] `packages/simplycms/core/` — жодного `next/*` імпорту (перевірити grep)
- [ ] `packages/simplycms/admin/` — жодного `next/*` імпорту
- [ ] `packages/simplycms/theme-system/` — жодного `next/*` імпорту
- [ ] `packages/simplycms/ui/` — `next-themes` дозволено (framework-agnostic)
- [ ] `themes/` — жодного `next/*` імпорту

### Перевірка змінних оточення

- [ ] Перевірити що **жодного** `NEXT_PUBLIC_*` не залишилось в коді:
  - `grep -r "NEXT_PUBLIC_" packages/ themes/ src/ simplycms.config.ts` — має бути порожнім
  - `grep -r "process.env.NEXT_PUBLIC_" packages/ themes/ src/` — має бути порожнім
- [ ] Перевірити що `import.meta.env.VITE_*` використовується коректно
- [ ] Оновити `.env.example` (якщо є) — `NEXT_PUBLIC_*` → `VITE_*`

### Перевірка Supabase Edge Functions

- [ ] Перевірити `supabase/functions/` — Edge Functions (`get-guest-order/` та інші) не залежать від Next.js, але потрібно явно перевірити що вони працюють з новою архітектурою незалежно від того, чи guest-order реалізовано через `createServerFn`, чи через server handler

### Оновлення документації

- [ ] `README.md` — оновити:
  - Tech stack: Next.js → TanStack Start
  - Getting started commands
  - Project structure
- [ ] `AGENTS.md` — оновити:
  - Project structure (app/ → src/routes/)
  - Key conventions
  - Quick reference commands
- [ ] `.github/instructions/architecture-core.instructions.md` — оновити:
  - Rendering стратегії (замінити Next.js specific на TanStack Start)
  - Route groups (src/routes/ замість app/)
  - Видалити Next.js-specific rules (Server Components, "use client")
  - Додати TanStack Start-specific rules (createServerFn, head, loader)
- [ ] `.github/instructions/tooling.instructions.md` — оновити:
  - Основні команди (якщо змінились)
  - Конфігурація (Next.js → Vite + TanStack Start)
- [ ] `.github/instructions/data-access.instructions.md` — оновити:
  - Замінити `unstable_cache` на in-memory TTL cache
  - Замінити `cookies()` з next/headers на `getHeaders()` / `setCookie()`
  - Замінити Server Components data fetching на loader/createServerFn патерни
- [ ] `.github/instructions/storage.instructions.md` — оновити:
  - Видалити посилання на `next/image` якщо є
  - Оновити server-side image processing патерни
- [ ] `.github/instructions/optimization.instructions.md` — оновити:
  - Видалити Next.js-specific optimizations (next/image, ISR, Server Components)
  - Додати Vite/TanStack Start optimizations (code splitting, lazy routes, prefetch)
- [ ] `.github/copilot-instructions.md` — оновити:
  - MCP recommendations (видалити Next.js-specific, додати TanStack Start)
  - Migration awareness секцію (міграція завершена)
  - Оновити project structure overview
- [ ] `.github/prompts/` та `.github/agents/` (якщо існують) — перевірити на `next/*` references

### Повна верифікація

- [ ] `pnpm install` — чисте встановлення без помилок
- [ ] `pnpm typecheck` — без помилок
- [ ] `pnpm lint` — без помилок
- [ ] `pnpm build` — production build проходить
- [ ] `pnpm dev` — dev server стартує

### Консистентність із попередніми фазами

- [ ] Перевірити що фінальна auth/session реалізація використовує повноцінний cookie read/write механізм для `@supabase/ssr`, а не лише читання cookies
- [ ] Перевірити що theme caching спирається на in-memory TTL cache + loader/server-function orchestration, а не на `React.cache()` / `next/cache`
- [ ] Перевірити що route params/search/head не емулюються через adapters або wrappers сумісності
- [ ] Перевірити що image rendering не залежить від `next/image` і не використовує migration wrappers
- [ ] Функціональна перевірка:
  - Головна сторінка завантажується з SSR
  - Каталог / секції / товари відображаються
  - View Source показує SSR HTML для storefront
  - SEO теги присутні в HTML head (title, description, og:*, JSON-LD)
  - Sitemap.xml генерується
  - Robots.txt генерується
  - Auth flow працює (login → redirect)
  - Admin panel працює (CRUD операції)
  - Theme switching працює (з адмінки)
  - Cart / Checkout працює
  - Profile / Orders доступні залогіненим
  - Image optimization працює (або graceful degradation)

## Clarify (питання перед імплементацією)

- [ ] Чи видаляти `temp/` директорію?
  - Чому це важливо: `temp/` — read-only referens на оригінальний Vite SPA проект. Після міграції він може бути не потрібен
  - Варіант A: Залишити — це архівний референс, не заважає (рекомендовано)
  - Варіант B: Видалити — очищення
  - Вплив: розмір репозиторію

- [ ] Чи оновлювати `pnpm-workspace.yaml`?
  - Чому це важливо: workspace може мати references на app/ або інші Next.js specific paths
  - Дія: перевірити вміст і оновити якщо потрібно
  - Вплив: pnpm workspace resolution

- [ ] Чи потрібно оновлювати CI/CD конфігурацію?
  - Чому це важливо: якщо є GitHub Actions або інші CI pipelines, вони можуть використовувати Next.js-specific build commands
  - Дія: перевірити `.github/workflows/` і оновити
  - Вплив: CI/CD

## Рекомендовані патерни

### Фінальна консистентність з верифікацією

У цій фазі не треба ще раз вигадувати великий cleanup. Порядок такий:
1. Перевірити відсутність мертвих Next.js reference
2. Перевірити конфігурацію та env-модель
3. Перевірити документацію
4. Запустити повну функціональну верифікацію

### Grep-based verification

Після видалення виконати:
- `grep -r "from 'next/" packages/ themes/ src/` — має бути порожнім
- `grep -r "from \"next/" packages/ themes/ src/` — має бути порожнім
- `grep -r "'use client'" packages/ themes/` — має бути порожнім (якщо видалили в Phase 1)
- `grep -r "next/navigation\|next/link\|next/image\|next/headers\|next/cache\|next/server\|next/dynamic" .` — лише в temp/ і node_modules
- `grep -r "NEXT_PUBLIC_" packages/ themes/ src/ simplycms.config.ts` — має бути порожнім
- `grep -r "process.env.NEXT_PUBLIC_" packages/ themes/ src/` — має бути порожнім

## Антипатерни (уникати)

### ❌ Перетворювати цю фазу на ще одну основну міграцію
Якщо Next.js все ще залишається у runtime на цьому етапі, це означає що попередні фази не доведені до кінця.

### ❌ Забути оновити документацію
Застаріла документація — гірше ніж відсутня. AGENTS.md, README.md і instructions files мають відображати актуальну архітектуру.

### ❌ Залишати "мертвий код"
Після видалення app/ перевірити чи не залишились imports або references на видалені файли в packages/ або src/.

### ❌ Залишати змішану env-модель
Після cleanup не можна залишати одночасно `NEXT_PUBLIC_*` і `VITE_*` для клієнтських змінних. Клієнтський код має бути повністю переведений на `import.meta.env.VITE_*`, а серверний env-доступ — на узгоджену схему.

### ❌ Видаляти next-themes
`next-themes` — framework-agnostic пакет (працює з будь-яким React). Незважаючи на назву, він не залежить від Next.js. Залишити.

## Архітектурні рішення

- **В який пакет додавати код:** конфігураційні файли в корені, документація в docs/ і .github/
- **Rendering стратегія:** фінальна — TanStack Start SSR для storefront, client-only для admin
- **Що стабілізується:** TanStack Start runtime, docs, конфігурація, verification pipeline

## Цільова структура після Phase 7

```
src/
  router.tsx
  theme-registry.ts
  server/
    supabase.ts
    products.ts
    sections.ts
    home.ts
    properties.ts
    auth.ts
    themes.ts
    sitemap.ts
    revalidation.ts
  routes/
    __root.tsx
    sitemap[.]xml.tsx
    robots[.]txt.tsx
    _storefront.tsx
    _storefront/
      index.tsx
      catalog/
        index.tsx
        $sectionSlug/
          index.tsx
          $productSlug.tsx
      properties/
        index.tsx
        $propertySlug/
          index.tsx
          $optionSlug.tsx
      cart.tsx
      checkout.tsx
      order-success/
        $orderId.tsx
    _admin.tsx
    admin/
      index.tsx
      products/ ...
      sections/ ...
      orders/ ...
      ... (20+ sub-routes)
    auth/
      index.tsx
      callback.tsx
    _protected.tsx
    _protected/
      profile/
        index.tsx
        orders/
          index.tsx
          $orderId.tsx
        settings.tsx

packages/simplycms/          # Framework-agnostic core
  core/
  admin/
  ui/
  theme-system/
  plugin-system/
  schema/

themes/
  default/
  solarstore/

vite.config.ts               # TanStack Start + Vite
tsconfig.json                # Updated paths
eslint.config.mjs            # Generic React config
tailwind.config.ts            # Updated content paths
simplycms.config.ts
```

## MCP Servers (за потреби)

- **context7** — TanStack Start production build, deployment options
- **supabase** — перевірити що Supabase Edge Functions не залежать від Next.js

## Пов'язана документація

- Всі попередні фази (Phase 0-6) — prerequisites
- `README.md` — для оновлення
- `AGENTS.md` — для оновлення
- `.github/instructions/*.md` — для оновлення
- `.github/copilot-instructions.md` — для оновлення MCP і agent instructions

## Definition of Done

- [ ] `next` і `eslint-config-next` відсутні з package.json
- [ ] `next.config.ts`, `next-env.d.ts`, `proxy.ts` відсутні
- [ ] `app/` директорія або повністю видалена, або не має жодного живого reference
- [ ] `.next/` build cache не використовується і не є частиною робочого контуру
- [ ] `grep -r "from ['\"]next/" packages/ themes/ src/` — порожній результат
- [ ] `pnpm install` — чисте встановлення
- [ ] `pnpm typecheck` — 0 помилок
- [ ] `pnpm lint` — 0 помилок
- [ ] `pnpm build` — production build проходить
- [ ] `pnpm dev` — dev server стартує, всі сторінки працюють
- [ ] SSR верифікація: View Source показує HTML для storefront сторінок
- [ ] SEO верифікація: meta title, description, og:*, JSON-LD в HTML head
- [ ] Auth flow працює end-to-end
- [ ] Admin CRUD працює end-to-end
- [ ] Theme switching працює
- [ ] README.md, AGENTS.md, .github/instructions/* оновлені під TanStack Start
- [ ] Жодного "мертвого" імпорту чи reference на видалені файли
