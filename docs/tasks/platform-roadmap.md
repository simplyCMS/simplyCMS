# Роадмап платформи SimplyCMS

> Похідна від специфікації
> [`docs/superpowers/specs/2026-07-30-platform-architecture-design.md`](../superpowers/specs/2026-07-30-platform-architecture-design.md)
> (джерело правди; тут — лише трекінг виконання). Створено 2026-07-30.
> Детальний імплементаційний план кожної фази пишеться перед її стартом
> (superpowers writing-plans) і посилається звідси.

## Фаза 0 — Фундамент у монорепо (без публікації)

- [ ] `routes.ts` + `physical()` на workspace-теки: нові пакети
      `@simplysoftua/storefront-routes`, `@simplysoftua/admin-routes`;
      `src/routes` магазину стискається до `__root` + лейаути + `my/`
- [ ] Канонікалізація сторінок: сторінки з `core/pages` і `themes/*/pages` →
      `storefront-routes`; теми → `{manifest, tokens, components, settings}`
      (новий контракт, spec §6); перебудова `theme-system`
- [ ] Wiring плагін-контуру від `simplycms.config.ts` (одне джерело істини,
      spec §8); `loadPlugins` на старті; деградація при розсинхроні конфіг↔БД
- [ ] Консолідація `@simplysoftua/supabase` (spec §10, зразок `@kit/supabase`);
      знесення legacy `core/supabase/*`; оновити `.env.example`
      (`VITE_SUPABASE_PUBLISHABLE_KEY`)
- [ ] Drizzle-baseline: `@simplysoftua/schema` (introspect наявної схеми → TS + RLS),
      конвеєр `db:diff` → ревʼю → Supabase CLI; вивести з експлуатації
      `supabase/scripts/migrate.mjs` (spec §9)
- [ ] LICENSE (MIT) у корінь + `license` у всі пакети
- [ ] i18n-скелет: каталоги повідомлень ядра (uk + en), лінт проти хардкод-рядків
      (spec §12)
- [ ] Гігієна: прибрати guest-order token з URL після використання
      (`OrderSuccess.tsx`); перевірити SSR-повноту списків товарів
      (`curl /catalog` — назви/ціни в HTML), за потреби винести enrichment на сервер
- [ ] Знести re-export-шими core та мертві аліаси (рішення D5 — без перехідних шимів)

**DoD:** магазин працює на новій топології в монорепо; `typecheck`/`lint`/`test`/
`build` зелені; регрес-тест `physical()`-механізму в CI.

## Фаза 1 — Пілот пакування + production-готовність

- [ ] `npm pack` пілот: збірка магазину зі справжніх tarball-ів у чистому проєкті;
      gates зі spec §15 (server fns, bundle-guard, Tailwind `@source`, splitting)
- [ ] Розширити `published-exports-parity.test.ts` на всі пакети з роутами
- [ ] Server preset: працюючий `pnpm start` (обрати target під хостинг)
- [ ] Production `sitemap.xml`/`robots.txt` через custom server entry
      (див. [`production-seo-routes-tanstack-start.md`](./production-seo-routes-tanstack-start.md))

**DoD:** магазин із tarball-ів проходить smoke-e2e; деплой можливий.

## Фаза 2 — CLI + скаффолдер + перший реліз

- [ ] `@simplysoftua/cli`: `add` / `update` (+schematics для host-файлів) /
      `db:diff` / `doctor`
- [ ] `create-simplycms-store`
- [ ] Реліз-потяг v1.0 на npmjs (строгий semver; `engines.simplycms` перевірка)

**DoD:** сторонній розробник створює магазин двома командами; оновлення ядра —
один `pnpm update`.

## Фаза 3 — Plugin SDK + референс-плагіни

- [ ] `@simplysoftua/plugin-sdk` (`definePlugin`, порти, Zod-настройки; spec §7)
- [ ] Межа довіри: dependency-lint (плагін не імпортує повз SDK; без SupabaseClient)
- [ ] `adminRoutes` плагінів (`/admin/<slug>` монтаж) + пункт меню через слот
- [ ] 1-2 референс-плагіни (доставка, оплата) + авторський цикл
      (`create plugin` / `plugin:dev`)

**DoD:** плагін ставиться `simplycms add`, вмикається з адмінки, везе свої
таблиці (`plg_*`) і сторінки.

## Фаза 4 — Теми як пакети + маркетплейс-індекс

- [ ] Пакування тем: npm-варіант і copy-in через реєстр (вибір автора)
- [ ] Conformance-kit для авторів тем
- [ ] JSON-індекс маркетплейсу + вітрина

**DoD:** стороння тема встановлюється і перемикається з адмінки.

## Паралельний продуктовий трек

- [`seo-ssr-faceted-navigation.md`](./seo-ssr-faceted-navigation.md) — SEO/faceted
  navigation канонічних сторінок (підсилює головну перевагу рішення D3)
