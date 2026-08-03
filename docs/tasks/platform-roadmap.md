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
- [x] Вивести з експлуатації git-subtree колишнього core-дзеркала (`cms:pull`/`cms:push`
      скрипти геть) — монорепо стає єдиним джерелом (spec §4.1); репозиторій-дзеркало
      видалено власником (2026-07-31).
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
- ~~**`prettier` відсутній у `devDependencies`**~~ — **закрито 2026-07-31**:
  `prettier@3.9.6` (exact) встановлено, `format`/`format:check` розширено на весь
  репозиторій, репо відформатовано (343 файли). `.prettierignore` виключає
  машинний генерат (роут-трі, типи Supabase, Drizzle-схема + `drizzle/`),
  артефакти збірки і всі `*.md`. Крок `Format check` є в CI (job `typecheck`).
- **i18n-міграція** (~954 warn-входження) — окремий прохід, див. чекбокс вище.
- **`@simplycms/engine`** (обʼєднання `data-supabase` + `react-query`) — не
  робилось, обидва пакети живі окремо; див. амендмент spec §4.0.
- **`useAuth` лишається в `@simplycms/core/hooks`** (20 файлів-споживачів) —
  заявлений deferral, переїзд у `@simplycms/supabase` — Фаза 1+.

## Фаза 1 — Пілот пакування + production-готовність

- [X] `npm pack` пілот: збірка магазину зі справжніх tarball-ів у чистому проєкті;
      gates зі spec §15 (`scripts/pilot-pack.mjs` + `tests/pilot/store-template/`:
      Gate A — множина route-id зі скретч-`routeTree.gen.ts` збігається з монорепо
      й імпорти ведуть у `node_modules`; Gate B — production-запуск, server fns,
      SEO-ендпойнти, admin-guard; Gate C — bundle-guard і code-splitting по
      модульному графу (`emitBundleStats`); Gate D — Tailwind бачить утиліти
      пакетів. CI job `pilot`: manual + weekly)
- [X] Розширити `published-exports-parity.test.ts` на всі пакети з роутами
      (parity рахується по **розпакованому tarball-у**, а не по `package.json`;
      виведено з `pnpm test` у `pnpm test:packaging` + CI job `packaging`)
- [X] Server preset: працюючий `pnpm start` (`src/server.ts` через
      `server.entry` + node-runner `server.mjs`: `sirv(dist/client)` +
      fetch-handler, `/api/health`)
- [X] Production `sitemap.xml`/`robots.txt` через custom server entry
      (SEO-інтерсептор у `src/server.ts`; dev-плагін знято. Задачу
      `production-seo-routes-tanstack-start.md` видалено як виконану —
      політика «тільки актуальне»)

**DoD:** магазин із tarball-ів проходить smoke-e2e; деплой можливий. — ✅ **Закрито
2026-08-01:** фінальний прогін `node scripts/pilot-pack.mjs` — gates A-D зелені,
гейти монорепо зелені в канонічному порядку.

🔴 **Урок DoD-прогону (єдиний блокер, який зловив саме пілот).** Перший прогін дав
`Gate C: FAIL` — `@simplycms/supabase/dist/server-client.js` у клієнтському бандлі.
Причина: Task 4.1 поклав **звичайну** функцію `checkIsAdmin` поруч із
`createServerFn`-обгортками в `storefront-routes/src/server/auth.ts`. Start вирізає
з клієнта тіла serverFn-хендлерів (їхній серверний імпорт стає невживаним і зникає),
а звичайна функція лишається живим експортом — і в опублікованому пакеті, де tsup
склеїв сусідні модулі в один чанк, клієнтський `import { getUser } from
'…/server/auth'` тягнув за собою серверний Supabase. Фікс — окремий модуль
`src/server/is-admin.ts`. **Правило на майбутнє:** у модулі, який імпортують
клієнтські роути, не має бути не-`createServerFn` експортів, що торкаються
`server-client`. У монорепо це невидиме (Vite вирізає невживане з сирців) — ловить
лише `pnpm pilot`.

### Борги, свідомо винесені за межі Фази 1

- **Живі клікові смоки Фази 0 так і НЕ виконані** (рішення власника — лишаються
  боргом): перемикання теми в `/admin/themes`; логін → `/profile` на
  `ProtectedShell` → sign-out; `/admin/plugins` → увімкнути `hello-world` →
  віджет на дашборді без reload → вимкнути. Причина — потрібні адмінські
  креденшели, яких у середовищі агентів немає. Код-передумови зняті
  (робоча інвалідація теми, атомарний plugin-toggle), гейти пілота покривають
  лише HTTP-рівень.
- **Пілот не перевіряє візуальний рендер:** Gate D звіряє наявність утиліт у
  зібраному CSS, а не картинку — фінальна візуальна перевірка теж у боргу вище.

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
