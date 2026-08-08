# Роадмап платформи SimplyCMS

> Похідна від специфікації
> [`docs/superpowers/specs/2026-07-30-platform-architecture-design.md`](../superpowers/specs/2026-07-30-platform-architecture-design.md)
> (джерело правди; тут — лише трекінг виконання). Створено 2026-07-30.
> Детальний імплементаційний план кожної фази пишеться перед її стартом
> (superpowers writing-plans) і посилається звідси.

---

## 📍 Поточний стан (оновлено 2026-08-08)

**Фази 0 і 1 завершені. Ядро опубліковане на npmjs — `@simplycms/*@0.2.1`, усі 21
пакет, плюс unscoped `create-simplycms-store` тієї ж версії (разом 22).**

Що це означає практично: магазин створюється однією командою
(`pnpm create simplycms-store`) і збирається зі справжніх npm-пакетів, без
монорепо. Пакети публічні, subpath-и резолвляться, типи компілюються під
`tsc --strict`, route-пакети везуть `routes/` сирцями.

### Що працює

| Механізм | Команда / точка входу |
|----------|----------------------|
| Створення магазину | `pnpm create simplycms-store` — скаффолдер у реєстрі з 2026-08-04 |
| Реліз ядра | `pnpm release X.Y.Z` → PR у `main` → push публікує на npmjs |
| Пілот пакування (без БД) | `pnpm pilot:pack` — gates A/C/D/CLI, Gate E видимо SKIP |
| Пілот проти живої БД | `pnpm pilot` — + Gate B, потребує `.env.local`; Gate E досі SKIP |
| Пілот на локальному стеку | `pnpm pilot:e2e` — gates A/C/D/CLI/B/E, потребує Docker; ✅ прожито 2026-08-04 |
| Production-запуск | `pnpm build && pnpm start` (`server.mjs`, порт 3000) |
| CI на PR | `typecheck` · `test` · `packaging` (tarball-parity) |

Процес релізу описано в
[`docs/architecture/release-process.md`](../architecture/release-process.md) —
включно з таблицею помилок npm (401/402/403), які вже траплялися насправді.
Межі тестування — [`docs/architecture/test-contours.md`](../architecture/test-contours.md).

### 🔴 Що НЕ зроблено — важливо для наступної сесії

1. **Живі клікові смоки — закриті ЧАСТКОВО** (2026-08-04, `test-contours.md` §8.5):
   плагін (вмикання/вимикання без reload), перемикання теми і `/profile` під
   залогіненим пройдені руками; перемикання теми при цьому виявило дефект, який
   виправлено. Незакритим лишається **invite-лист через Mailpit** — ланка
   «GoTrue рендерить наш `invite.html`» не перевірена ніким: Gate E б'є в роут
   напряму через `generateLink`, обходячи сам лист.
2. **Автоматичних браузерних тестів немає** — усі клікові перевірки ручні.
   Передумова для них — постійний магазин замість одноразового скретча в `/tmp`
   (`test-contours.md` §5, план `apps/dev-store`).
3. **Пілот у CI не ганяється** — свідомо: він потребує бази, тобто зовнішнього
   стану, від дрейфу якого гейт червонів би без регресії коду. Прогін перед
   релізом — відповідальність розробника.
4. **i18n-міграція** — борг Фази 0 (954 warn-входження у 68 файлах: 795 в
   `@simplycms/admin`, 159 в `@simplycms/storefront-routes`), warn-зона
   ESLint-селекторів досі warn, а не error. Каталог `@simplycms/i18n` поки
   скелет — 6 файлів-споживачів, тож це не механічна заміна, а проєктування
   набору ключів.
5. **Серверний env запікається в білд** — навіть `createServerSupabase`
   (`packages/supabase/src/server-client.ts`) читає
   `import.meta.env`, тож ротація Supabase-ключів вимагає перезбірки.
   Борг: перевести server-only читання на `process.env` усередині хендлерів
   (офіційний патерн TanStack Start). Не блокує Фазу 2 (спека 2026-08-03, §8).
6. **Gate F — установка з реального реєстру** — єдина сліпа зона пакування, що
   лишилась після міграції пілота на pnpm (`test-contours.md` §7 п.3). Має
   ганятись за розкладом, а не в PR-конвеєрі: `minimumReleaseAge` не дасть
   поставити щойно опубліковані пакети перші 24 години.

### Найдорожчий урок, який варто пам'ятати

**Монорепо приховує цілі класи поламок пакування.** `pnpm build` і `pnpm test`
зелені там, де опублікований пакет не працює: аліаси Vite резолвлять те, чого
немає в `exports`, а tree-shaking вирізає з сирців те, що в зібраному чанку
лишається живим. Пʼять таких блокерів спіймав саме `pnpm pilot` — перелік у
memory-нотатці `phase1-packaging-2026-07-31` і в розділі Фази 1 нижче.
Висновок: після будь-якої зміни `exports`, `peerDependencies`, `tsup`-конфігу,
барелів або `routes/` — ганяти пілот, а не покладатися на `pnpm test`.

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
      самим `core` — повне розчинення `core` перенесено на Фазу 1+.
      **Перелік не вичерпний** (аудит 2026-08-03): у `core` також живуть із
      зовнішніми споживачами `hooks/useBanners`, `useDiscountedPrice`,
      `usePriceType`, `useProductReviews`, `useStock`, `lib/supabase.ts`
      (auth-хелпери), `lib/bannerUtils`, `providers/CMSProvider`,
      `components/NavLink`, `components/ThemeToggle`; а `lib/shipping/findZone.ts`
      і частина `useProductsWithStock` — власна логіка, не re-export-шими
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

- ~~**Проміжна тека `packages/simplycms/`**~~ — **закрито 2026-08-04**: 21 пакет
  ядра піднято на рівень вище, у `packages/*`, тека видалена разом із мертвим
  `packages/simplycms/package.json` (`simplycms-packages`, `private`, з інертним
  npm-полем `workspaces` — pnpm його не читав, у workspace він не входив).
  Вкладеність була точкою subtree-дзеркала окремого core-репо; саме дзеркало
  вивели з експлуатації 2026-07-31, а форму каталогу — ні. Цільова розкладка
  `packages/*` уже стояла в спеці (§4.1). 🔴 Побічний ефект, важливіший за
  переїзд: чотири скрипти (`release/bump.mjs`, `pack-inspect.mjs`,
  `audit-deps/collect.mjs`, `audit-exports/collect.mjs`) відрізняли «пакет ядра»
  за ШЛЯХОМ — тепер за ІМЕНЕМ (`@simplycms/`). Позиційний дискримінатор ламався
  від будь-якого переїзду, іменний — ні. Виняток `STANDALONE_PACKAGE_DIRS`,
  доданий тижнем раніше під скаффолдер, зник за непотрібністю.
- **Живі клікові смоки — виконані частково 2026-08-04** (`test-contours.md`
  §8.5): перемикання теми в адмінці ✅ (виявило дефект — виправлено),
  `/profile` під залогіненим ✅, `/admin/plugins` → плагін вмикається й
  вимикається без reload ✅. Незакритим лишився invite-лист через Mailpit.
  HTTP-смоки (коди відповідей, наявність назв/цін у SSR-HTML) прогнані.
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
- **`useAuth` лишається в `@simplycms/core/hooks`** (22 файли-споживачі,
  перевірено grep-ом 2026-08-03) — заявлений deferral, переїзд у
  `@simplycms/supabase` — Фаза 1+.

## Фаза 1 — Пілот пакування + production-готовність

- [X] `npm pack` пілот: збірка магазину зі справжніх tarball-ів у чистому проєкті;
      gates зі spec §15 (`scripts/pilot-pack.mjs` + `tests/pilot/store-template/`:
      Gate A — множина route-id зі скретч-`routeTree.gen.ts` збігається з монорепо
      й імпорти ведуть у `node_modules`; Gate B — production-запуск, server fns,
      SEO-ендпойнти, admin-guard; Gate C — bundle-guard і code-splitting по
      модульному графу (`emitBundleStats`); Gate D — Tailwind бачить утиліти
      пакетів. CI job `pilot` існував на момент DoD, прибраний 2026-08-03 —
      див. «Доробки» нижче)
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

- ~~**Живі клікові смоки Фази 0 не виконані**~~ — **виконані 2026-08-04**, крім
  invite-листа. Стали можливими після встановлення Docker: локальний стек дає
  service_role-ключ, яким власник створюється без адмінських креденшелів
  хмарного проєкту. Результати — `test-contours.md` §8.5; процедура — §8.3.
- **Пілот не перевіряє візуальний рендер:** Gate D звіряє наявність утиліт у
  зібраному CSS, а не картинку — фінальна візуальна перевірка теж у боргу вище.

### Доробки після закриття Фази 1 (2026-08-08)

- **Пілот ставить скретч через `pnpm`, а не `npm`** — закрито сліпу зону №2
  `test-contours.md`. Причина: магазин декларує `pnpm@11.20`, і політики pnpm 11
  (`allowBuilds`, `minimumReleaseAge`) під npm — мовчазний no-op; саме це
  сховало дефект `allowBuilds`, що поїхав у реліз `0.2.0`. Механізм примусу
  локальних tarball-ів переїхав із npm-івського `overrides` у `package.json` у
  ключ `overrides:` файлу `pnpm-workspace.yaml` скретча.
- **Гард провенансу** (`scripts/pilot-pack/provenance.mjs`). Потрібен саме
  тепер: раніше поламка механізму tarball-ів була голосною (пакетів у реєстрі
  не існувало), а відколи там лежить та сама версія — стала мовчазною, і пілот
  зеленів би на **вже опублікованих** пакетах. Негативний контроль пройдено:
  з вимкненим механізмом 17 із 20 пакетів приїхали з реєстру.
- 🔴 **Перший же прогін на pnpm спіймав живий дефект магазину.** Gate C упав:
  3 клієнтські чанки замість 207, уся адмінка й tiptap в initial-чанку.
  Code-splitter TanStack Router шукає роут у `TSR_ROUTES_BY_ID_MAP` за
  module-id від Vite (realpath через `.pnpm/`), а генератор заповнив мапу
  шляхами через симлінк — ключі не збігаються, сплітінг не застосовується.
  Тобто **кожен магазин, поставлений через pnpm, віз увесь застосунок одним
  чанком**, і жоден контур цього не бачив. Виправлено `realpathSync` у
  `template/routes.ts`; після фікса — точний паритет із плоским деревом.
  План: [`2026-08-08-pilot-pnpm-migration.md`](../superpowers/plans/2026-08-08-pilot-pnpm-migration.md)
- **README для всіх 22 пакетів** — картка в реєстрі npm перестала бути порожньою.

### Доробки після закриття Фази 1 (2026-08-03)

Зроблені вже після DoD, у тій самій гілці — тому не в чеклісті вище:

- **Пілот розщеплено на три режими** (`pilot:pack` / `pilot` / `pilot:e2e`).
  Причина: в одному прогоні були змішані детерміністична пакувальність
  (Gates A/C/D — не залежать від БД) і функціональний e2e (Gate B — брав очікувані
  назви товарів із живої бази, тож дрейф даних червонив би гейт без регресії коду).
- **Детерміністичний сід:** `scripts/pilot-pack/seed-fixtures.mjs` — єдине джерело
  правди, з нього генерується `supabase/seed.sql` (`pnpm pilot:seed`),
  `tests/pilot-seed.test.ts` стереже парність. Gate B на сіді вимагає **всі**
  очікувані назви й називає зниклу.
- **Weekly-крон і CI-job пілота прибрано** — див. п.3 «Поточного стану».
- **Публікація переведена з GitHub Packages на npmjs.** Стара була заглушена
  `if: false` (після переносу репо в org `simplyCMS` scope перестав збігатися з
  власником → гарантований 403) і публікувала список із 6 пакетів — стан до Фази 1.
- **`pnpm release X.Y.Z`** — гарди + бамп + 8 гейтів + коміт;
  `docs/architecture/release-process.md` — повна інструкція.
- **Перший реліз `0.1.0` опубліковано 2026-08-03.** Перша спроба впала з
  `403 … bypass 2fa enabled is required` — токен без обходу 2FA. Реєстр лишився
  чистим (падіння на першому ж пакеті), після заміни токена на Granular із
  «Bypass 2FA» усі 21 пакет опубліковано.

## Фаза 2 — CLI + скаффолдер + перший реліз

Дизайн скаффолдера і bootstrap-у власника затверджено 2026-08-03:
[`docs/superpowers/specs/2026-08-03-create-store-owner-bootstrap-design.md`](../superpowers/specs/2026-08-03-create-store-owner-bootstrap-design.md)
(джерело правди скоупу v1; тут — лише трекінг).

- [X] `create-simplycms-store` (спека вище): пакет
      `packages/create-simplycms-store/` з вбудованим шаблоном як єдиним
      джерелом правди (пілот перебудований споживати його — `scaffold.mjs`
      бере `template/` пакета, `tests/pilot/store-template/` — тонкий оверлей
      з двох файлів); версії `@simplycms/*` у генераті = версія пакета;
      публікація тим самим реліз-потягом (`bump.mjs` сканує `packages/*`).
      2026-08-04, план —
      [`docs/superpowers/plans/2026-08-04-phase2-create-store-owner-bootstrap.md`](../superpowers/plans/2026-08-04-phase2-create-store-owner-bootstrap.md)
- [x] Bootstrap власника магазину (та сама спека): `pnpm owner:invite` у
      шаблоні — `auth.admin.inviteUserByEmail` + роль `admin` через
      service_role з консолі розробника; серверний `/auth/confirm`
      (`verifyOtp`) + сторінка set-password. Закриває живу діру: чинний
      тригер `handle_new_user` робив АДМІНОМ першого зареєстрованого
      (`20260213120000_fix_handle_new_user_trigger.sql:22-28` — знахідка
      Codex-аудиту 2026-08-04; міграція `first_user_no_auto_admin` прибирає
      це в репо — накат на живу dev-БД лишається окремою дією власника).
      ✅ **Gate E прожито наживо 2026-08-04** (`pnpm pilot:e2e`, Gates A–E +
      CLI зелені): перший signup БЕЗ ролі admin (ролей у покупця: 1);
      `owner-invite` ідемпотентний (2 прогони → 1 користувач, рядків admin: 1);
      `GET /auth/confirm` → 302 на `/auth/set-password` з auth-cookies
- [ ] `@simplycms/cli`: `add` / `update` (+schematics для host-файлів) /
      `db:diff` / `doctor` — окрема спека після скаффолдера
- [x] 🔴 **`NPM_TOKEN` розширено на `All Packages`** — 2026-08-04, блокер знято.
      Причина була не в теках, а в просторах імен: токен на scope `@simplycms`
      покриває будь-який `@simplycms/*` (навіть ще не створений — доведено
      першим релізом), але unscoped `create-simplycms-store` живе в глобальному
      просторі імен, і scope-правило до нього не дотягується; додати його в
      granular-токен наперед npm теж не дає — вибір лише з наявних пакетів.
      `All Packages` покриває і його, і майбутній unscoped `simplycms` CLI
      (Фаза 3) — процедуру повторювати не доведеться. Деталі в
      [`docs/architecture/release-process.md`](../architecture/release-process.md)
- [X] **Публікація на npmjs працює** — конвеєр готовий і перевірений у бою:
      `pnpm release X.Y.Z` → PR → push у `main` публікує. `0.1.0` опубліковано
      2026-08-03 (усі 21 пакет). Процес — `docs/architecture/release-process.md`
- [ ] Реліз-потяг **v1.0** (строгий semver; `engines.simplycms` перевірка) —
      лишається за Фазою 2; зараз версія `0.2.1` і модель версіонування
      **синхронна вручну** (усі 22 пакети одна версія). Незалежні версії
      (Changesets) — можливий крок, коли пакети підуть різними циклами.
      Уточнення (2026-08-03): поле `engines.simplycms` вже існує в маніфесті
      теми (`validateThemeModule` перевіряє лише присутність рядка); тут
      ідеться про реальну semver-перевірку сумісності версій ядра — її немає

**DoD:** сторонній розробник створює магазин двома командами; оновлення ядра —
один `pnpm update`.

**Стартова точка (виконано).** Шаблон уже живе всередині пакета —
`packages/create-simplycms-store/template/` — і є єдиним джерелом правди;
`scripts/pilot-pack/scaffold.mjs` бере його звідти, а `tests/pilot/store-template/`
лишився тонким оверлеєм із двох файлів (`vite.config.ts` + `package.json`).
Деталі та якорі — у спеці, §3.2 і §9, і в плані
[`2026-08-04-phase2-create-store-owner-bootstrap.md`](../superpowers/plans/2026-08-04-phase2-create-store-owner-bootstrap.md).
Що лишається у Фазі 2: `@simplycms/cli` (`add`/`update`/`db:diff`/`doctor`).
Дію власника з `NPM_TOKEN` виконано 2026-08-04 (токен розширено на
`All Packages`), і доказ — `create-simplycms-store@0.2.1` у реєстрі.

## Фаза 3 — Plugin SDK + референс-плагіни

- [ ] `@simplycms/plugin-sdk` (`definePlugin`, порти, Zod-настройки; spec §7)
- [ ] Межа довіри: dependency-lint (плагін не імпортує повз SDK; без SupabaseClient)
- [ ] `adminRoutes` плагінів (`/admin/<slug>` монтаж) — механізму в `routes.ts`
      немає. *Пункт меню через слот уже працює з Фази 0* (`admin.sidebar.items`
      у `AdminSidebar.tsx`, реактивний `PluginSlot`) — лишається сам монтаж роутів
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
