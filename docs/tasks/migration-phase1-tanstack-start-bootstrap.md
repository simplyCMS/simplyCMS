# Task: Phase 1 — Встановлення TanStack Start і прямий breaking rewrite примітивів

> Execution note: Phase 0 вже виконана. Ця фаза є кодовою імплементацією, а не повторною інвентаризацією.
> Використовувати verified inventory з `migration-phase0-decouple-packages.md` як fixed input.
> Не переписувати task document під час виконання цієї фази. Якщо Clarify-пункт уже має рішення в Phase 0 або в цьому документі як рекомендацію, трактувати його як прийняте рішення. Зупинятись лише на суперечностях або справді нових блокерах.

## Контекст

Після Phase 0 зафіксовано, що міграція йде **без adapter-шару** і без dual-runtime. Ця фаза:

- встановлює TanStack Start + Vite;
- створює новий runtime skeleton;
- **одразу** переписує `next/link`, `next/navigation`, `next/image`, `next/font`, `next/dynamic` на фінальні рішення;
- рано прибирає Next.js з runtime-контурів проєкту замість того, щоб відкладати це до фінального cleanup.

Після цієї фази `app/` може ще тимчасово існувати як довідкове джерело при перенесенні маршрутів, але **робочим runtime уже має бути TanStack Start**.

## Прийняті рішення з Phase 0

- **Core pages — prop-driven.** Route params/search/pathname підіймаються в route layer і передаються через props.
- **Admin pages — route-aware.** `@simplycms/admin/pages/*` переписуються напряму на TanStack Router, без prop-driven adapter шару.
- **Themes — route-aware.** Theme components можуть використовувати TanStack Router напряму.
- **`next/image` → `<img>`.** Без проміжних wrapper-компонентів.
- **Adapter-шар заборонений.** Не вводити `href`/`useRouter`/`URLSearchParams` compatibility wrappers.

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
- [ ] Створити `src/start.ts` і підключити глобальний middleware pipeline, навіть якщо на цьому етапі він ще мінімальний
- [ ] Оновити `package.json` scripts: `dev`, `build`, `start` мають запускати TanStack Start через Vite
- [ ] Видалити залежності `next`, `eslint-config-next` і Next.js runtime-конфігурацію з активного шляху виконання одразу після того, як Start skeleton збирається
- [ ] Замінити **всі** `next/link` у `packages/` і `themes/` на `Link` з `@tanstack/react-router` або на prop-driven навігацію через route layer
- [ ] Замінити **всі** `next/navigation` у `packages/` і `themes/` на фінальні TanStack Router патерни:
  - `useNavigate()`
  - `useLocation()`
  - `Route.useParams()` / `Route.useSearch()` на рівні route files
  - props / route context у shared screens
- [ ] Замінити **всі** `next/image` на звичайний `<img>` з коректними `width`/`height`/`loading`/`decoding`, а для LCP-зображень — `fetchPriority`
- [ ] Замінити `next/dynamic` в адмінських route wrappers на `React.lazy()` + `Suspense` або відразу перенести маршрути в TanStack route files з code-splitting
- [ ] Замінити `next/font` на CSS `@font-face`, `fontsource` або інший Vite-сумісний спосіб підключення шрифтів
- [ ] Видалити `"use client"` директиви з усіх файлів у `packages/simplycms/` і `themes/` (вони більше не потрібні)
- [ ] **Міграція змінних оточення:** замінити `NEXT_PUBLIC_*` на `VITE_*` prefix у всіх клієнтських змінних. Зачеплені файли:
  - `packages/simplycms/core/src/supabase/anon.ts` — `process.env.NEXT_PUBLIC_SUPABASE_URL`
  - `packages/simplycms/core/src/supabase/client.ts` — `process.env.NEXT_PUBLIC_SUPABASE_URL`
  - `.env.local` — перейменувати ключі
  - В Vite доступ через `import.meta.env.VITE_*` замість `process.env.NEXT_PUBLIC_*`
- [ ] Визначити узгоджену env-strategy:
  - клієнтський код — лише `import.meta.env.VITE_*`
  - server functions / middleware — лише `process.env.*`
  - `simplycms.config.ts` — привести до одного з цих сценаріїв без змішаної моделі
- [ ] Адаптувати `supabase/client.ts`: видалити `"use client"`, зберегти singleton pattern з `typeof window !== "undefined"` guard
- [ ] Вирішити Tailwind v4 + Vite: використати `@tailwindcss/vite` плагін (замість PostCSS pipeline) або залишити PostCSS — прийняти рішення і задокументувати
- [ ] `pnpm dev` стартує TanStack Start dev server
- [ ] Placeholder index route відображається в браузері

## Clarify (питання перед імплементацією)

- [ ] Як обробляти path params у package pages?
  - Чому це важливо: `Route.useParams()` route-scoped і не повинен емулюватись через adapter
  - Прийняте рішення: storefront/core pages отримують params через props з route files; admin pages використовують TanStack Router напряму
  - Вплив: модульність, типізація, обсяг змін

- [ ] Як обробляти search params у формах адмінки?
  - Чому це важливо: частина admin pages сьогодні покладається на `URLSearchParams.get()`
  - Прийняте рішення: admin pages залишаються route-aware і використовують route-scoped TanStack Router API (`Route.useSearch()` або `getRouteApi()`) напряму, без prop-driven adapter шару
  - Вплив: зв'язність admin pages з route tree

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

### Прямий rewrite роутингу

Маппінги мають бути прямими, без проміжного сумісного API:
- `next/link` → `Link` з `@tanstack/react-router`
- `useRouter().push()` → `useNavigate()`
- `usePathname()` → `useLocation({ select: (location) => location.pathname })`
- `useParams()` / `useSearchParams()` → route layer або `getRouteApi()` там, де це виправдано

### Поступовий запуск без dual-runtime

Спочатку створити мінімальний skeleton з одним placeholder route. Після цього одразу виконати breaking rewrite `next/*` примітивів і перевести runtime на Start. Маршрути будуть доповнюватися у наступних фазах, але продакшн-модель виконання вже має бути TanStack-native.

## Антипатерни (уникати)

### ❌ Переносити Next.js mental model в TanStack Start
Не шукати аналоги `app/layout.tsx` → nested layouts. TanStack Start має свою модель: root route + layout routes + file routes. Не копіювати, а адаптувати.

### ❌ Тримати два framework одночасно в робочому стані
Після цієї фази Start має бути єдиним runtime. Двійний режим лише подовжує рефакторинг і суперечить рішенню про breaking migration.

### ❌ Емулювати `href`, `URLSearchParams` або `useRouter` через wrappers
Якщо компонент потребує нового контракту, його треба переписати під цей контракт, а не підкладати сумісний шар.

### ❌ Зберігати `"use client"` директиви
В TanStack Start немає цієї концепції. Execution boundary визначається через `createServerFn()`. Директиви потрібно видалити з усіх пакетів і тем.

## Архітектурні рішення

- **В який пакет додавати код:** корінь проєкту (`vite.config.ts`, `src/`) + прямі зміни в `packages/` і `themes/`
- **Rendering стратегія:** TanStack Start SSR за замовчуванням
- **Нові залежності:** `@tanstack/react-start`, `@tanstack/react-router`, `@tanstack/react-router-devtools`, `@vitejs/plugin-react`, `vite`
- **Залежності для видалення:** `next`, `eslint-config-next` — прибираються відразу після підняття Start skeleton

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
- [ ] Всі `next/link`, `next/navigation`, `next/image`, `next/dynamic`, `next/font` замінені на фінальні рішення без adapter-шару
- [ ] Жодного `"use client"` в `packages/simplycms/` і `themes/`
- [ ] Жодного `NEXT_PUBLIC_*` у клієнтському коді
- [ ] `pnpm typecheck` проходить без помилок
