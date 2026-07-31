# Роадмап платформи SimplyCMS

> Похідна від специфікації
> [`docs/superpowers/specs/2026-07-30-platform-architecture-design.md`](../superpowers/specs/2026-07-30-platform-architecture-design.md)
> (джерело правди; тут — лише трекінг виконання). Створено 2026-07-30.
> Детальний імплементаційний план кожної фази пишеться перед її стартом
> (superpowers writing-plans) і посилається звідси.

## Фаза 0 — Фундамент у монорепо (без публікації) — **завершена 2026-07-31**

План виконання: [`docs/superpowers/plans/2026-07-31-phase0-foundation.md`](../superpowers/plans/2026-07-31-phase0-foundation.md)
(17 задач, гілка `feat/phase0-foundation`).

- [x] `routes.ts` + `physical()` на workspace-теки: нові пакети
      `@simplycms/storefront-routes`, `@simplycms/admin-routes`;
      `src/routes` магазину стиснуто до `__root.tsx` + `my/` (лейаути теж
      переїхали в пакет); регрес-гард `tests/virtual-routes-escape.test.ts`
- [x] Канонікалізація сторінок: сторінки з `core/pages` і `themes/*/pages` →
      `storefront-routes`; теми → `{manifest, tokens, components, settings?}`
      (новий контракт, spec §6); `theme-system` перебудовано
      (`applyTokens`, `validateThemeModule`, fallback на `default`)
- [x] Wiring плагін-контуру від `simplycms.config.ts` (одне джерело істини,
      spec §8); `bootstrapPlugins` на старті; реактивний `PluginSlot`
      (`hookRegistry.subscribe` + `useSyncExternalStore`); референс-плагін
      `plugins/hello-world`
- [x] Консолідація `@simplycms/supabase` (spec §10, зразок `@kit/supabase`);
      legacy `core/supabase/*` і `src/server/supabase.ts` знесено; `.env.example`
      оновлено (`VITE_SUPABASE_PUBLISHABLE_KEY` + legacy anon fallback).
      **Обсяг вужчий за spec-таблицю:** `server-admin`, hooks і testing-хелпери
      не увійшли — див. амендмент spec §4.0
- [x] Drizzle-baseline: `@simplycms/schema` (introspect наявної схеми → 40 таблиць
      + 93 RLS-політики в TS, snapshot у `drizzle/`, `rls-parity.test.ts`);
      конвеєр `db:diff` → ревʼю → `db:migrate`; `supabase/scripts/migrate.mjs`
      виведено з експлуатації (spec §9)
- [x] LICENSE (MIT) у корінь + `license` у всі workspace-пакети
- [x] i18n-скелет: `@simplycms/i18n` (request-scoped `createTranslator`,
      `normalizeLocale`, `I18nProvider`/`useT`, каталоги uk + en), два
      `no-restricted-syntax`-селектори проти хардкод-рядків (spec §12)
- [ ] **i18n-міграція (борг, Фаза 1+):** мігрувати ~954 кириличні входження в
      канонічних сторінках `@simplycms/storefront-routes` + адмінці
      `@simplycms/admin` (зараз warn-рівень `no-restricted-syntax`; error-зона —
      3 файли); повідомлення toast і Zod — окремий прохід (лінт JSX їх не
      бачить); після міграції **warn→error**: розширити error-зону в
      `eslint.config.mjs` з переліку файлів на весь пакет
- [x] Гігієна: guest-order token прибирається з URL після використання
      (`OrderSuccess.tsx`); SSR-повнота списків товарів — `ProductListItem` DTO
      + `SsrProductGrid`, назви/ціни в серверному HTML
- [x] Знести re-export-шими core та мертві аліаси (рішення D5 — без перехідних
      шимів). **Частково:** знесено 12 шимів core без споживачів +
      `theme-system/ThemeResolver`; шими з живими споживачами
      (`lib/priceUtils`, `lib/shipping/*`, `lib/discountEngine`, `hooks/useCart`,
      `hooks/useProductsWithStock`, частина `components/*`) лишились разом із
      самим `core` — повне розчинення `core` перенесено на Фазу 1+
- [x] Вивести з експлуатації git-subtree `simplyCMS-core` (`cms:pull`/`cms:push`
      скрипти геть) — монорепо стає єдиним джерелом (spec §4.1). *Лишається дія
      власника: заархівувати репозиторій `simplyCMS-core` (перевірено
      2026-07-31: `isArchived: false`).*
- [x] Rename scope `@simplysoftua/*` → `@simplycms/*` (384 файли) + registry
      npmjs (spec §4.1). *Лишається дія власника: створити GitHub org `simplyCMS`
      і npm org `simplycms`, зарезервувати npm-імʼя `simplycms` під CLI —
      імена перевірені 2026-07-31, вільні.*

**DoD:** магазин працює на новій топології в монорепо; `typecheck`/`lint`/`test`/
`build` зелені; регрес-тест `physical()`-механізму в CI. — **виконано.**

### Борги, свідомо винесені за межі Фази 0

- **Живі клікові смоки не виконані** (агенти без браузера): перемикання теми в
  адмінці; `/profile` під залогіненим користувачем; `/admin/plugins` →
  увімкнути плагін → віджет на дашборді без reload → вимкнути. HTTP-смоки
  (коди відповідей, наявність назв/цін у SSR-HTML) прогнані.
- **Upsert рядка `hello-world` у таблицю `plugins` не підтверджено на живій БД:**
  RLS не дає анонімного INSERT, тож `bootstrapPlugins` пише рядок лише коли на
  сайт зайде адмін (у коді є гард на сесію).
- **`prettier` відсутній у `devDependencies`:** `pnpm format` / `format:check`
  падають із `prettier: not found`, CI їх не запускає — гейти де-факто
  починаються з `pnpm lint`.
- **i18n-міграція** (~954 warn-входження) — окремий прохід, див. чекбокс вище.
- **`@simplycms/engine`** (обʼєднання `data-supabase` + `react-query`) — не
  робилось, обидва пакети живі окремо; див. амендмент spec §4.0.
- **`useAuth` лишається в `@simplycms/core/hooks`** (20 файлів-споживачів) —
  заявлений deferral, переїзд у `@simplycms/supabase` — Фаза 1+.

## Фаза 1 — Пілот пакування + production-готовність

- [ ] `npm pack` пілот: збірка магазину зі справжніх tarball-ів у чистому проєкті;
      gates зі spec §15 (server fns, bundle-guard, Tailwind `@source`, splitting)
- [ ] Розширити `published-exports-parity.test.ts` на всі пакети з роутами
- [ ] Server preset: працюючий `pnpm start` (обрати target під хостинг)
- [ ] Production `sitemap.xml`/`robots.txt` через custom server entry
      (див. [`production-seo-routes-tanstack-start.md`](./production-seo-routes-tanstack-start.md))

**DoD:** магазин із tarball-ів проходить smoke-e2e; деплой можливий.

## Фаза 2 — CLI + скаффолдер + перший реліз

- [ ] `@simplycms/cli`: `add` / `update` (+schematics для host-файлів) /
      `db:diff` / `doctor`
- [ ] `create-simplycms-store`
- [ ] Реліз-потяг v1.0 на npmjs (строгий semver; `engines.simplycms` перевірка)

**DoD:** сторонній розробник створює магазин двома командами; оновлення ядра —
один `pnpm update`.

## Фаза 3 — Plugin SDK + референс-плагіни

- [ ] `@simplycms/plugin-sdk` (`definePlugin`, порти, Zod-настройки; spec §7)
- [ ] Межа довіри: dependency-lint (плагін не імпортує повз SDK; без SupabaseClient)
- [ ] `adminRoutes` плагінів (`/admin/<slug>` монтаж) + пункт меню через слот
- [ ] 1-2 референс-плагіни (доставка, оплата) + авторський цикл
      (`create plugin` / `plugin:dev`)

**DoD:** плагін ставиться `simplycms add`, вмикається з адмінки, везе свої
таблиці (`plg_*`) і сторінки.

## Фаза 4 — Теми як пакети + маркетплейс-індекс

- [ ] Пакування тем: npm-варіант і copy-in через реєстр (вибір автора)
- [ ] Conformance-kit для авторів тем
- [ ] Репозиторій `simplycms/marketplace`: JSON-індекс (подача через PR) + вітрина

**DoD:** стороння тема встановлюється і перемикається з адмінки.

## Паралельний продуктовий трек

- [`seo-ssr-faceted-navigation.md`](./seo-ssr-faceted-navigation.md) — SEO/faceted
  navigation канонічних сторінок (підсилює головну перевагу рішення D3)
