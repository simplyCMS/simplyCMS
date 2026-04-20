# Task: Phase 0 — Аудит залежностей і цільові контракти без адаптерів

## Контекст

Проєкт `simplyCMS` мігрує з Next.js App Router на TanStack Start + Vite як **один breaking change без перехідного періоду**. Це означає:

- **не потрібен** adapter-шар для роутингу або зображень;
- **не потрібна** сумісність Next.js і TanStack Start в одному коді;
- всі `next/*` залежності мають бути або прибрані, або переписані одразу під фінальні API.

Зараз Next.js API проник у `@simplycms/core`, `@simplycms/admin`, `@simplycms/theme-system` і `themes/*`. Перед імплементацією потрібно зафіксувати точний inventory і визначити фінальні контракти міграції, щоб не робити подвійний рефакторинг.

## Вимоги

- [ ] Виконати свіжий inventory усіх `next/*` імпортів у `packages/`, `themes/` і `app/`
- [ ] Розбити знайдені залежності на категорії:
  - route-aware UI (`next/link`, `next/navigation`)
  - image rendering (`next/image`)
  - server-only (`next/headers`, `next/server`, `next/cache`)
  - bootstrap/runtime (`next/font`, `next/dynamic`, `app/*`, `proxy.ts`)
- [ ] Зафіксувати список package screens, які потрібно зробити **prop-driven** на рівні route layer замість прямого читання params/search з фреймворку
- [ ] Зафіксувати список admin screens, які можна залишити route-aware і переписати напряму на `@tanstack/react-router`
- [ ] Зафіксувати список темових компонентів, де `Link`/`pathname`/`navigate` мають бути переписані напряму під TanStack Router
- [ ] Зафіксувати всі місця з `next/image` і визначити, де достатньо звичайного `<img>`, а де потрібні окремі вимоги до LCP/loading/fetchpriority
- [ ] Зафіксувати server-only файли, які **не можна переносити механічно** в packages:
  - `packages/simplycms/core/src/supabase/server.ts`
  - `packages/simplycms/core/src/supabase/proxy.ts`
  - `packages/simplycms/theme-system/src/getActiveThemeSSR.ts`
  - `app/api/revalidate/route.ts`
- [ ] Підтвердити, що `packages/simplycms/core/src/supabase/client.ts` і `anon.ts` потребують лише env migration + збереження singleton/browser pattern
- [ ] Зафіксувати кінцеве правило: **жодних adapter-модулів `@simplycms/core/adapters/*` не створювати**

## Clarify (питання перед імплементацією)

- [ ] Які package pages мають перейти на props замість прямого використання router hooks?
  - Чому це важливо: `Route.useParams()` і `Route.useSearch()` у TanStack Router route-scoped; це природно штовхає storefront pages у prop-driven модель
  - Рекомендація: storefront/core pages і theme pages робити prop-driven; admin pages можна лишати route-aware там, де це зменшує обсяг робіт
  - Вплив: архітектура, повторне використання pages, типізація

- [ ] Чи потрібен окремий універсальний image-компонент на етапі міграції?
  - Чому це важливо: тимчасова обгортка навколо `next/image` лише консервує застарілий контракт
  - Рекомендація: ні; замінювати напряму на `<img>` з коректними атрибутами, а окремий `MediaImage` вводити лише якщо після міграції з'явиться реальна продуктова потреба
  - Вплив: складність, обсяг правок, відсутність технічного боргу

- [ ] Що робити з `next-themes`?
  - Чому це важливо: пакет має Next.js у назві, але не вимагає Next.js runtime
  - Рекомендація: залишити як є, якщо він не конфліктує з новим root shell
  - Вплив: мінімізація обсягу змін

## Рекомендовані патерни

### One-shot переписування імпортів

Для `next/link`, `next/navigation`, `next/image` використовувати **фінальні** TanStack/Vite-native рішення, без проміжних alias або wrappers. Один файл має переписуватись один раз.

### Route layer керує params/search/head

Route files у `src/routes/` стають єдиною точкою, де живуть:

- `Route.useParams()`
- `Route.useSearch()`
- `head`
- `beforeLoad`
- `redirect()` / `notFound()`

Package pages і theme pages мають отримувати дані через props або route context, а не через емуляцію Next.js hooks.

### Server-only код не живе в packages

Усе, що потребує cookies, headers, response mutation, auth guards або cache invalidation, переходить у `src/server/` або `src/start.ts`. Packages мають лишитися framework-agnostic.

## Антипатерни (уникати)

### ❌ Створювати router/image adapters

Це дублює обсяг міграції: спочатку Next → adapter, потім adapter → TanStack/native. За умовами цієї міграції це зайвий крок.

### ❌ Емулювати `URLSearchParams` або `href` API заради сумісності

Якщо компонент потребує route search або dynamic params, треба або підняти це в route layer, або переписати компонент під фінальний контракт.

### ❌ Залишати server-only файли в packages як тимчасовий компроміс

`supabase/server.ts`, `supabase/proxy.ts`, `getActiveThemeSSR.ts` не мають пережити міграцію у поточному вигляді.

## Архітектурні рішення

- **В який пакет додавати код:** новий код у цій фазі не додається; це audit + фіксація цільових контрактів
- **Rendering стратегія:** без змін
- **Міграція з temp/:** не стосується
- **Залежності:** не змінюються

## Пов'язана документація

- `docs/tasks/simplycms_tanstack_start_migration_task.md` — загальний план міграції
- `docs/tasks/migration-phase1-tanstack-start-bootstrap.md` — фаза прямого переписування примітивів
- `.github/instructions/architecture-core.instructions.md`
- `.github/instructions/coding-style.instructions.md`

## Definition of Done

- [ ] Є повний inventory `next/*` залежностей по `packages/`, `themes/`, `app/`
- [ ] Кожна залежність віднесена до однієї з чотирьох категорій: route-aware UI, image, server-only, runtime/bootstrap
- [ ] Є список storefront/core pages, які переходять у prop-driven модель
- [ ] Є список admin pages, які можуть бути переписані напряму на TanStack Router
- [ ] Є список theme components для прямої заміни `Link`/navigation/image API
- [ ] Зафіксовано, що adapter-механізм повністю виключений з плану міграції
