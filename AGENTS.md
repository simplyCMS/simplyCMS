# SimplyCMS

Open-source e-commerce CMS на **TanStack Start (Vite)** і чистому **PostgreSQL**: вітрина (SSR),
адмінка (client-side SPA), профілі, кошик, чекаут, замовлення. Ядро живе в цьому монорепо й
публікується на npmjs.

> **Мова:** відповідай і пиши коментарі в коді й документацію **українською**, навіть якщо запит
> англійською. Коментар пояснює **чому**, а не що; JSDoc для публічного API.

Файл спільний для всіх агентів і тримає лише стабільне: межі, інваріанти, дисципліну. Стан,
прогрес і черга виконання — у віхах і issues GitHub (`track status`); **не дублюй їх тут**.
Підняти контур локально — `docs/development/ENVIRONMENT.md`. Агент-специфічне — `CLAUDE.md`.
Слова проєкту — `docs/GLOSSARY.md`: слово з *Avoid* у новому тексті не вживай.

**Ієрархія джерел:** цей файл (межі) → `docs/architecture/*` (канон підсистеми) → скіли
(agent-kit і `packages/simplycms/skills/*`) → код-шар, `orient` і сам код. Суперечність між ними —
дефект: канон править код або код править канон.

---

## Принципи

- **Клієнтів і реальних магазинів немає** — зміни роби БЕЗ зворотної сумісності: старого API й
  шимів не тримаємо. 🔴 Злам коду магазину, тем чи плагінів → мажорна версія + BREAKING у
  `CHANGELOG`; нове без зламу → minor; виправлення → patch. 🔴 Оновлень магазинів попередніх
  версій до пілоту немає: жодних маніфестів, режимів CLI чи інструкцій «у магазині X.Y зроби…» —
  правка baseline дає в `CHANGELOG` лише рядок «перестворити БД». 🔴 Після `1.0.0-rc.1` те саме
  правило діє для КОДУ, але не для ДАНИХ: схема — лише новими міграціями (`docs/architecture/data-layer.md` § 7).
- **Платформа ≠ магазин.** Тут пишемо ПЛАТФОРМУ; магазин — незалежний проєкт із власною
  інфраструктурою. Платформа постачає порти, драйвери, CLI й інструкції й гарантує, що вони
  працюють у магазині.
- **Магазин — мінімумом кроків, далі агент веде за інструкціями.** Кожен ключовий крок життя
  магазину покривають скіли й скрипти, що їдуть РАЗОМ із ним (у пакеті). Зміна платформи, що міняє
  шлях власника магазину, без відповідної інструкції не завершена.
- **Архітектурна коректність, не обхідні шляхи:** явно порівнюй латку й знесення механізму, що
  породжує клас багів.
- **Невизначеність — привід запитати.** Бібліотечні API перевіряй через MCP (context7, shadcn), а
  не за памʼяттю; shadcn-компонент не додавай без звірки з реєстром.

## Пакети

OpenCart-подібна платформа: ядро постачає каркас (роути/сторінки) npm-пакетами, магазин — тонка
збірка, плагіни й теми — встановлювані одиниці. Джерело правди —
[`2026-07-30-platform-architecture-design.md`](docs/superpowers/specs/2026-07-30-platform-architecture-design.md);
решта спек — `docs/superpowers/specs/` (`orient --map "<тема>"`).

У npm рівно **5 пакетів**: ядро `simplycms` (тіри T0–T5 теками `packages/simplycms/src/*`) +
`@simplycms/{cli,theme-solarstore,plugin-faq}` + `create-simplycms-store`. Специфікатори ядра —
субшляхи `simplycms/<тека>`, не відносні шляхи й не `simplycms` з кореня зсередини самого пакета.
Тіри й напрям імпортів — `packages/README.md`; каталог тек — `docs/architecture/repository-layout.md`.

## Стек

TypeScript (strict) · TanStack Start + Router + Query (+ DB для колекцій адмінки) · Vite · React ·
pnpm workspaces · Drizzle поверх PostgreSQL 17 · Better Auth · Tailwind v4 + shadcn/ui ·
react-hook-form + Zod 4 · Tiptap v3 · Vitest + Testing Library. Версії — у `package.json`.

## Команди

```bash
pnpm gates               # ПОВНИЙ ланцюг гейтів (+ pilot); чисте дерево; штамп .gates-stamp.json — доказ для звіту
pnpm test:schema         # канон міграцій на чистий Postgres + RLS (storage/mail — pnpm harness:up)
pnpm db:rebaseline       # до 1.0.0-rc.1: перегенерація baseline; після — pnpm db:diff <name>
pnpm template:sync       # синк закомічених копій з монорепо (шаблон, файли каркаса, міграції)
pnpm release X.Y.Z       # реліз (гарди + бамп + гейти + коміт); push і PR — вручну
```

Каталог команд, порядок гейтів і причини, лінт-зони, CI — `docs/development/TOOLING.md`.

- 🔴 `install --frozen-lockfile` — після будь-якої правки `package.json` (інші гейти лок не звіряють).
- 🔴 Гейт — `format:check`, а не `format`; `pnpm lint` — 0 errors / 0 warnings: нове попередження
  лагодять, а не вимикають `eslint-disable` без причини; селектори й опції error-зон не послабляй.
- 🔴 Зелений `pnpm test` нічого не каже про опублікований пакет — це доводить `pnpm pilot` (прогін
  пакування); що доводить кожен гейт і які зони не покриті — `docs/architecture/test-contours.md`.
- 🔴 **Нові тести — за `docs/architecture/test-contours.md` § 0** (ADR-0058): одна поведінка — один рівень; перевіряй
  поведінку, а не реалізацію; мутація — лише для інваріантів, гейтів і гонок; змінюєш файл тестів —
  прибери дубль у зоні зміни.
- 🔴 **Обходи дефектів залежностей** — лише в `docs/architecture/upstream-workarounds.md` (маркери
  `UPSTREAM:<ID>` у коді). При БУДЬ-ЯКОМУ бампі залежності перевір записи; новий обхід — новий запис.

## Дослідження коду

Дві поверхні: код (де символ лежить, хто його справді кличе) — `orient <Символ>`; доки й звірка
плану з кодом — `orient --map "<тема>"` / `orient --plan <файл>`. MCP код-шару напряму не клич:
вони минають перевірку свіжості індексу. Виконавець задачі перед стартом свого issue — `orient --plan`.
Процедура — скіл `research`; код-шар — `docs/development/CODEBASE_MEMORY.md`. Тести — `run-tests`,
PR — `pr-gate`, пункт спеки — `doc <файл> §N`.

---

## Архітектурні інваріанти

Порушення будь-якого — дефект рівня blocker. Механіка й приклади — у `docs/architecture/`.

**Дані й доступ** (`docs/architecture/data-layer.md`)

- Єдиний канал до Postgres — **`withActor`** (`simplycms/db`). Браузер до БД не ходить.
- Лоадери вітрини — лише через `withStorefrontDb`/`withCustomerDb`/…; `userId` — лише з серверної
  сесії; видимість каталогу фільтрує КОД (`is_active = true`).
- 🔴 **Ключ `id` генерує викликач, не БД** — `DEFAULT gen_random_uuid()` у таблиці «Категорії A» не
  повертай.
- `queryKey` не пишеться літералом: сегмент 0 — з реєстру `simplycms/contracts/entities`;
  `collectionKey` — лише для колекцій `admin-data`.
- Дати в застосунку — `Date`; рядком лише на межі виводу.
- `createServerFn` — лише топ-рівневою константою; валідатор — `.validator(…)`.
- 🔴 Схема БД до `1.0.0-rc.1`: `schema.ts` → `pnpm db:rebaseline` → `pnpm template:sync` → ревʼю
  SQL → `pnpm test:schema`; після — `pnpm db:diff` (`docs/architecture/data-layer.md` § 7). `drizzle/**` і застосовану
  міграцію руками не правлять. Типи БД — з `simplycms/schema/types`.
- 🔴 Запис адмінки й API — лише операції реєстру `simplycms/operations`; serverFn — тонка обгортка
  (`invokeFromServerFn`), доменні функції (`*In`) і `withActor` поза `run` операції — лінт
  (`docs/architecture/operations-api.md`). Решта адмінки — `simplycms/admin-server` + `simplycms/admin-data`.
- Тексти товару — у таблицях перекладів; вітрина читає їх лише з проєкції (`docs/architecture/translations.md`).

**Роути й рендеринг** (`docs/architecture/rendering-and-routing.md`)

- Дерево роутів збирає `routes.ts` (`virtualRouteConfig`), а не сканування: 🔴 монтується лише
  `src/routes/my/`. `src/routeTree.gen.ts` не редагуй.
- SSR для вітрини, client-only (`ssr: false`) для адмінки; route-файли — тонкі обгортки без логіки.
- Request-guard `/admin` — лише в `src/start.ts` і auth-роутах.

**Теми, плагіни, UI** (`docs/architecture/themes.md`, `docs/architecture/plugins.md`, `docs/architecture/ui.md`)

- Тема постачає токени, `components` і опційно `views` пʼяти сторінок; **не** дані, роути, SEO,
  сторінки чи лейаути. Логіки в темі немає.
- Плагін ходить лише через порти `simplycms/plugin-sdk`; БД-клієнтів напряму не імпортує.
- Компоненти — `simplycms/ui`, а не дублікати; кольори й шрифти — через CSS-змінні теми.

**Межі клієнт/сервер й env** (`docs/development/ENVIRONMENT.md`)

- Server-only дерево задає `simplycms/contracts/server-only`; статичний імпорт server-only
  субшляху з клієнтського коду заборонено.
- Обовʼязкових env-ключів рівно **три**: `DATABASE_URL`, `BETTER_AUTH_SECRET`, `VITE_SITE_URL`;
  опційні — групами драйверів «все або нічого» (`simplycms/env`). Сервер читає лише `process.env`
  і лише в рантаймі; `import.meta.env` у серверних модулях заборонено.

**i18n** (`docs/architecture/i18n.md`)

- Нові рядки інтерфейсу — через `useT`/`createTranslator`; каталогів ТРИ рівні (ядро / тема /
  плагін) — не змішувати. Повноту i18n доводять тести парності, а не лінт.
- 🔴 Мова вітрини — лише з URL (`resolveRequestLocale`): без cookie, сесії й `Accept-Language`.
- 🔴 `ContentLocale` і `UiLocale` — різні типи; міст — лише `resolveUiLocale`; ключі кешу й
  читачі даних беруть лише `ContentLocale`. Мову магазину не опублікувати без пакета.

**Файли й сховище** (`docs/architecture/storage.md`)

- Файли — лише через порт `simplycms/storage`; у БД лежить референс, не URL.

**Пакети й реліз** (`docs/architecture/release-process.md`, `docs/architecture/cli.md`)

- Усі 5 пакетів завжди мають ОДНУ версію; реліз — рішення власника (`pnpm release`, далі PR у
  `main`). Копії `template/`, `packages/cli/host/`, `packages/simplycms/migrations/` синхронізує
  `pnpm template:sync` — руками не правляться.
- Скіли магазину — оригінал у `packages/simplycms/skills/<name>`; `.agents/skills/` і
  `.claude/skills/` — прямі симлінки на нього.

---

## Конвенції коду

- `camelCase` (змінні, функції, `use*`), `PascalCase` (компоненти, типи), `UPPER_SNAKE_CASE`
  (константи); файли компонентів — `PascalCase.tsx`, утиліт — `camelCase.ts`. Без `any`.
- Орієнтир — ~150 рядків на модуль (лінтом не стережеться).
- Імпорти: бібліотеки → пакети (`simplycms/<тека>`, `@simplycms/*`, `@themes/*`, `@plugins/*`) →
  локальні; без `../../..` між пакетами; імпорт угору по тірах заборонено (`eslint.tier-zones.mjs`).
- `console.log` у production-коді не лишай.

---

## Дисципліна git

- Коміти й PR підписані лише іменем власника: жодних `Co-Authored-By:` / `Generated with …`.
  Субагенти й воркфлоу можуть їх додати, тож після кожного, що комітить:
  `git log --format=%B <база>..HEAD | grep -ciE "co-authored|generated with"` — має бути `0`.
- Агенти комітять у гілках issues (`pr-gate start <issue>`) і пушать лише через
  `pr-gate open --draft`, коли це каже бриф архітектора; ніколи force, ніколи `main`. 🔴 Мерж у
  `main` робить архітектор через `pr-gate land` після приймання (ADR-0063); PR із бампом версії
  (`pnpm release`) — лише за словом власника: мерж публікує пакети на npmjs.

## Дисципліна issue

- Знахідку рев'ю й хвіст issue закривають кодом у тій самій гілці до мержу або остаточним рішенням
  із причиною; issue «на потім» без рішення власника — не завершення; продуктові розвилки йдуть
  власнику одразу.
- 🔴 **Архітектор і приймальник перевіряють передумову, а не лише рішення.** Розвилку чи знахідку
  звір з цим файлом, схваленою спекою й рішеннями власника — назви, що саме її вимагає. Нічого (чи
  протилежне) — відхили з посиланням на принцип. Задача поза схваленою спекою — зупинка й питання
  власнику.

---

## Куди дивитись далі

`docs/architecture/` (канон підсистем) · `docs/development/` (`docs/development/TOOLING.md`,
`docs/development/ENVIRONMENT.md`, `docs/development/CODEBASE_MEMORY.md`, `docs/development/lessons.md`) ·
`docs/guides/` (`docs/guides/themes.md`, `docs/guides/simplycms-redesign.md`) ·
`docs/adr/` (рішення з причиною) · `docs/GLOSSARY.md` · `docs/tasks/platform-roadmap.md` (напрям;
стан — `track status`) · `packages/simplycms/skills/` (скіли магазину).
