# Task: Phase 7 — Видалення Next.js та фінальна стабілізація

## Контекст

Після Phase 0-6 весь проєкт працює на TanStack Start. Next.js фізично ще присутній як залежність і директорія `app/` ще існує, але не використовується. Ця фаза — **фінальне очищення**: видалення Next.js, видалення `app/`, оновлення конфігурації, перевірка всіх функцій.

### Що видаляється

| Артефакт | Причина |
|----------|---------|
| `next` npm package | Замінений TanStack Start |
| `eslint-config-next` | Замінюється generic ESLint config |
| `next.config.ts` | Замінений `vite.config.ts` |
| `next-env.d.ts` | Next.js type declarations |
| `app/` directory | Замінена `src/routes/` |
| `proxy.ts` | Замінений beforeLoad guards (Phase 4-5) |
| `postcss.config.mjs` | Перевірити чи потрібен (Tailwind v4 може працювати через Vite plugin) |
| `.next/` build cache | Next.js build output |

### Що оновлюється

| Файл | Зміни |
|------|-------|
| `package.json` | Видалити next, eslint-config-next; оновити scripts |
| `tsconfig.json` | Видалити Next.js-specific paths, додати src/ paths |
| `eslint.config.mjs` | Замінити eslint-config-next на generic React config |
| `tailwind.config.ts` | Оновити content paths (app/ → src/) |
| `simplycms.config.ts` | Перевірити сумісність |
| `README.md` | Оновити інструкції (Next.js → TanStack Start) |
| `AGENTS.md` | Оновити структуру проєкту |
| `.github/instructions/*.md` | Оновити архітектурні інструкції |

## Вимоги

### Видалення Next.js

- [ ] Видалити npm залежності: `next`, `eslint-config-next`, `@types/next` (якщо є)
- [ ] Видалити файли:
  - `next.config.ts`
  - `next-env.d.ts`
  - `proxy.ts`
  - `.next/` директорія (build cache)
- [ ] Видалити директорію `app/` повністю (всі routes мігровані в `src/routes/`)
- [ ] Видалити `app/theme-registry.server.ts` (замінено на `src/theme-registry.ts`)
- [ ] Видалити `app/providers.tsx` (замінено на providers в __root.tsx)

### Оновлення конфігурації

- [ ] `package.json`:
  - Видалити next з dependencies
  - Видалити eslint-config-next з devDependencies
  - Оновити scripts: dev, build, start мають використовувати TanStack Start (вже зроблено в Phase 1, перевірити)
  - Видалити scripts для Next.js (якщо залишились)
- [ ] `tsconfig.json`:
  - Видалити `"next-env.d.ts"` з includes
  - Оновити paths: видалити `@/*` → `app/*`, додати `@/*` → `src/*`
  - Видалити Next.js-specific compiler options якщо є
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

### Повна верифікація

- [ ] `pnpm install` — чисте встановлення без помилок
- [ ] `pnpm typecheck` — без помилок
- [ ] `pnpm lint` — без помилок
- [ ] `pnpm build` — production build проходить
- [ ] `pnpm dev` — dev server стартує
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

### Поступове видалення з верифікацією

Не видаляти все одразу. Порядок:
1. Видалити `app/` → `pnpm typecheck`
2. Видалити next з package.json → `pnpm install` → `pnpm typecheck`
3. Оновити конфігурацію → `pnpm build`
4. Повна функціональна перевірка
5. Оновити документацію

### Grep-based verification

Після видалення виконати:
- `grep -r "from 'next/" packages/ themes/ src/` — має бути порожнім
- `grep -r "from \"next/" packages/ themes/ src/` — має бути порожнім
- `grep -r "'use client'" packages/ themes/` — має бути порожнім (якщо видалили в Phase 1)
- `grep -r "next/navigation\|next/link\|next/image\|next/headers\|next/cache\|next/server\|next/dynamic" .` — лише в temp/ і node_modules

## Антипатерни (уникати)

### ❌ Видаляти все одним комітом
Поступове видалення з верифікацією на кожному кроці. Якщо щось зламається — легко відкотити конкретний крок.

### ❌ Забути оновити документацію
Застаріла документація — гірше ніж відсутня. AGENTS.md, README.md і instructions files мають відображати актуальну архітектуру.

### ❌ Залишати "мертвий код"
Після видалення app/ перевірити чи не залишились imports або references на видалені файли в packages/ або src/.

### ❌ Видаляти next-themes
`next-themes` — framework-agnostic пакет (працює з будь-яким React). Незважаючи на назву, він не залежить від Next.js. Залишити.

## Архітектурні рішення

- **В який пакет додавати код:** конфігураційні файли в корені, документація в docs/ і .github/
- **Rendering стратегія:** фінальна — TanStack Start SSR для storefront, client-only для admin
- **Що видаляється:** next, eslint-config-next, next.config.ts, next-env.d.ts, proxy.ts, app/, .next/

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

- [ ] `next` і `eslint-config-next` видалені з package.json
- [ ] `next.config.ts`, `next-env.d.ts`, `proxy.ts` видалені
- [ ] `app/` директорія повністю видалена
- [ ] `.next/` build cache видалено
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
