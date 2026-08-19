# Роадмап платформи SimplyCMS

> Джерела правди (спеки; тут — лише трекінг виконання):
> [`2026-07-30-platform-architecture-design.md`](../superpowers/specs/2026-07-30-platform-architecture-design.md)
> (база; читати з ревізіями D3′/D4′ і D7′) ·
> [`2026-08-19-backend-contract-v2-design.md`](../superpowers/specs/2026-08-19-backend-contract-v2-design.md)
> (бекенд v2, ревізія D7) ·
> [`2026-08-18-marketplace-platform-design.md`](../superpowers/specs/2026-08-18-marketplace-platform-design.md)
> (маркетплейс) ·
> [`2026-08-19-cloud-platform-design.md`](../superpowers/specs/2026-08-19-cloud-platform-design.md)
> (хмара) ·
> [`2026-08-17-theme-contract-v3-views-design.md`](../superpowers/specs/2026-08-17-theme-contract-v3-views-design.md)
> (theme views — виконано). Детальний імплементаційний план кожного треку
> пишеться перед стартом (superpowers writing-plans) і посилається звідси.
> Переписано 2026-08-19: виконані Фази 0–4 і трек тем/клонування стиснуто
> до архіву (§«Виконано»), повна історія — у git цього файлу і в планах фаз.

---

## 📍 Поточний стан (оновлено 2026-08-19)

**Фази 0–4 і трек «теми + клонування дизайну» завершені. Ядро опубліковане
на npmjs — 26 пакетів однією версією `0.3.0`** (25 `@simplycms/*` +
unscoped `create-simplycms-store`). Магазин створюється
`pnpm create simplycms-store` і збирається зі справжніх npm-пакетів; CLI
(`simplycms doctor/add/create/update/db:diff/theme:conformance`), плагіни
(SDK + референси), теми за контрактом v3 (tokens/fonts + опційні views
пʼяти сторінок під conformance-гейтом), контракт маркетплейс-індексу —
працюють. Механізм «редизайн за референсом» обкатаний чотирма живими
прогонами; його результат — нинішня `themes/default` із власними view-ами.

### Що працює

| Механізм | Команда / точка входу |
|----------|----------------------|
| Створення магазину | `pnpm create simplycms-store` |
| Реліз ядра | `pnpm release X.Y.Z` → PR у `main` → push публікує на npmjs (+тег) |
| Пілот пакування (без БД) | `pnpm pilot:pack` — gates A/C/D/CLI/TOOL |
| Пілот проти живої БД / локального стека | `pnpm pilot` / `pnpm pilot:e2e` (Docker) |
| Браузерний e2e | `pnpm test:e2e` (Playwright, локальний стек, 2 локалі) |
| Обслуговування магазину | `pnpm simplycms doctor / add [--theme\|--plugin] [--copy] / create plugin\|theme / update / db:diff` |
| Плагіни | `definePlugin` + порти `@simplycms/plugin-sdk`; референс — `@simplycms/plugin-faq`; межа довіри — dependency-lint |
| Теми | контракт v3: v2.2 (tokens+components+messages+fonts) + опційні `views` пʼяти сторінок (`@simplycms/objects/views`); npm або copy-in; `bootstrapThemes` |
| Conformance тем | `pnpm simplycms theme:conformance` + kit `@simplycms/themes/conformance` (негативний контроль живим експериментом) |
| Редизайн за референсом | скіл `redesign-from-reference` (дискавері → інспекція → мапінг → side-by-side → шліфування) |
| Production-запуск | `pnpm build && pnpm start` (`server.mjs`) |
| CI на PR | `typecheck` · `test` · `packaging` · `www` |

Реліз-процес — [`release-process.md`](../architecture/release-process.md);
межі тестування — [`test-contours.md`](../architecture/test-contours.md).

### 🎯 Стратегічний напрям (затверджено власником 2026-08-19)

🔴 **У проєкту немає клієнтів і реальних магазинів — зворотна сумісність
не підтримується, різати по живому безпечно і правильно** (розширення D5
на весь стек). Затверджена звʼязка з трьох треків, у цьому порядку
залежностей:

1. **Бекенд-контракт v2** (ревізія D7): сервер-first дані (браузер не
   ходить у БД; PostgREST/GoTrue/supabase-js зникають), Better Auth,
   storage-порт, чистий Postgres як контракт (Supabase — один із
   підтримуваних провайдерів), «стек швидкості» вітрини (full-page кеш +
   CDN + фасети) і agent-readiness (JSON-LD скрізь, AI-robots) — усе одна
   реструктуризація. Іде ПЕРЕД відкриттям подач маркетплейсу (заморозка
   контрактів портів першим стороннім пакетом). Трек A (theme views)
   встиг завершитись ДО V2 — його контракту V2 не чіпає: переписуються
   контейнери/лоадери (шар даних), view-model-и і view-и лишаються.
2. **Маркетплейс**: модель поставки ухвалена (П1–П5: платформа і
   безкоштовні пакети — npmjs; платні — власний сервер доставки, лише
   scoped); реєстр `simplycms/marketplace` + вітрина на simplycms.dev.
3. **Хмара** (`simplycms/platform`, окремий приватний репо): Dokploy,
   1 магазин = контейнер застосунку + Postgres; кабінет
   Account→Organization→Store; код тенанта — «без git за замовчуванням +
   Підключити GitHub»; хмара ПЕРЕД платним тіром маркетплейсу.

### Черга виконання

1. **[хвіст Б.3] Ре-валідація дискаверера проти живого референсу** (Р8):
   один прогін `discover.mjs` проти
   https://deo-ecommerce.nextjsshop-preview.workers.dev/ — очікування
   `listing = /product`, `product = /product/<slug>` без ручних правок.
   Дрібне, потребує мережі; фікстурний регрес уже в CI.
2. **Трек V2 — Бекенд-контракт v2** (спека 2026-08-19; імплементаційний
   план перед стартом). Контури К1–К6 зі спеки §4:
   - [ ] К1 Фундамент: db-шар (Drizzle-рантайм), Better Auth (сесії,
         invite власника, admin-guard), authz-хелпери
   - [ ] К2 Вітрина: лоадери/контейнери через репозиторії (злиття двох
         шляхів data-access; view-контракт v3 незмінний), full-page кеш +
         CDN-заголовки + інвалідація, waterfall/N+1-фікси, JSON-LD на
         всіх канонічних сторінках + поля повернень/доставки в схему,
         AI-robots + llms.txt, зображення (розміри/трансформації),
         **фасетна навігація** за
         [`seo-ssr-faceted-navigation.md`](./seo-ssr-faceted-navigation.md)
   - [ ] К3 Адмінка: serverFn + TanStack DB-колекції замість прямих
         Supabase-викликів
   - [ ] К4 Storage: MediaProvider — єдиний канал; драйвери local-fs/s3;
         лінт-заборона прямих викликів
   - [ ] К5 Екосистема: порти плагінів v2 (бекенд-нейтральні), порти для
         тем (знімає Р10), оновлення референсів; conformance-гейт v3 —
         серед гейтів контуру
   - [ ] К6 Тулчейн: типи з Drizzle (зникає дуальна система), пілот/e2e/
         сід під Postgres-стек, CLI/doctor, шаблон скаффолдера, доки
3. **Трек M — Маркетплейс** (спека 2026-08-18, фазування §12):
   - [ ] M-Ф0 Контракти (схема запису v2, конвенції, GDPR-мінімізація) —
         можна паралельно з V2; 🔴 блокер власника: пакет «ліцензія
         екосистеми» (спека §10.1)
   - [ ] M-Ф1 Реєстр `simplycms/marketplace` (двоступенева CI-верифікація,
         daily reverify, index на Pages) — сід референсами; **відкриття
         сторонніх подач — лише після V2-К5** (заморозка портів)
   - [ ] M-Ф2 Вітрина `/marketplace` на simplycms.dev (плановий
         SEO-пререндер + клієнтські фетчі за live-stats-патерном)
   - [ ] M-Ф3 Довірений CLI (підпис індексу, `simplycms verify`,
         doctor-звірка з advisory)
4. **Трек C — Хмара** (спека 2026-08-19) — після V2 і M-Ф2:
   - [ ] Репо `simplycms/platform`: кабінет (Account→Org→Store),
         Dokploy-драйвер провіжинінгу, бекап-контур ДО першого клієнта
   - [ ] Створення магазину в кілька кліків; домени/TLS; логи
   - [ ] Оновлення флоту хвилями з канаркою; git-режим «Підключити GitHub»
   - [ ] One-click install з вітрини (verified-only, з кроком міграцій)
   - [ ] Monaco-редактор + Remote Tunnels; eject
5. **Платний тір маркетплейсу** (спека 2026-08-18 §9.4 + §2) — за
   demand-гейтом ПІСЛЯ хмари (кількість магазинів/пакетів фіксує власник);
   перед стартом — юрисдикційні перевірки MoR (Україна як мерчант/вендор).
6. **Agent-commerce треки** (за консолідацією ринку протоколів):
   product-feed (OpenAI/Google), MCP-сервер магазину, ACP/AP2-checkout —
   окремі задачі після V2.
7. **Опційний беклог тем** (за бажанням власника, після V2): трек B
   (секційна композиція + drag-and-drop; спеки ще немає) і **кандидати
   v3.1** із валідації прогону №4 (якорі — `notes-v4.md` локально):
   `classNames`-мапа слотів; параметризація `CatalogProductGrid`
   (`columns`/`renderItem`); роутер-стаб у conformance-kit; окремий канал
   motion/reveal (IntersectionObserver vs jsdom); i18n-глоб
   `themes/*/views/**` поза eslint-зоною; скан i18n-coverage пропускає
   лише `__tests__`; гейт не бачить `display:none`.

### 🔴 Відкриті борги (консолідовано; що не тут — закрито або поглинуто треками)

1. **Invite-лист через Mailpit не прожитий** — ланка «рендер нашого
   `invite.html`» не перевірена (Gate E і e2e-bootstrap свідомо обходять
   лист). ⚠️ Флоу invite переписується у V2-К1 (Better Auth) — борг
   переїжджає туди як DoD-пункт.
2. **Пілот у CI не ганяється** (свідомо: зовнішній стан БД/Docker) —
   прогін перед релізом — відповідальність розробника.
3. **React-попередження «state update on unmounted» на ~13 сторінках
   адмінки** (React 19; ALLOWLIST у `tests/e2e/support/console-guard.ts`
   з зобовʼязанням зняти разом із фіксом). ⚠️ Кандидат на закриття у
   V2-К3 (сторінки адмінки і так переписуються на колекції).
4. **Сім динамічних роутів адмінки поза e2e** (`REQUIRES_REAL_ID` у
   `tests/e2e/support/admin-routes.ts`) — потрібні id із сіду.
5. **Gate F — установка з реального реєстру** — за розкладом, не в PR
   (`minimumReleaseAge` 24h; `test-contours.md` §7 п.3).
6. **Живі прогони Фаз 3–4 і CLI v1** (`pnpm pilot:e2e`, `pnpm test:e2e`,
   накат `…_plg_faq_items.sql` і `first_user_no_auto_admin` на dev-БД) —
   дія власника з Docker. ⚠️ Частково втратить сенс у V2 (стек БД
   міняється) — виконувати лише якщо буде реліз ДО старту V2.
7. **Downgrade `@playwright/test` заради revision-парності** з
   преінстальованим Chromium (обхід `resolveChromium()` працює) — рішення
   власника, зачіпає і `tests/e2e`.
8. **Реліз-потяг v1.0** (строгий semver, `engines.simplycms` фейл замість
   warn) — після V2, разом із відкриттям подач маркетплейсу.
9. **Незарелізені зміни tarball-ів**: треки редизайну і A міняли
   `exports`/вміст `@simplycms/themes`, `@simplycms/storefront-routes`,
   `@simplycms/theme-solarstore`, `@simplycms/objects`, `@simplycms/cli` —
   коли це їде в реєстр, рішення власника (⚠️ з урахуванням V2 попереду
   реліз до V2 може не мати сенсу).
10. **`bootstrapPlugins`/`bootstrapThemes` — клієнтський `useEffect` без
    серверного контуру; бізнес-емітери hooks (`order.created`) не
    емляться; `plugin:purge` і облік `plugins.migrations_applied`
    відсутні** — переглядаються в V2-К5.
11. **Живий SSR-доказ fonts-контуру** (Р9 етапу А редизайну) — потребує
    `SEED_THEME` у сіді пілота; переглянути після V2-К6 (сід міняється).

### Найдорожчі уроки (не забувати)

1. **Монорепо приховує цілі класи поламок пакування** — зелені
   `build`/`test` нічого не кажуть про опублікований tarball; ловить лише
   пілот (`pnpm pilot:pack` після будь-якої зміни `exports`/`peerDeps`/
   `tsup`/барелів/`routes/`). Пʼять реальних блокерів — memory-нотатка
   `phase1-packaging-2026-07-31`.
2. **Vitest не відрізняє `import.meta.env` від `process.env`** (один
   Proxy-обʼєкт) — джерело env доводиться лише статично (eslint
   `no-restricted-syntax`); селектори не послабляти.
3. **Однорядкові форми ламають рядкові якорі** (`insertEntry` vs prettier)
   — будь-який рядковий редактор коду мусить явно обробляти однорядкову
   форму або чесно падати.
4. **Дефект може приземлитись зеленим, якщо жодна фікстура не відтворює
   його форму** (Б.3: картка товару без `Product`-розмітки) — до фіксу
   писати фікстуру, що червонить.

---

## ✅ Виконано (архів; повна історія — git цього файлу і плани фаз)

**Фаза 0 — Фундамент у монорепо** (2026-07-31,
[план](../superpowers/plans/2026-07-31-phase0-foundation.md)):
`routes.ts` + `physical()` на пакети `storefront-routes`/`admin-routes`;
канонічні сторінки в ядрі, теми → контракт v2 (tokens+components);
плагін-контур зашитий від `simplycms.config.ts`; консолідація
`@simplycms/supabase`; Drizzle-baseline (`@simplycms/schema`, 40 таблиць +
93 RLS-політики) + конвеєр `db:diff`; LICENSE (MIT); i18n-скелет і повна
міграція (закрито 2026-08-09: 1127 ключів ядра, теми з власними
каталогами, гард на 14 тек); rename scope → `@simplycms`; subtree-дзеркало
виведено. Сплощення `packages/*` — 2026-08-04.

**Фаза 1 — Пілот пакування + production** (2026-08-01 +доробки 08-03/08):
`pnpm pilot` (Gates A–D) зі скретч-магазином зі справжніх tarball-ів;
`published-exports-parity` по розпакованих tarball-ах; `server.mjs`-runner;
SEO-інтерсептор (sitemap/robots). Доробки: пілот на pnpm (спіймав втрату
code-splitting через симлінк-шляхи — фікс `realpathSync` у
`template/routes.ts`), три режими пілота, детерміністичний сід, публікація
на npmjs (перший реліз `0.1.0` — 2026-08-03; граблі токенів — у
release-process.md), гард провенансу, README всіх пакетів.

**Фаза 2 — Скаффолдер + CLI** (2026-08-04…13,
[спека create-store](../superpowers/specs/2026-08-03-create-store-owner-bootstrap-design.md),
[спека CLI v1](../superpowers/specs/2026-08-13-cli-v1-design.md)):
`create-simplycms-store` з вбудованим шаблоном-джерелом правди;
bootstrap власника (`owner:invite` + `/auth/confirm` + set-password; Gate E
прожито наживо); `@simplycms/cli` v1 (doctor 11 перевірок / add / update /
db:diff; канон host-файлів і міграцій під `template:sync`+parity; Gate
TOOL); env-контракт §7 (сервер = `process.env` у рантаймі). Лишок фази —
реліз v1.0 — у «Відкритих боргах» №8.

**Фаза 3 — Plugin SDK** (2026-08-14,
[план](../superpowers/plans/2026-08-14-phase3-plugin-sdk.md)):
`@simplycms/plugin-sdk` (definePlugin + порти usePluginTable/-Config/-T);
semver-механізм `engines.simplycms` (warn на 0.x); межа довіри
dependency-lint із негативним контролем; adminRoutes плагінів через
`physical()`; референси `hello-world` і повний `@simplycms/plugin-faq`
(plg_faq_items, /admin/faq, слот, settings, i18n); `create plugin`,
`db:diff` до N канонів із SQL-лінтом меж `plg_*`. Живий прогін — борг №6.

**Фаза 4 — Теми як пакети + маркетплейс-індекс** (2026-08-14,
[план](../superpowers/plans/2026-08-14-phase4-themes-as-packages.md)):
`@simplycms/theme-solarstore` (npm-шлях) + copy-in (`add --theme --copy`),
обидва доведені пілотом; `bootstrapThemes` + registry-aware адмінка;
conformance-kit автора теми; контракт маркетплейс-індексу
(`docs/marketplace/README.md` + Zod-тест; 🔴 гейт власника на ліцензію —
тепер пакет рекомендацій у маркетплейс-спеці §10.1); реліз-міна
version-літералів знешкоджена.

**Трек редизайну за референсом** (2026-08-15…18, PR #32 + інкременти):
етап А — контракт теми v2.2 (типографічні токени `font-sans`/`font-heading`,
`ThemeModule.fonts`, розчинення brand-*); етап Б — скіл
`redesign-from-reference` зі скриптами (інспекція кольори/типографіка/
motion, дискавері сторінок із діалогом, мапінг токенів, side-by-side);
інкременти Б.1 (скрол/мультисторінковість), Б.2 (motion-капчер,
side-by-side обовʼязковий, фаза шліфування; тема лайв-тесту стала
`themes/default`), Б.3 (дискаверер v2: словники платформ, структурний
fan-out, контент-проба візиту, чесність reveal-каналу; два раунди рев'ю
закрили два хибні позитиви). Живі прогони: 2026-08-15/16 і 2026-08-18.
Хвіст — ре-валідація (черга №1); борги — №7, №9, №11.

**Трек A — контракт тем v3 «theme views»** (2026-08-18/19,
[задача](./theme-views-v3.md),
[план](../superpowers/plans/2026-08-18-theme-views-v3.md), PR #38/#40):
view-model-и пʼяти сторінок у `@simplycms/objects/views`
(+ `./views/fixtures`); `views?` у `ThemeModule`; slot-компоненти 20
комерційних реквізитів із маркерами `data-simplycms-requisite`; спліт усіх
пʼяти сторінок на container + канонічний view (`ProductDetail` 722→135,
`Catalog` 748→41 та ін.); conformance-kit `@simplycms/themes/conformance`
з негативним контролем + CLI `theme:conformance`; settings-ланцюг
доведено тестами. Жива валідація — прогін №4 (2026-08-19): default-тема —
перший реальний споживач views (`Catalog`/`CatalogSection`/`ProductDetail`),
conformance зелений обома каналами, side-by-side закрив 5 структурних
рядків прогону №2, гейти 827/827. **Трек «теми + клонування дизайну»
закрито рішенням власника 2026-08-19**; кандидати v3.1 — черга №7.
