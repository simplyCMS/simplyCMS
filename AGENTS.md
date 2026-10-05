# SimplyCMS

Open-source e-commerce CMS на **TanStack Start (Vite)** і чистому **PostgreSQL**:
повна вітрина (SSR), адмінка (client-side SPA), профілі, кошик, чекаут, замовлення.
Ядро живе в цьому монорепо й публікується на npmjs.

> **Мова:** відповідай і пиши коментарі в коді **українською**, навіть якщо запит
> англійською. Коментар пояснює **чому**, а не що.

Цей файл — спільний для всіх агентів і тримає лише стабільне: межі, інваріанти,
дисципліну. Поточний стан, прогрес, етапи й черга виконання живуть в
`docs/tasks/platform-roadmap.md` і `docs/tasks/v2-state-map.md` — **не дублюй їх тут**.
Карту чинного стану (що працює наживо, що ні, як підняти локально з нуля) читай
ПЕРШОЮ, якщо береш роботу в цій частині. Агент-специфічне — `CLAUDE.md` (Claude Code).

**Ієрархія джерел:** цей файл (межі) → `docs/architecture/*` (канон підсистеми) →
`.agents/skills/*` (процедура задачі) → код-шар, `orient` і сам код (реальний стан).
Суперечність між ними — дефект: канон править код або код править канон.

---

## Принципи

- **Клієнтів і реальних магазинів немає** — зміни роби БЕЗ зворотної сумісності.
- **Архітектурна коректність, не обхідні шляхи.** Пропонуй рішення з довгостроковим
  обґрунтуванням; явно порівнюй латку й знесення механізму, що породжує клас багів.
- **Невизначеність — привід запитати**, а не вгадати. Бібліотечні API перевіряй через
  MCP (context7, shadcn), а не за пам'яттю; shadcn-компонент не додавай без звірки з реєстром.

## Напрям і пакети

OpenCart-подібна платформа: ядро постачає каркас (роути/сторінки) npm-пакетами, магазин —
тонка збірка, плагіни й теми — встановлювані одиниці. Джерело правди —
[`2026-07-30-platform-architecture-design.md`](docs/superpowers/specs/2026-07-30-platform-architecture-design.md);
трекінг — `docs/tasks/platform-roadmap.md`.

У реєстрі npm рівно **5 пакетів**: unscoped фреймворк `simplycms` (усе ядро T0–T5 теками
`packages/simplycms/src/*`) + `@simplycms/{cli,theme-solarstore,plugin-faq}` +
`create-simplycms-store`. Специфікатори ядра — субшляхи `simplycms/<тека>`, не відносні
шляхи й не `simplycms` з кореня зсередини самого пакета (цикл модулів). Тіри й напрям
імпортів — `packages/README.md`; повний каталог тек — `docs/architecture/repository-layout.md`.

Спеки напрямку (читати перед змінами в їхній зоні): бекенд-контракт v2 —
[`2026-08-19-backend-contract-v2-design.md`](docs/superpowers/specs/2026-08-19-backend-contract-v2-design.md)
(з амендментом B3′/B5″/B13); маркетплейс —
[`2026-08-18-marketplace-platform-design.md`](docs/superpowers/specs/2026-08-18-marketplace-platform-design.md);
хмара —
[`2026-08-19-cloud-platform-design.md`](docs/superpowers/specs/2026-08-19-cloud-platform-design.md);
консолідація пакетів —
[`2026-08-20-package-consolidation-design.md`](docs/superpowers/specs/2026-08-20-package-consolidation-design.md).

## Стек

TypeScript (strict) · TanStack Start + Router + Query (+ DB для колекцій адмінки) · Vite ·
React · pnpm workspaces · **Drizzle поверх чистого PostgreSQL 17** · **Better Auth** ·
Tailwind v4 + shadcn/ui · react-hook-form + Zod 4 · Tiptap v3 · Vitest + Testing Library.
Версії — у `package.json`. 🔴 **TypeScript свідомо 5.9, не 6/7** — блокер `typescript-eslint`
(`docs/development/TOOLING.md` § 1, реєстр `UPSTREAM:TSESL-1`).

---

## Команди

```bash
pnpm dev                 # dev-сервер (Vite + TanStack Start)
pnpm typecheck && pnpm lint && pnpm format:check   # перед PR
pnpm test                # юніти (packaging-suite виключено)
pnpm test:schema         # накат канону міграцій на чистий Postgres + поведінка RLS (Docker не потрібен)
pnpm db:diff <name>      # schema.ts → SQL-міграція (ревʼю обовʼязкове)
pnpm build:packages      # збірка публікованих пакетів
pnpm template:sync       # синк закомічених копій з монорепо (шаблон, host CLI, міграції)
pnpm release X.Y.Z       # реліз (гарди + бамп + гейти + коміт); push і PR — вручну
```

**Порядок гейтів:** `pnpm install --frozen-lockfile → format:check → lint → build → typecheck →
test → test:schema → build:packages → typecheck:template → test:packaging`.
Повний каталог команд, причини порядку, лінт-зони й CI — `docs/development/TOOLING.md`;
змінні оточення й запуск у проді — `docs/development/ENVIRONMENT.md`.

- 🔴 `install --frozen-lockfile` — після будь-якої правки `package.json`: інші гейти
  `pnpm-lock.yaml` не звіряють, звичайний `pnpm install` мовчки лагодить розсинхрон.
- 🔴 Гейт саме `format:check`: `pnpm format` (`--write`) не червоніє. Не форматується
  (`.prettierignore`): генерат, артефакти збірки і всі `*.md`.
- 🔴 `build` перед `typecheck` (генерує `src/routeTree.gen.ts`); `typecheck:template` — окремий
  гейт після `build:packages` (кореневий `tsconfig.json` шаблон не бачить).
- 🔴 **Норма `pnpm lint` = 0 errors / 8 warnings** (`react-hooks/*`, `no-unused-vars`). Не «лагодь»
  число без причини; селектори й опції error-зон не послабляй — кожне кастомне правило має
  негативний контроль тестом і власне імʼя плагіна.
- 🔴 Зелений `pnpm test` нічого не каже про опублікований пакет: що доводить кожен гейт
  (пілот A/B/C/D/CLI/TOOL, tarball-parity) і які зони не покриті —
  `docs/architecture/test-contours.md`.
- 🔴 **Обходи дефектів залежностей** — один реєстр `docs/architecture/upstream-workarounds.md`
  (маркери `UPSTREAM:<ID>` у коді). При БУДЬ-ЯКОМУ бампі залежності перевір її записи; новий
  обхід — новий запис, не лише коментар.

---

## Дослідження коду

Дві поверхні, плутати не можна: код (де символ лежить, хто його справді кличе) —
`codebase-memory-mcp` (MCP-інструменти або `orient <Символ>`); доки й звірка плану з кодом —
`orient --map "<тема>"` / `--plan <файл>`. Без код-шару `orient <Символ>` чесно відмовляє, а не
грепає: греп через барелі бреше на «хто кличе». Процедура й формат звіту — скіл
`codebase-research`; канон тулінгу — `docs/development/CODEBASE_MEMORY.md`.

```bash
.agents/skills/codebase-research/scripts/orient --map "<тема>"   # тема людською мовою → канон
.agents/skills/codebase-research/scripts/orient --plan <файл>    # якорі плану ↔ код
.agents/skills/codebase-research/scripts/orient <Символ>         # де лежить + хто кличе
.agents/skills/codebase-research/scripts/orient --doctor         # стан індексу й шару доків
```

| Роль | Код | Доки й план |
| --- | --- | --- |
| Розвідник (незнайома підсистема) | код-шар | `orient --map "<тема>"` |
| **Виконавець задачі** | вільний пошук і читання | `orient --plan <файл>` **перед стартом свого блоку** |
| Рев'ювер / верифікатор | код-шар — лише повнота охоплення | вільний пошук і читання |

---

## Архітектурні інваріанти

Порушення будь-якого — дефект рівня blocker. Механіка й приклади — у `docs/architecture/`.

**Дані й доступ** (`docs/architecture/data-layer.md`)

- Єдиний канал до Postgres — **`withActor`** (`simplycms/db`: транзакція + GUC актора +
  `SET LOCAL ROLE`). Браузер до БД не ходить — усе через серверні функції.
- Лоадери вітрини ходять у БД лише через `withStorefrontDb`/`withCustomerDb`/… ; `userId`
  береться лише з серверної сесії; видимість каталогу фільтрує КОД (`is_active = true`).
- 🔴 **Ключ `id` генерує викликач, не БД** — у таблицях «Категорії A» немає
  `DEFAULT gen_random_uuid()`; не повертай його в схему.
- `queryKey` не пишеться літералом: сегмент 0 — з реєстру `simplycms/contracts/entities`;
  `collectionKey` (`[entity,'list']`) — лише для колекцій `admin-data`.
- Дати в застосунку — `Date`; рядком лише на межі виводу.
- Серверні функції: `createServerFn` лише топ-рівневою константою; валідатор — `.validator(…)`.
- Схема БД: правка `schema.ts` → `pnpm db:diff` → ревʼю SQL → `pnpm test:schema`. Міграції
  **не** через Supabase MCP (він лише для інспекції). Генератора типів БД немає — типи нового
  коду з `simplycms/schema/types`.
- Адмінка пишеться на `simplycms/admin-server` + `simplycms/admin-data`; `supabase-js` — застарілий
  шар, що переписується; вітрина його не імпортує.

**Роути й рендеринг** (`docs/architecture/rendering-and-routing.md`)

- Дерево роутів збирає `routes.ts` (`virtualRouteConfig`), а не сканування `src/routes`:
  🔴 монтується лише `src/routes/my/` — файл поруч із `__root.tsx` роутом не стане. Не редагуй
  `src/routeTree.gen.ts`.
- SSR для вітрини, client-only (`ssr: false`) для адмінки; route-файли — тонкі обгортки без логіки.
- Request-guard для `/admin` — у `src/start.ts`; guard-логіку за межі `src/start.ts` і auth-роутів
  не виносити.

**Теми, плагіни, UI** (`docs/architecture/themes.md`, `plugins.md`, `ui.md`)

- Тема постачає токени, `components` і опційно `views` пʼяти сторінок; **не** дані, роути, SEO,
  сторінки чи лейаути (`theme.pages`/`MainLayout` видалені свідомо). Логіки в темі немає.
- Плагін ходить лише через порти `simplycms/plugin-sdk` (межа довіри); Supabase-шар не імпортує.
- Компоненти `simplycms/ui`, а не дублікати; кольори й шрифти — через CSS-змінні теми.

**Межі клієнт/сервер й env** (`docs/development/ENVIRONMENT.md`)

- Server-only дерево задає `simplycms/contracts/server-only`; статичний імпорт server-only
  субшляху з клієнтського коду заборонено (лінт + Gate C пілота).
- Контракт магазину — рівно **три** env-ключі: `DATABASE_URL`, `BETTER_AUTH_SECRET`,
  `VITE_SITE_URL`. Серверний код читає **лише** `process.env` і лише в рантаймі; `import.meta.env`
  у серверних модулях заборонено лінтом.

**i18n** (`docs/architecture/i18n.md`)

- Нові рядки інтерфейсу — через `useT`/`createTranslator`; кириличний літерал у зоні валить лінт.
  Каталогів ТРИ рівні (ядро / тема / плагін) — не змішувати. Зелений лінт повноти i18n не доводить —
  доводять тести парності.

**Файли й сховище** (`docs/architecture/storage.md`)

- Файли — лише через порт `simplycms/storage`; у БД лежить референс, не URL; прямі виклики
  `supabase.storage` заборонені.

**Пакети й реліз** (`docs/architecture/release-process.md`, `cli.md`)

- Усі 5 пакетів завжди мають ОДНУ версію; реліз — рішення людини (`pnpm release`, далі PR у
  `main`; мерж публікує на npmjs). Копії `template/`, `packages/cli/host/`,
  `packages/simplycms/migrations/` синхронізує `pnpm template:sync` під тестом парності — руками
  не правляться.
- Агентні скіли, що їдуть у магазини, живуть у `packages/simplycms/skills/<name>`; `.agents/skills/`
  і `.claude/skills/` — прямі симлінки на нього (оригінал — у пакеті).

---

## Конвенції коду

- Іменування: `camelCase` (змінні, функції, хуки `use*`), `PascalCase` (компоненти, типи),
  `UPPER_SNAKE_CASE` (константи); файли компонентів — `PascalCase.tsx`, утиліт — `camelCase.ts`.
- Strict TypeScript: без `any` — `unknown` або конкретний тип. Типи експортуй `export type`.
- Форматування тримає Prettier — не сперечайся з ним руками.
- Орієнтир — ~150 рядків на модуль (лінтом не стережеться; великий файл — привід поділити).
- Імпорти: бібліотеки → пакети (`simplycms/<тека>`, `@simplycms/*`, `@themes/*`, `@plugins/*`) →
  локальні; без `../../..` між пакетами. Тір-зони забороняють імпорт угору по тірах
  (`eslint.tier-zones.mjs`).
- Коментарі й документація — українською; JSDoc для публічного API.
- `console.log` у production-коді не лишай.

---

## Дисципліна git

- Коміти й PR підписані лише іменем власника: жодних трейлерів `Co-Authored-By:` /
  `Generated with …`. Субагенти й воркфлоу можуть додати їх попри інструкції, тож після
  будь-якого воркфлоу чи субагента, що комітить, перевір:
  `git log --format=%B <база>..HEAD | grep -ciE "co-authored|generated with"` — має бути `0`.
- Комітити й пушити — лише коли власник явно про це попросив.

---

## Куди дивитись далі

- **`docs/architecture/`** — канон підсистем: `data-layer`, `rendering-and-routing`, `ui`,
  `themes`, `plugins`, `storage`, `i18n`, `cli`, `release-process`, `test-contours`,
  `upstream-workarounds`, `repository-layout`.
- **`docs/development/`** — `TOOLING.md` (команди, гейти, лінт, CI), `ENVIRONMENT.md` (env, запуск),
  `CODEBASE_MEMORY.md` (код-шар пошуку).
- **`docs/guides/themes.md`** — посібник по темах; **`docs/guides/redesign-from-reference.md`** — редизайн за референсом.
- **`docs/tasks/`** — роадмап (`platform-roadmap.md`), карта чинного стану (`v2-state-map.md`).
- **`.agents/skills/`** — процедури: `codebase-research`, `code-review`, `redesign-from-reference`.
