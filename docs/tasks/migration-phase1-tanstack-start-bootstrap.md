# Task: Phase 1 — Встановлення TanStack Start та перемикання адаптерів

## Контекст

Після Phase 0 пакети `@simplycms/core`, `@simplycms/admin` і `themes/*` більше не імпортують напряму з `next/*` — вони працюють через адаптери в `@simplycms/core/adapters/`. Зараз адаптери делегують до Next.js.

Ця фаза встановлює **TanStack Start + Vite** як новий runtime, створює мінімальний робочий skeleton і **перемикає адаптери** з Next.js на TanStack Router. Після цієї фази Next.js ще фізично присутній в `node_modules`, але пакети вже не залежать від нього.

### Що таке TanStack Start

TanStack Start — full-stack React framework на базі Vite + TanStack Router. Ключові відмінності від Next.js:

- **Isomorphic за замовчуванням** — компоненти і loaders можуть виконуватись і на сервері, і на клієнті
- **SSR увімкнений за замовчуванням** — HTML генерується на сервері без додаткових налаштувань
- **`createServerFn()`** — явний механізм для server-only коду (замість Server Components і `"use server"`)
- **`head` property на route** — SEO metadata замість `generateMetadata` / `export const metadata`
- **File-based routing** через `src/routes/` з `$param` синтаксисом (замість `[param]`)
- **Немає `"use client"` / `"use server"`** — execution boundary визначається архітектурно

### Маппінг примітивів

| Next.js | TanStack Start / Router |
|---------|------------------------|
| `next/link` Link (href) | `@tanstack/react-router` Link (to) |
| `next/navigation` useRouter | `@tanstack/react-router` useRouter / useNavigate |
| `next/navigation` useParams | `Route.useParams()` (route-scoped, type-safe) |
| `next/navigation` usePathname | `useLocation().pathname` |
| `next/navigation` useSearchParams | `Route.useSearch()` (type-safe) |
| `next/navigation` redirect | `redirect()` з `@tanstack/react-router` (у loader/beforeLoad) |
| `next/navigation` notFound | `notFound()` з `@tanstack/react-router` |
| `next/image` Image | Звичайний `<img>` або Vite image plugin |
| `next/dynamic` | `React.lazy()` + `Suspense` |
| `next/font` | CSS @font-face або fontsource |
| `"use client"` | Не потрібно — немає такої концепції |

## Вимоги

- [ ] Встановити `@tanstack/react-start`, `@tanstack/react-router`, `@tanstack/react-router-devtools`, `@vitejs/plugin-react`, `vite` як залежності
- [ ] Створити `vite.config.ts` в корені проєкту з плагіном `tanstackStart()` перед `react()`
- [ ] Створити `src/router.tsx` — фабрика роутера з `createRouter()` і route tree
- [ ] Створити `src/routes/__root.tsx` — root route з HTML shell, `HeadContent`, `Scripts`, `Outlet`, глобальним CSS
- [ ] Створити `src/routes/index.tsx` — мінімальна головна сторінка (placeholder) для перевірки що dev server стартує
- [ ] Оновити `package.json` scripts: `dev`, `build`, `start` мають запускати TanStack Start через Vite
- [ ] **Перемкнути адаптер роутингу** (`@simplycms/core/adapters/router`) з `next/*` на `@tanstack/react-router`
- [ ] **Перемкнути адаптер зображень** (`@simplycms/core/adapters/image`) з `next/image` на звичайний `<img>` елемент
- [ ] Видалити `"use client"` директиви з усіх файлів у `packages/simplycms/` і `themes/` (вони більше не потрібні)
- [ ] Перевірити що шрифт Inter підключається через CSS або fontsource замість `next/font`
- [ ] **Міграція змінних оточення:** замінити `NEXT_PUBLIC_*` на `VITE_*` prefix у всіх клієнтських змінних. Зачеплені файли:
  - `packages/simplycms/core/src/supabase/anon.ts` — `process.env.NEXT_PUBLIC_SUPABASE_URL`
  - `packages/simplycms/core/src/supabase/client.ts` — `process.env.NEXT_PUBLIC_SUPABASE_URL`
  - `simplycms.config.ts` — `process.env.NEXT_PUBLIC_SUPABASE_URL`
  - `.env.local` — перейменувати ключі
  - В Vite доступ через `import.meta.env.VITE_*` замість `process.env.NEXT_PUBLIC_*`
- [ ] Адаптувати `supabase/client.ts`: видалити `"use client"`, зберегти singleton pattern з `typeof window !== "undefined"` guard
- [ ] Вирішити Tailwind v4 + Vite: використати `@tailwindcss/vite` плагін (замість PostCSS pipeline) або залишити PostCSS — прийняти рішення і задокументувати
- [ ] `pnpm dev` стартує TanStack Start dev server
- [ ] Placeholder index route відображається в браузері

## Clarify (питання перед імплементацією)

- [ ] Як адаптувати useParams без route-scoped типізації?
  - Чому це важливо: у TanStack Router `useParams()` прив'язаний до конкретного Route — `Route.useParams()`. Але в core і admin сторінки визначають useParams з generic типом `useParams<{ productId: string }>`, не знаючи конкретний Route
  - Варіант A: Використовувати `useParams({ from: undefined, strict: false })` — працює, але без type-safety (рекомендовано для перехідного періоду)
  - Варіант B: Передавати params як props з route-компонентів у page-компоненти
  - Варіант C: Кожну page-компоненту core/admin прив'язати до конкретного route (ломає модульність)
  - Вплив: архітектура, type-safety, обсяг змін

- [ ] Як обробляти useSearchParams?
  - Чому це важливо: Next.js useSearchParams повертає URLSearchParams, TanStack Router useSearch повертає типізований обʼєкт
  - Варіант A: Адаптер конвертує useSearch() у URLSearchParams-подібний API (рекомендовано)
  - Варіант B: Рефакторити всі споживачі під типізований обʼєкт
  - **Важливо:** в `@simplycms/admin` є файли (наприклад `DiscountEdit.tsx`, `DiscountGroupEdit.tsx`) які активно використовують `.get()`, `.toString()` на результаті useSearchParams. Адаптер має повертати **сумісний з URLSearchParams інтерфейс**
  - Вплив: обсяг змін, type-safety

- [ ] Чи залишати workspace packages як transpilePackages?
  - Чому це важливо: Next.js мав `transpilePackages` в config. Vite працює з workspace packages інакше
  - Варіант A: Vite з `optimizeDeps.include` для workspace пакетів
  - Варіант B: Публікувати пакети як pre-built ESM
  - Вплив: build pipeline, DX

## Рекомендовані патерни

### Root route як HTML shell

`src/routes/__root.tsx` має містити повний HTML shell: `<html>`, `<head>` з `<HeadContent />`, `<body>` з `<Outlet />` і `<Scripts />`. Глобальний CSS підключається через `?url` імпорт в `head.links`. Провайдери (QueryClientProvider, ThemeProvider, CMSProvider) обгортають `<Outlet />`.

- Де шукати поточний shell: `app/layout.tsx`
- Що перенести: lang="uk", suppressHydrationWarning, ThemeProvider, Providers, Toaster, SonnerToaster
- Що НЕ переносити: `Inter` font через `next/font` (замінити на CSS), `export const metadata` (замінити на head property)

### Адаптер роутингу після перемикання

Адаптер має маппити API якомога ближче до того, як його використовують споживачі. Ключові маппінги:
- `Link` — приймає `href` prop, всередині маппить на `to` prop TanStack Router Link
- `useRouter()` — повертає обʼєкт з `.push(path)`, `.replace(path)`, `.back()` методами
- `useParams()` — generic обгортка навколо `useParams({ strict: false })`
- `usePathname()` — обгортка навколо `useLocation().pathname`

### Поступовий запуск

Спочатку створити мінімальний skeleton з одним placeholder route. Переконатися що `pnpm dev` стартує. Потім перемикати адаптери і перевіряти що typecheck проходить. Маршрути будуть додані в Phase 3-4.

## Антипатерни (уникати)

### ❌ Переносити Next.js mental model в TanStack Start
Не шукати аналоги `app/layout.tsx` → nested layouts. TanStack Start має свою модель: root route + layout routes + file routes. Не копіювати, а адаптувати.

### ❌ Тримати два framework одночасно в робочому стані
Мета — підняти TanStack Start skeleton і перемкнути адаптери. Next.js `app/` більше не буде працювати після цієї фази, і це нормально. Маршрути будуть перенесені в Phase 3-4.

### ❌ Одразу мігрувати всі routes
Ця фаза — лише skeleton + adapter rewire. Один placeholder route для перевірки що все працює. Routes переносяться в наступних фазах.

### ❌ Зберігати `"use client"` директиви
В TanStack Start немає цієї концепції. Execution boundary визначається через `createServerFn()`. Директиви потрібно видалити з усіх пакетів і тем.

## Архітектурні рішення

- **В який пакет додавати код:** корінь проєкту (`vite.config.ts`, `src/`) + зміни в `@simplycms/core/adapters/`
- **Rendering стратегія:** TanStack Start SSR за замовчуванням
- **Нові залежності:** `@tanstack/react-start`, `@tanstack/react-router`, `@tanstack/react-router-devtools`, `@vitejs/plugin-react`, `vite`
- **Залежності для видалення (пізніше):** `next`, `eslint-config-next` — фізично видаляються в Phase 7

## Цільова структура після Phase 1

```
src/
  router.tsx              # createRouter() factory
  routes/
    __root.tsx            # HTML shell, providers, global CSS
    index.tsx             # Placeholder home page
vite.config.ts            # TanStack Start + React plugin
```

## MCP Servers (за потреби)

- **context7** — для перевірки TanStack Start API: `createRouter`, `createRootRoute`, `createFileRoute`, `HeadContent`, `Scripts`, `Outlet`
- **context7** — для перевірки Vite config patterns з workspace packages

## Пов'язана документація

- `docs/tasks/migration-phase0-decouple-packages.md` — попередня фаза (prerequisite)
- `docs/tasks/simplycms_tanstack_start_migration_task.md` — загальний план міграції
- TanStack Start docs: migrate-from-next-js guide
- TanStack Start docs: build-from-scratch guide

## Definition of Done

- [ ] `vite.config.ts` існує в корені з `tanstackStart()` і `react()` плагінами
- [ ] `src/router.tsx` існує з `createRouter()`
- [ ] `src/routes/__root.tsx` існує з HTML shell, HeadContent, Scripts, Outlet, providers
- [ ] `src/routes/index.tsx` існує з placeholder контентом
- [ ] `pnpm dev` стартує TanStack Start dev server без помилок
- [ ] Placeholder сторінка відображається в браузері
- [ ] Адаптер роутингу перемкнутий на `@tanstack/react-router`
- [ ] Адаптер зображень перемкнутий на звичайний `<img>`
- [ ] Жодного `"use client"` в `packages/simplycms/` і `themes/`
- [ ] `pnpm typecheck` проходить без помилок (з урахуванням що `app/` більше не збирається)
