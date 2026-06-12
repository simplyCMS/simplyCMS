# Task: Post-migration cleanup (code smells + залишки SPA)

## Контекст
Проєкт мігровано з Vite SPA (референс у `temp/`) на Next.js App Router з SSR-first підходом для storefront (див. `BRD_SIMPLYCMS_NEXTJS.md`, секції 7, 9, 10). Після міграції виявлено залишки «недоробленого» перенесення: заглушки сторінок у `app/`, розрив між theme-system (DB-driven) та реальним рендерингом storefront (hard import `@themes/default/*`), неінтегрована plugin-system, залишкові `any`, шумні `console.log`, а також ризики з guest order access token у URL.

## Вимоги
- [ ] Прибрати заглушки сторінок у `app/`, які дублюють/обходять theme/core, і підключити відповідні theme pages (без зміни UX/дизайну):
  - `app/(storefront)/cart/page.tsx`
  - `app/(storefront)/checkout/page.tsx`
  - `app/(storefront)/order-success/[orderId]/page.tsx`
  - `app/auth/page.tsx`
  - `app/(protected)/profile/page.tsx` (+ перевірити `app/(protected)/profile/layout.tsx`)
- [ ] Вирівняти theme-system з storefront SSR:
  - Storefront не має напряму імпортувати `@themes/default/pages/*` та `@themes/default/layouts/*` для фінального механізму тем.
  - Один із варіантів (обрати та реалізувати):
    - A) SSR-резолв теми на сервері (активна тема з БД + fallback), і саме її сторінки/лейаути використовуються в `app/(storefront)/*`.
    - B) Тимчасово «fixed theme» режим: прибрати/відключити DB-driven ThemeProvider/ThemeRegistry (щоб не було зайвих запитів і роздвоєної логіки).
- [ ] Інтегрувати plugin-system або явно зафіксувати як вимкнену фічу:
  - Якщо plugins мають працювати: додати ініціалізацію завантаження активних плагінів на старті (в доречному місці на клієнті/адмінці), перевірити, що `PluginSlot` реально викликається.
  - Якщо plugins поки не потрібні: прибрати/заглушити виклики і шумне логування так, щоб не вводити в оману (залишити інфраструктуру без активної поведінки).
- [ ] Прибрати залишкові `any` у публічних/інфраструктурних файлах:
  - `app/sitemap.ts` — типізувати результат `products.select('slug, updated_at, sections(slug)')` без `(product: any)`.
  - `app/api/health/route.ts` — замінити `Record<string, any>` та `(check: any)` на типізовану структуру діагностики.
  - За можливості зменшити `React.ComponentType<any>` у `packages/simplycms/theme-system/src/types.ts` через конкретні Props-інтерфейси (мінімально достатні, optional).
- [ ] Зменшити шумне логування (production smell):
  - `packages/simplycms/theme-system/src/ThemeRegistry.ts`, `packages/simplycms/theme-system/src/ThemeContext.tsx`
  - `packages/simplycms/plugin-system/src/PluginLoader.ts`
  - Вимога: не використовувати `console.log` для штатних подій у production; дозволити лише помилки або кероване debug-логування.
- [ ] Зменшити ризики guest order token у URL:
  - Зараз token додається як query param при редіректі на order-success і використовується у клієнтському запиті.
  - Мінімальний захист: після першого успішного завантаження замовлення прибрати token з URL (щоб не залишався в історії/посиланнях), не ламаючи flow.
  - Перевірити CORS/Referrer ризики для edge function `supabase/functions/get-guest-order` (не змінювати контракт без уточнення).

## Clarify (питання перед імплементацією)
- [ ] Який цільовий режим тем зараз: «динамічна тема з БД» чи «фіксована тема в коді»?
  - Чому це важливо: визначає SSR-архітектуру storefront та те, чи має `ThemeProvider` робити запит у БД.
  - Варіанти: A) dynamic (active theme з `themes` table) / B) fixed (default theme).
  - Вплив на рішення: архітектура, SSR, кешування, кількість запитів.
- [ ] Де й коли мають активуватись плагіни?
  - Чому це важливо: зараз plugin-system існує, але не видно ініціалізації в `app/`.
  - Варіанти: A) лише адмінка (client-only SPA) / B) і storefront (обережно з SSR) / C) поки вимкнено.
  - Вплив на рішення: архітектура, perf, безпека.
- [ ] Guest order token: чи допускається токен у query string, чи потрібно перейти на інший механізм?
  - Чому це важливо: query token може витікати через referrer/історію/шаринг.
  - Варіанти: A) залишаємо, але чистимо URL після використання / B) інший канал (cookie/one-time code) — потребує окремого дизайну.
  - Вплив на рішення: безпека, UX, API контракти.

## Рекомендовані патерни

### SSR-first theme resolution
Один «джерело правди» для теми у storefront:
- Storefront SSR сторінки/лейаути беруть ThemeModule з резолвера (з fallback), а не hard import default theme.
- Якщо тема динамічна — активна тема має визначатися серверно (щоб HTML відповідав темі без hydration-сюрпризів).
- Де шукати приклад/контекст: `BRD_SIMPLYCMS_NEXTJS.md` секція 7 (ThemeModule/ThemePages), секція 9 (SSR-first).

### Один routing-шар для кожної сторінки
Для cart/checkout/auth/profile/order-success має існувати один «реальний» рендер-потік: або через theme pages (re-export core pages), або через app pages — але не дві паралельні реалізації.
- Де шукати приклад: `themes/default/pages/*` (ре-експорти core pages).

### Typed diagnostics shape
Health endpoint має повертати типізований об’єкт діагностики (сталі ключі, явні типи), без `any`.
- Де шукати: `app/api/health/route.ts`.

### Controlled logging
Внутрішні системи (ThemeRegistry/PluginLoader) не мають логувати штатні події через `console.log` у production. Дозволено: `console.error` для помилок, debug-лог — лише під явним прапором.
- Де шукати: `packages/simplycms/theme-system/src/*`, `packages/simplycms/plugin-system/src/*`.

### Мінімізація витоку token з URL
Після успішного використання одноразового token прибирати його з URL, не змінюючи поточний контракт.
- Де шукати: `@simplysoftua/core/pages/Checkout`, `@simplysoftua/core/pages/OrderSuccess`.

## Антипатерни (уникати)

### ❌ Дублювання сторінок у `app/` як заглушок
Заглушки з текстом типу “Shopping Cart/Checkout/Login/Register/Welcome…” створюють хибне враження, що фіча не мігрована, і обходять існуючі core/theme реалізації.

### ❌ Hard import default theme у storefront при наявності theme-system
Якщо theme-system активний (registry + DB), але storefront завжди імпортує `@themes/default/*`, то механізм тем стає «мертвим кодом» або створює роздвоєння логіки.

### ❌ `console.log` у production ядрових систем
Постійні логи реєстрації/завантаження тем/плагінів засмічують прод-лог і ускладнюють операційну підтримку.

### ❌ `any` у публічних інфраструктурних точках
`any` у sitemap/health підриває strict TS та робить регресії непомітними.

### ❌ Редагування `temp/`
`temp/` — read-only референс; будь-які «виправлення» там не повинні робитись.

## Архітектурні рішення
- В який пакет додавати код:
  - Storefront routing/SSR: `app/`
  - Theme resolution/types: `@simplysoftua/themes`
  - Plugin init: ймовірно `@simplysoftua/core` (provider) + `@simplysoftua/plugins` (loader)
- Rendering стратегія:
  - Storefront: SSR/ISR (Server Components) + client components лише за потреби
  - Admin: client-only
  - Auth/Profile/Checkout/Cart: client-only сторінки, але через theme pages як єдиний контракт
- Міграція з temp/: лише як референс (не змінювати).

## MCP Servers (за потреби)
- **context7** — Next.js 16 proxy convention та best practices для metadata routes (sitemap/robots)
- **supabase** — перевірка рекомендацій щодо передачі токенів та edge function CORS

## Пов'язана документація
- `docs/BRD_SIMPLYCMS_NEXTJS.md` секція 7 — Theme system
- `docs/BRD_SIMPLYCMS_NEXTJS.md` секція 9 — SSR-стратегія
- `docs/BRD_SIMPLYCMS_NEXTJS.md` секція 10 — Auth/proxy
- `.github/instructions/architecture-core.instructions.md` — theme/plugin правила, temp/ read-only
- `.github/instructions/coding-style.instructions.md` — strict TS, no `any`
- `.github/instructions/tooling.instructions.md` — команди перевірки

## Definition of Done
- [ ] У `app/` немає заглушок для cart/checkout/auth/profile/order-success; сторінки підключені через theme pages або інший єдиний механізм.
- [ ] Theme system має один консистентний режим (dynamic або fixed) без «роздвоєння».
- [ ] Plugin system або інтегровано (ініціалізація + реальне використання), або явно вимкнено без шуму.
- [ ] Немає `any` у `app/sitemap.ts` та `app/api/health/route.ts`.
- [ ] Принаймні базові `console.log` з theme/plugin систем прибрані або під debug прапором.
- [ ] Token для guest order не залишається в URL після успішного завантаження.
- [ ] `pnpm typecheck` та `pnpm lint` проходять без помилок (build — якщо доступно).
