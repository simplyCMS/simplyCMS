# Роадмап платформи SimplyCMS

> Похідна від специфікації
> [`docs/superpowers/specs/2026-07-30-platform-architecture-design.md`](../superpowers/specs/2026-07-30-platform-architecture-design.md)
> (джерело правди; тут — лише трекінг виконання). Створено 2026-07-30.
> Детальний імплементаційний план кожної фази пишеться перед її стартом
> (superpowers writing-plans) і посилається звідси.

---

## 📍 Поточний стан (оновлено 2026-08-14)

**Фази 0 і 1 завершені. Ядро опубліковане на npmjs — `@simplycms/*@0.3.0` плюс
unscoped `create-simplycms-store` тієї ж версії.**

> Примітка до лічильника (2026-08-14): публікованих пакетів тепер **26** —
> 25 `@simplycms/*` (Фаза 3 додала `@simplycms/plugin-sdk` і
> `@simplycms/plugin-faq`; Фаза 4 додала `@simplycms/theme-solarstore`) +
> 1 unscoped скаффолдер. Усі три нові пакети стають дійсними в реєстрі **в
> момент мержу** відповідної гілки фази у `main` — за чинним правилом
> «введення нового пакета є релізним рішенням у момент мержу» (той самий
> шлях пройшов `@simplycms/cli` 2026-08-13). Історія змін —
> [`CHANGELOG.md`](../../CHANGELOG.md); перевірка публікації —
> `pnpm verify:published X.Y.Z`.

Що це означає практично: магазин створюється однією командою
(`pnpm create simplycms-store`) і збирається зі справжніх npm-пакетів, без
монорепо. Пакети публічні, subpath-и резолвляться, типи компілюються під
`tsc --strict`, route-пакети везуть `routes/` сирцями.

### Що працює

| Механізм | Команда / точка входу |
|----------|----------------------|
| Створення магазину | `pnpm create simplycms-store` — скаффолдер у реєстрі з 2026-08-04 |
| Реліз ядра | `pnpm release X.Y.Z` → PR у `main` → push публікує на npmjs |
| Пілот пакування (без БД) | `pnpm pilot:pack` — gates A/C/D/CLI/TOOL, Gate E видимо SKIP |
| Пілот проти живої БД | `pnpm pilot` — + Gate B, потребує `.env.local`; Gate E досі SKIP |
| Пілот на локальному стеку | `pnpm pilot:e2e` — gates A/C/D/CLI/TOOL/B/E, потребує Docker; ✅ прожито 2026-08-04 |
| Обслуговування магазину | `pnpm simplycms doctor` / `add` / `create plugin\|theme` / `update` / `db:diff` — `@simplycms/cli`, у магазині (2026-08-13, `create plugin` і N канонів `db:diff` — Фаза 3; `create theme` і `add --theme --copy` — Фаза 4) |
| Плагіни (SDK) | `definePlugin` + порти `@simplycms/plugin-sdk`; референс — `@simplycms/plugin-faq`; межа довіри — dependency-lint (2026-08-14) |
| Теми як пакети | npm (`@simplycms/theme-solarstore`) або copy-in (`--theme --copy`); `bootstrapThemes` синхронізує БД, адмінка — registry-aware (2026-08-14, Фаза 4) |
| Production-запуск | `pnpm build && pnpm start` (`server.mjs`, порт 3000) |
| CI на PR | `typecheck` · `test` · `packaging` (tarball-parity) |

Процес релізу описано в
[`docs/architecture/release-process.md`](../architecture/release-process.md) —
включно з таблицею помилок npm (401/402/403), які вже траплялися насправді.
Межі тестування — [`docs/architecture/test-contours.md`](../architecture/test-contours.md).

### 🔴 Що НЕ зроблено — важливо для наступної сесії

1. ~~**Живі клікові смоки**~~ — **автоматизовані 2026-08-09** разом із п. 2.
   Незакритим лишається рівно одне: **invite-лист через Mailpit** — ланка
   «GoTrue рендерить наш `invite.html`» не перевірена ніким. Gate E б'є в роут
   напряму через `generateLink`, а e2e-bootstrap ставить пароль власнику
   service_role-ключем — обидва навмисно обходять сам лист.
2. ~~**Автоматичних браузерних тестів немає**~~ — **закрито 2026-08-09**:
   `pnpm test:e2e` (Playwright Test 1.61.1, `tests/e2e/`, оркестратор
   `scripts/e2e.mjs`). Ганяє чек-ліст `test-contours.md` §8.3 (guard `/admin`,
   логін, `/profile`, перемикання теми, вмикання/вимикання плагіна) плюс
   вимір переповнення верстки по 42 роутах × 2 viewport × 2 локалі.
   🔴 Передумову «спершу `apps/dev-store`» знято як хибну: контур піднімається
   поверх наявного host-у (`vite dev` на власному порту), а одноразовість
   скретча в `/tmp` стосується контуру B (магазин із tarball-ів), не A.
   🔴 У блокуючий CI-гейт НЕ додано — той самий аргумент, що для пілота:
   потрібен Docker і ~10 ГБ образів Supabase, тобто зовнішній стан.
   **Перший же прогін окупив контур**: знайшов гідраційний мисматч цін
   (`Intl.NumberFormat` зі `style: 'currency'` віддає «₴» у Node і «грн» у
   Chromium — різні CLDR), який жоден із восьми гейтів не бачив.
3. **Пілот у CI не ганяється** — свідомо: він потребує бази, тобто зовнішнього
   стану, від дрейфу якого гейт червонів би без регресії коду. Прогін перед
   релізом — відповідальність розробника.
4. ~~**i18n-міграція**~~ — **закрито ПОВНІСТЮ 2026-08-09.**

   Перший етап покрив `storefront-routes` і `admin` (1495 рядкових вузлів у 76
   файлах). 🔴 Але аудит тим самим AST-сканером, запущеним по ВСІХ теках UI, а
   не по двох `SCANNED_ROOTS`, знайшов ще 293 хардкоджені рядки у воронці
   покупки — `checkout-ui` 123, `profile-ui` 82, `catalog-ui` 38,
   `reviews-ui` 27, `cart-ui` 13, `core/hooks` 10. Тобто `locale: 'en-US'`
   давав ЗМІШАНИЙ магазин: сторінки англійські, кошик і чекаут українські.
   Другий етап це закрив.

   Підсумок: каталог ядра — **1127 ключів у 31 модулі**, `uk` і `en`
   дзеркальні файл у файл; теми несуть **власні** каталоги (`default` 54
   ключі, `solarstore` 64) через `ThemeModule.messages` + `useThemeT()`.
   🔴 Два рівні каталогів навмисно роздільні: домішування ключів теми в
   core-`MessageKey` убило б перевірку одруків для всього ядра.

   Гард розширено з 2 тек до 14 (`SCANNED_ROOTS`) — саме його вузькість і
   дала цей борг прожити всю Фазу 1 непоміченим при зеленому тесті.

   Принагідно виправлено: **174 гомогліфи** (латинська `i` в кириличних
   словах — «Мiсто», «Прiзвище»), **плюралізація** лічильників («12 товари» →
   «12 товарів»), і **`formatShippingCost`**, який повертав український текст
   із T1-пакета, тобто ламав англійський магазин у підсумку замовлення.

   ✅ Візуальна перевірка: 42 роути × 2 viewport × 2 локалі в реальному
   Chromium. Шість ризиків верстки зі звіту PR #27 **не підтвердились** —
   «Price: low to high» = 114 px у тригері 178 px.

5. 🔴 **React-попередження «state update on a component that hasn't mounted
   yet» на ~13 сторінках адмінки** — знайдено консольним гардом e2e на першому
   прогоні (2026-08-09). React 19 лається на `setState` під час рендеру іншого
   компонента. Відтворюється, зокрема, на `/admin/orders`, `/admin/reviews` і
   на всіх `*/new`-формах. Пре-існуюче: жодну з цих сторінок гілка, що
   підключила e2e, не змінювала.
   Тимчасово в `ALLOWLIST` у `tests/e2e/support/console-guard.ts` — з
   обґрунтуванням і зобовʼязанням зняти запис РАЗОМ із фіксом, а не «щоб
   позеленіло». Корінь спільний для десятка сторінок і потребує окремого
   розслідування з React DevTools.
6. **Сім динамічних роутів адмінки не покриті e2e** — `orders/$orderId`,
   `reviews/$reviewId`, `users/$userId`, `properties/$propertyId`
   (+ вкладений `options/$optionId`), `plugins/$pluginId/settings`,
   `themes/$themeId/settings`. Їхні сторінки не мають сентинела `new` і
   працюють лише з реальним записом, тож обхід їх свідомо пропускає
   (`REQUIRES_REAL_ID` у `tests/e2e/support/admin-routes.ts`, список
   друкується у звіті прогону). Щоб покрити — треба брати id із сіду.
   🔴 Спроба «просто підставити `new`» уже була і дала сім хибних
   `400 Bad Request`: сторінка виконувала `.eq('id','new')` по `uuid`-колонці.
7. ~~**Серверний env запікається в білд**~~ — **закрито 2026-08-13** (спека
   [`2026-08-13-cli-v1-design.md`](../superpowers/specs/2026-08-13-cli-v1-design.md) §7).
   Контракт: **сервер = `process.env` у рантаймі** (усередині фабрик/хендлерів,
   не на модуль-рівні), **клієнт = `import.meta.env`** (запікається при
   `vite build`); наповнення `process.env` із `.env`/`.env.local` — у dev через
   `loadEnv` у `vite.config.ts`, у prod — `server.mjs` перед імпортом хендлера;
   реальний env процесу завжди виграє. Дуального резолву немає — відсутній
   ключ гучно падає. Наслідок: ротація Supabase-ключів = перезапуск процесу,
   БЕЗ перезбірки. Gate C розширено: `anon-client` додано в `SERVER_PAYLOAD` —
   витік серверного env-читання в клієнтський бандл ловиться машиною, а не
   падінням у користувача. Контракт стереже eslint-селектор на
   `import.meta.env` у шести серверних модулях (див. «Урок сесії» нижче —
   тест довести джерело НЕ може). 🔴 Свідома межа: ізоморфний код
   (`$productSlug.tsx` BASE_URL, `simplycms.config.ts`) лишається на
   `import.meta.env` — це клієнтський контур, значення потрібне в бандлі;
   не «недороблено».
8. **Gate F — установка з реального реєстру** — єдина сліпа зона пакування, що
   лишилась після міграції пілота на pnpm (`test-contours.md` §7 п.3). Має
   ганятись за розкладом, а не в PR-конвеєрі: `minimumReleaseAge` не дасть
   поставити щойно опубліковані пакети перші 24 години.
9. ~~**Теги релізів не ведуться**~~ — **закрито 2026-08-09.** Тег ставить CI
   кроком одразу після успішного `pnpm publish -r`, тож тег означає саме
   «опубліковано», а не «підготовлено»; крок ідемпотентний (ручний
   `workflow_dispatch`-ретрай на вже теговану версію — no-op). Гард
   `tagExists` переведено з локального `git tag --list` на
   `git ls-remote --tags origin` — у свіжому клоні він більше не сліпий.
   🔴 Ціна рішення: `pnpm release` тепер робить мережевий виклик до `origin`
   і падає офлайн. Це свідомо — фолбек на локальні теги відтворив би рівно той
   дефект, який лагодимо. Оманливий `v0.1.0` (указував на `dd822d6` часів
   scope `@simplysoftua`) видалено з remote; відновлюється
   `git tag v0.1.0 dd822d6 && git push origin v0.1.0`. Механізм —
   [`release-process.md`](../architecture/release-process.md).

10. **CLI v1 і env-контракт не прожиті браузерним/e2e контуром** — сесія
    2026-08-13 без Docker-демона: `pnpm pilot:pack` (включно з новими Gate
    C-розширенням і Gate TOOL) зелений, але `pnpm pilot:e2e` (Gate B/E проти
    живого стека — зокрема production-запуск із новим `server.mjs`-наповненням
    env) і `pnpm test:e2e` — за власником перед наступним релізом.

### Найдорожчий урок, який варто пам'ятати

**Монорепо приховує цілі класи поламок пакування.** `pnpm build` і `pnpm test`
зелені там, де опублікований пакет не працює: аліаси Vite резолвлять те, чого
немає в `exports`, а tree-shaking вирізає з сирців те, що в зібраному чанку
лишається живим. Пʼять таких блокерів спіймав саме `pnpm pilot` — перелік у
memory-нотатці `phase1-packaging-2026-07-31` і в розділі Фази 1 нижче.
Висновок: після будь-якої зміни `exports`, `peerDependencies`, `tsup`-конфігу,
барелів або `routes/` — ганяти пілот, а не покладатися на `pnpm test`.

**Уроки сесії 2026-08-13** (обидва спіймало адверсаріальне рев'ю, не гейти):

1. **Vitest не відрізняє `import.meta.env` від `process.env`** — у тестовому
   процесі `import.meta.env` транслюється в Proxy НАД `process.env`
   (`createImportMetaEnvProxy`), тобто це буквально один обʼєкт. Тест
   «сервер читає саме process.env» лишався зеленим після відкату зміни —
   вакуумний. Джерело env доводиться лише статично: eslint
   `no-restricted-syntax` на `import.meta.env` у серверних модулях
   (негативний контроль: відкат → lint error). Селектор не послабляти.
2. **Однорядкові форми ламають рядкові якорі.** `insertEntry` вставляв запис
   «після рядка з якорем», а pinned prettier згортає порожній блок в один
   рядок (`plugins: [],`) — вставка потрапляла поза дужки з exit 0 і
   «Готово». Будь-який рядковий редактор коду мусить явно обробляти
   однорядкову форму або чесно падати; «якір знайдено» ≠ «структура така,
   як очікувалось».

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
- [x] **i18n-міграція** (2026-08-09): `@simplycms/storefront-routes` і
      `@simplycms/admin` переведено на `t()` повністю — 1495 рядкових вузлів у
      76 файлах, 956 ключів у 31 модулі каталогу, `en` перекладено на 100 %.
      toast і Zod пройдені **разом із рештою рядків файлу**, а не окремим
      проходом: рефактор Zod-схеми у фабрику `buildSchema(t)` неможливо
      відокремити від інших правок того самого файлу. Повноту доводять три
      committed-тести (`i18n-coverage`, `i18n-catalog-parity`,
      `catalog-integrity`), а не зелений лінт. `warn→error` — на обидва пакети;
      `pnpm lint` = 0 errors / 13 warnings (react-hooks, не i18n)
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
- ~~**i18n-міграція**~~ — **закрито 2026-08-09**, див. чекбокс вище.
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
- ~~**Пілот не перевіряє візуальний рендер**~~ — **закрито 2026-08-09**, але не
  пілотом. Gate D і далі звіряє лише наявність утиліт у зібраному CSS; рендер
  тепер перевіряє окремий контур `pnpm test:e2e` (Playwright), який вимірює
  переповнення тексту в реальному Chromium по 42 роутах × 2 viewport × 2 локалі.
  🔴 Розподіл ролей навмисний: пілот доводить ПАКУВАННЯ (контур B, магазин із
  tarball-ів), e2e — ПОВЕДІНКУ (контур A, монорепо). Змішувати їх означало б
  зробити обидва повільними й крихкими.

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
- [x] **`@simplycms/cli` v1 — 2026-08-13**: чотири команди — `doctor` / `add` /
      `update` / `db:diff`; спека —
      [`2026-08-13-cli-v1-design.md`](../superpowers/specs/2026-08-13-cli-v1-design.md).
      Рішення про імʼя: пакет **scoped** (`@simplycms/cli`), бінарник —
      `simplycms`; unscoped npm-імʼя `simplycms` лишається дією власника
      (тонкий пакет-аліас, якщо колись знадобиться `pnpm dlx simplycms`).
      Чистий ESM `.mjs` без build-кроку; свіжий магазин отримує CLI у
      `devDependencies` шаблону. Канон host-файлів — `packages/cli/host/`,
      канон core-міграцій — `packages/schema/migrations/` у tarball схеми;
      обидва — тим самим `pnpm template:sync` + parity-тестом. Смоук
      упакованого CLI — **Gate TOOL** (не плутати з Gate CLI: той — про
      скаффолдер `create-simplycms-store`).
      🔴 Межі v1 (свідомо, спека §8): без `create plugin`/`plugin:dev`, без
      монтажу `adminRoutes` плагінів у `routes.ts`, без Drizzle-композиції
      плагінних схем у `db:diff` — усе це Фаза 3
- [x] 🔴 **`NPM_TOKEN` розширено на `All Packages`** — 2026-08-04, блокер знято.
      Причина була не в теках, а в просторах імен: токен на scope `@simplycms`
      покриває будь-який `@simplycms/*` (навіть ще не створений — доведено
      першим релізом), але unscoped `create-simplycms-store` живе в глобальному
      просторі імен, і scope-правило до нього не дотягується; додати його в
      granular-токен наперед npm теж не дає — вибір лише з наявних пакетів.
      `All Packages` покриває і його, і будь-який майбутній unscoped-пакет —
      процедуру повторювати не доведеться. (Уточнення 2026-08-13: сам CLI
      зрештою вийшов ПІД scope — `@simplycms/cli`, тож токен покривав його ще
      до створення; unscoped `simplycms` — хіба можливий тонкий аліас, дія
      власника.) Деталі в
      [`docs/architecture/release-process.md`](../architecture/release-process.md)
- [X] **Публікація на npmjs працює** — конвеєр готовий і перевірений у бою:
      `pnpm release X.Y.Z` → PR → push у `main` публікує. `0.1.0` опубліковано
      2026-08-03 (усі 21 пакет). Процес — `docs/architecture/release-process.md`
- [ ] Реліз-потяг **v1.0** (строгий semver; `engines.simplycms` перевірка) —
      лишається за Фазою 2; зараз версія `0.3.0` і модель версіонування
      **синхронна вручну** (усі 26 пакетів — 25 `@simplycms/*` + unscoped
      скаффолдер — одна версія; лічильник виріс 2026-08-13 із появою
      `@simplycms/cli`, а 2026-08-14 — з `@simplycms/theme-solarstore`,
      Фаза 4). Незалежні версії
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
Що лишається у Фазі 2 після CLI v1 (2026-08-13): реліз-потяг **v1.0**
(строгий semver + реальна перевірка `engines.simplycms`).
Дію власника з `NPM_TOKEN` виконано 2026-08-04 (токен розширено на
`All Packages`), і доказ — `create-simplycms-store` у реєстрі.

## Фаза 3 — Plugin SDK + референс-плагіни

План виконання (v1, кодова частина — 2026-08-14):
[`docs/superpowers/plans/2026-08-14-phase3-plugin-sdk.md`](../superpowers/plans/2026-08-14-phase3-plugin-sdk.md)
— 11 зафіксованих рішень Р0–Р11 і межі середовища (без Docker/БД).

- [x] `@simplycms/plugin-sdk` (`definePlugin`, порти, Zod-настройки; spec §7) —
      **2026-08-14**: `definePlugin` видає розширений `PluginModule`
      (сумісність із `bootstrapPlugins` без зміни контракту), порти v1 —
      `usePluginTable` (CRUD лише по `plg_*`, рантайм-гард префікса),
      `usePluginConfig` (читання настройок зі схемою+дефолтами), `usePluginT`
      (i18n, дзеркало `useThemeT`); `validatePluginModule` — ідіом
      `validateThemeModule` (throw + warn), кличе bootstrap.
      🔴 Разом поїхала реальна semver-перевірка `engines.simplycms`
      (утиліта `@simplycms/objects/semver` + `CORE_VERSION`, бамп у
      release-скрипті, парність під тестом) — у **warn-режимі на 0.x**
      (Р5): строгий фейл лишається рішенням реліз-потяга v1.0.
      Це закриває «механізм» відповідного пункту Фази 2; строгість — ні.
- [x] Межа довіри: dependency-lint — **2026-08-14**: eslint-зона
      `no-restricted-imports` на `plugins/**` і `packages/simplycms-plugin-*/**`
      (заборона `@simplycms/supabase`, `@simplycms/data-supabase`,
      `@supabase/*`); доводить НЕ зелений лінт, а негативний контроль
      `tests/plugin-trust-boundary.test.ts` (синтетичне порушення в зоні й
      поза нею). Адмінка зведена до одного шляху мутації (Р8):
      toggle → `usePluginToggle`, uninstall → `uninstallPlugin`,
      runtime-`InstallPluginDialog` знято (build-time lifecycle §7).
- [x] `adminRoutes` плагінів — **2026-08-14**: механізм — `physical()`-рядок
      у store-owned `routes.ts` (якір-коментар для CLI в host і template;
      у магазині — через realpathSync-хелпер, інакше мовчки зникає
      code-splitting); файли плагіна несуть запечені id `/admin/<slug>/…` і
      стають дітьми layout `/admin`. Гард — новий кейс «два physical() під
      спільним layout» у `tests/virtual-routes-escape.test.ts`; симетрію
      монорепо↔скретч стереже Gate A.
- [x] Референс-плагіни + авторський цикл — **2026-08-14, свідомо НЕ
      «доставка/оплата»** (рішення Р0/Р11 плану: оплата захардкоджена
      union-ом у воронці, `hookRegistry.execute` кличе лише `PluginSlot` —
      платіжний плагін означав би прихований рефакторинг воронки).
      Зроблено: `plugins/hello-world` → мінімальний SDK-приклад
      (слот + власний каталог i18n); **`@simplycms/plugin-faq`**
      (тека `packages/simplycms-plugin-faq`) — ПОВНИЙ контур: таблиця
      `plg_faq_items` (міграція в пакеті), adminRoutes `/admin/faq` (CRUD
      через `usePluginTable`), слот `product.detail.after`, Zod-settings,
      каталог uk/en. `simplycms create plugin <name>` скаффолдить у
      `plugins/` магазину (шаблон — `packages/cli/template-plugin/`, у
      Gate TOOL); `simplycms db:diff` розширено до N канонів
      (ядро + плагіни, `own` по обʼєднанню, SQL-лінт меж `plg_<name>_*`),
      doctor №7 узгоджено. i18n: `plugins/` і референс-пакети в
      `SCANNED_ROOTS`, парність — `tests/plugin-messages-parity.test.ts`.

**DoD:** плагін ставиться `simplycms add`, вмикається з адмінки, везе свої
таблиці (`plg_*`) і сторінки. — Кодова частина закрита; живий прогін
(`pnpm pilot:e2e` + накат `…_plg_faq_items.sql` на dev-БД) — дія власника,
разом із боргом №10 «Поточного стану».

### Борги, свідомо винесені за межі Фази 3 (v1)

- **`plugin:dev` не зроблено** (Р9): шаблон магазину — не pnpm-workspace, а
  `minimumReleaseAge=24h` блокує install щойно опублікованого пакета —
  субстрату для workspace-лінка немає. Локальний dev-loop дає
  `create plugin` у `plugins/` через готовий аліас `@plugins/*`.
- **Бізнес-емітери hooks відсутні** (Р0): `order.created` тощо декларуються,
  але ядро їх не емить — `execute` кличе лише `PluginSlot`. Серверного
  bootstrap-контуру теж немає (bootstrap — клієнтський `useEffect`).
  Введення емітерів = окрема задача з рефакторингом воронки (клієнтський
  `insert` замовлення повз `OrderRepository`).
- **`events`/`storage`-порти SDK** (спека §7) — не робились: нуль споживачів,
  таблиця `plugin_events` мертва. `edgeFunctions`/`buckets` — лише
  декларативні поля маніфеста (§9 v1).
- **`plugin:purge`** (спека §9) — команди немає; видалення плагіна лишає
  його таблиці (задекларована політика), генерація purge-міграції — пізніше.
- **`plugins.migrations_applied` ніхто не пише** — колонка-журнал готова,
  облік накачених плагінних міграцій відкладено.
- **Строгий semver `engines.simplycms`** — лишається за реліз-потягом v1.0
  (зараз warn; маніфести тем переведено на `'>=0.1.0'`).

## Фаза 4 — Теми як пакети + маркетплейс-індекс

План виконання (v1, кодова частина — 2026-08-14):
[`docs/superpowers/plans/2026-08-14-phase4-themes-as-packages.md`](../superpowers/plans/2026-08-14-phase4-themes-as-packages.md)
— 15 зафіксованих рішень Р0–Р14 і межі середовища (без Docker/БД).

- [x] Пакування тем: npm-варіант і copy-in — **2026-08-14**:
      `@simplycms/theme-solarstore` (тека `packages/simplycms-theme-solarstore`)
      — референс-тема повного контуру як npm-пакет, той самий виняток
      природи, що `@simplycms/plugin-faq`; `themes/default` лишається
      локальним еталоном fallback-токенів і зразком copy-in-форми (private,
      поза реліз-потягом). `simplycms add <pkg> --theme` (голий пакет) і
      `simplycms add <pkg> --theme --copy` (shadcn-модель: копія `src/*` у
      `themes/<key>/` зі злиттям залежностей, пакет знімається) — обидва
      шляхи зі спеки §17.4 доведені пілотом (Gate THEME-контур,
      `scripts/pilot-pack/install-themes.mjs`) реальними CLI-командами.
- [x] `bootstrapThemes` + registry-awareness адмінки — **2026-08-14**:
      дзеркало плагінного `syncPluginRows` (SELECT→missing→session-гард→
      load→batch INSERT, insert-only); `Themes.tsx` звіряє рядок БД з
      `ThemeRegistry.has(name)` → бейдж «модуль відсутній» + disabled
      активація (дзеркало `hasModule` у `Plugins.tsx`).
- [x] Conformance-kit для авторів тем — **2026-08-14**: `validateThemeModule`
      (рантайм-контракт) + doctor-перевірка №11 (warn: записи конфігу
      резолвляться, підказка про Tailwind-глоби) + монорепо-гарди
      `theme-manifest-parity`/`theme-messages-parity` на референс-пакети +
      чекліст автора в [`docs/architecture/themes.md`](../architecture/themes.md).
      `simplycms create theme <name>` — авторський скаффолд у `themes/`
      магазину (шаблон `template-theme/`, Gate TOOL).
- [x] Контракт маркетплейс-індексу в монорепо — **2026-08-14**:
      `docs/marketplace/README.md` (вимоги подачі; 🔴 гейт власника —
      подачі не приймаються, доки не ухвалено позицію щодо ліцензії
      екосистеми, спека §13) + `index.sample.json`, форма стережеться
      `tests/marketplace-index.test.ts` (Zod-схема). Репозиторій
      `simplycms/marketplace` і вітрина — окремий репо, дія власника
      (спека §4.1), поза скоупом цього монорепо.
- [x] Реліз-міна `manifest.version`-літералів — **2026-08-14**: `bump.mjs`
      переписує version-літерали маніфестів референс-пакетів
      (`plugin-faq/src/index.ts`, `theme-solarstore/src/manifest.ts`), не
      лише `package.json` — знешкоджено до того, як зламало б наступний
      `pnpm release`.

**DoD:** стороння тема встановлюється і перемикається з адмінки. — Кодова
частина закрита (обидва шляхи установки доведені пілотом на рівні збірки);
живий прогін і поведінка `bootstrapThemes` проти живої RLS — дія власника
(борг нижче, разом із боргом №10 «Поточного стану»).

### Борги, свідомо винесені за межі Фази 4 (v1)

- **Живе перемикання встановленої теми в адмінці** (`pnpm pilot:e2e` /
  `pnpm test:e2e`) — без Docker і живої БД у цій сесії не доводиться;
  доказовість тут — детерміністичні гейти + `pnpm pilot:pack`.
- **Селектор `tests/e2e/admin-smoke/theme.e2e.ts`** тисне ПЕРШУ кнопку
  «Активувати» в списку тем — з появою disabled-рядків (тема в БД без
  модуля) селектор може почати чіпляти не той рядок. Уточнення — дія
  власника при живому прогоні (`docs/architecture/themes.md` §6).
- **Межа довіри на теми не вводиться** (Р10, свідомо) — тема законно
  споживає `@simplycms/supabase`/`@simplycms/core` за контрактом v2;
  theme-sdk із портами (аналог `@simplycms/plugin-sdk`) — окрема фаза,
  якщо колись знадобиться.
- **Uninstall-рядка теми з адмінки немає** — деактивація (`is_active: false`)
  достатня для v1; видалення «осиротілого» рядка (тема в БД без модуля,
  наприклад `solarstore` у свіжому магазині) — SQL руками, задокументовано в
  `docs/architecture/themes.md` §5.
- **Строгий semver `engines.simplycms`** — лишається за реліз-потягом v1.0
  (warn-режим уже працює, той самий компроміс, що в плагінів).
- **Позиція щодо ліцензії екосистеми** (спека §13) — рішення власника,
  блокує прийом реальних подач у маркетплейс-індекс.

## Трек: контракт теми v2.2 — типографіка, шрифти теми, розчинення brand-*

Не фаза платформи, а версія КОНТРАКТУ теми (після v2 «токени замість
сторінок» і v2.1 «каталог `messages`») — передумова етапу Б скіла «редизайн
за референсом». Обґрунтування:
[`docs/superpowers/research/2026-08-15-theme-contract-expansion.md`](../superpowers/research/2026-08-15-theme-contract-expansion.md)
(§5 «Горизонт 1»); задача:
[`theme-contract-v2_2.md`](./theme-contract-v2_2.md); план виконання (v2,
після адверсаріального ревʼю — 11 рішень Р1–Р11):
[`docs/superpowers/plans/2026-08-15-theme-contract-v2_2.md`](../superpowers/plans/2026-08-15-theme-contract-v2_2.md).
Амендмент спеки — §6.2.

- [x] Типографічні токени — **2026-08-15**: `'font-sans'` і `'font-heading'`
      у `ThemeTokenValues`/`TOKEN_KEYS` (значення — повний CSS
      `font-family` stack рядком; прецедент не-кольорового токена —
      `radius`); `h1..h6` у `@layer base` беруть `--font-heading`;
      `tailwind.config.ts` (корінь + template) перейшов на `var()` разом із
      обовʼязковими fallback-ами в `:root` `globals.css` — невизначена
      `var()` у `font-family` робить УСЮ декларацію недійсною, тож без них
      чистий магазин злетів би з Inter. Два core-заголовки Home
      (`ProductCarousel`, `BannerSlider`) перевели з `font-serif` на
      `font-heading` — utilities-шар Tailwind v4 виграє в base, інакше
      токен на них не діяв би.
- [x] `ThemeModule.fonts` — **2026-08-15**: опційний масив абсолютних
      `https:`-URL зовнішніх stylesheet-ів; фільтр `safeFontStylesheets`
      (субшлях-експорт `@simplycms/themes/safeFontStylesheets` — НЕ barrel,
      бо barrel тягне `getActiveThemeSSR` → `anon-client` і затягнув би
      серверний код у клієнтський бандл), рендер `ThemeFonts` в обох
      каркасах поруч із `ThemeTokens`, мʼяка перевірка форми у
      `validateThemeModule`. Носії: `@simplycms/theme-solarstore` декларує
      `fonts` + `'font-sans'` (нуль візуальних змін), `themes/default` —
      без `fonts` (опційність жива), `template-theme` CLI — закоментовані
      приклади + розділ README.
- [x] Розчинення brand-* — **2026-08-15**: `--brand-*` і `colors.brand`
      видалені після grep-доказу нуля споживачів; три utility-класи
      `.gradient-brand*` зберегли імена, але фарбуються `--primary`
      активної теми (точні зупинки — Р6 плану). Наслідок для DoD: тепер
      перемикання теми перефарбовує градієнти воронки.

**DoD:** тема задає шрифт вітрини кодом і міняє його перемиканням з адмінки
без перезбірки; градієнти воронки належать контракту теми. — Кодова
частина закрита детерміністичними гейтами + `pnpm pilot:pack`; живий
браузерний прогін — дія власника (Docker), як у Фазі 4.

### Борги, свідомо винесені за межі v2.2

- 🔴 **Живий SSR-доказ fonts-контуру в пілоті** (Р9). Зараз контур доводять
  лише DB-free компонентні тести
  (`packages/storefront-routes/src/__tests__/theme-fonts*.test.tsx`, другий —
  на реальному модулі `@simplycms/theme-solarstore`). Розширити Gate D
  НЕМОЖЛИВО за його природою — він читає лише зібраний
  `dist/client/assets/*.css` і HTML не бачить; SSR HTML асертить лише Gate B
  (жива БД, поза `pilot:pack`), де голий маркер `fonts.googleapis.com` до
  того ж вічнозелений через базовий Inter-`<link>` у `__root.tsx`. Ціна
  доказу: `SEED_THEME='solarstore'` у фікстурах пілота + перегенерація
  `supabase/seed.sql` + розрізнюваний (не-Inter) маркер шрифту — свідомо
  відкладено, бо чіпає сід, від якого залежать інші гейти.
- **Горизонт 2 (page-presentation overrides) і горизонт 3 (секційна
  модель)** — рішення-кандидати, не зобовʼязання; обґрунтування і ціна —
  ресерч §5. Рішення D2–D4 спеки лишаються чинними: сторінок тема не несе.
- **`@font-face`/self-hosted шрифти теми і preconnect-оптимізації** — npm-тема
  не має каналу статики; поява такого каналу — окреме рішення.
- **UI налаштувань шрифтів в адмінці** — тема задає шрифти кодом; `settings`
  як канал типографіки — окрема історія.
- **Темізація адмінки і `--sidebar-*`** — не чіпалися свідомо (адмінка темою
  не фарбується).
- **Реліз/бамп версій** — трек міняв `exports` і вміст tarball-ів
  `@simplycms/themes`, `@simplycms/storefront-routes`,
  `@simplycms/theme-solarstore`; коли це поїде в реєстр — рішення власника.

## Паралельний продуктовий трек

- [`seo-ssr-faceted-navigation.md`](./seo-ssr-faceted-navigation.md) — SEO/faceted
  navigation канонічних сторінок (підсилює головну перевагу рішення D3)
