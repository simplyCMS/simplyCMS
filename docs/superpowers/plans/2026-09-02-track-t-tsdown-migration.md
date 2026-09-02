# Трек T — міграція збірки пакетів tsup → tsdown

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Перевести збірку трьох публікованих пакетів (`simplycms`,
`@simplycms/theme-solarstore`, `@simplycms/plugin-faq`) з покинутого апстрімом
`tsup` на `tsdown`, зберігши ВСІ чинні властивості артефакту — форму
`import.meta`, дзеркало `dist/` ↔ `publishConfig.exports`, ізоляцію
server-only модулів і бюджет памʼяті збірки.

**Architecture:** Міграція поетапна й перевіряється артефактом, а не довірою
до інструмента. Спершу заводиться машинний гейт на властивість, яку міграція
може зламати мовчки (ізоляція server-only entry), потім по одному пакету й по
групах профілів переїжджає конфіг; ядро деякий час збирається ДВОМА
інструментами одночасно (наборів entry вони не перетинають), і лише коли
останній профіль переїхав, `tsup` зноситься з дерева.

🔴 **Центральне обмеження, від якого залежить уся розкладка:** у tsdown
**не можна вимкнути code splitting** — офіційний гайд міграції каже дослівно
«splitting removed — always enabled in tsdown», а розділ «Unsupported Options»
перелічує «disabling code splitting» серед непідтримуваного
(<https://github.com/rolldown/tsdown/blob/main/docs/guide/migrate-from-tsup.md>).
У нас на `splitting: false` тримаються шість профілів ядра й обидва сателіти,
причому у чотирьох випадках це не оптимізація, а **межа довіри**: server-only
код не має ділити чанк із клієнтським. Відповідь плану — **один entry на один
конфіг** для цих груп: збірка з одним входом не має з чим ділити чанки, тобто
інваріант тримається структурно, а не опцією, якої більше немає.

**Tech Stack:** tsdown 0.22.x (Rolldown 1.2.x — уже в дереві через Vite 8),
Node 24, pnpm 11.20, TypeScript 5.9, vitest 4.

**Spec:** [`docs/tasks/platform-roadmap.md`](../../tasks/platform-roadmap.md),
розділ «4. Трек T — Тулчейн збірки: міграція tsup → tsdown» (умова «гілка
магазину змержена» виконана 2026-09-02, PR #46). Межі тестування —
[`docs/architecture/test-contours.md`](../../architecture/test-contours.md),
розділ «Бюджет памʼяті збірки».

## Global Constraints

Ці вимоги діють у КОЖНІЙ задачі; окремо в кроках не повторюються.

- **Формат — тільки ESM.** `format: ['esm']` у кожному конфізі; CJS не
  зʼявляється ніде.
- **`target: 'esnext'` — у спільному base кожного конфігу, не в окремому
  профілі.** За нижчого таргета бандлер лоуерить `import.meta` у
  `var import_meta = {}`, і опублікований dist читає `{}.env.VITE_…` —
  TypeError на гідрації в магазині. Гард — `tests/dist-import-meta.test.ts`.
- **Декларації ядра емітить `tsc -p tsconfig.dts.json`, а НЕ бандлер.**
  `dts: false` у кожному конфізі пакета `simplycms`. Сателіти лишають
  генерацію декларацій бандлеру (`dts: true`) — у них по одному-два entry.
- **Кеп памʼяті `HEAP_CAP_MB = 3072` і стеля `WALL_CAP_SECONDS = 300`
  (`scripts/build-packages.mjs`) не змінюються.** Вони стережуть властивість
  збірки, а не конкретний інструмент.
- **`external` для self-reference обовʼязковий:** `/^simplycms(\/|$)/` і
  `/^@simplycms\//`. Пакет імпортує власні субшляхи bare-специфікатором; без
  явного правила бандлер вбудував би граф у кожен entry й задублював
  stateful-модулі (реєстри, пул) МОВЧКИ.
- **`dist/` лишається дзеркалом `publishConfig.exports`** (90 ключів, 20 з
  них — wildcard). Ключ entry задає вихідний шлях явно; сусідній модуль без
  export-входу мусить лишатись чанком, а не ставати entry.
- 🔴 **Опцію `exports: true` у tsdown НЕ вмикати ніколи.** Вона переписує
  `package.json` пакета; наш `publishConfig.exports` рукописний і стережеться
  `tests/published-exports-parity.test.ts`.
- 🔴 **`clean` у конфігах ядра — `false`.** Теку зносить крок `build` пакета
  один раз; конфіги збираються паралельно й чистка спільного `dist/` одним із
  них затирала б уже записане іншим. Під час перехідного стану (tsup + tsdown
  разом) це ще й обовʼязкова умова коректності.
- **Коментарі в коді — українською**, пояснюють ПРИЧИНУ, а не переказують код
  (`.github/instructions/coding-style.instructions.md`).
- **Порядок гейтів** (CLAUDE.md): `pnpm install --frozen-lockfile →
  format:check → lint → build → typecheck → test → test:schema →
  build:packages → typecheck:template → test:packaging`.
- **Мінімальний гейт кожної задачі:** `pnpm lint && pnpm test` перед комітом
  (урок Е1б: рев'ю по дифу сліпе до парність-тестів, які ламає сусідня зміна).
- Робота йде в гілці `claude/track-t-tsdown` від `main`. Прямі коміти в `main`
  заборонені — мерж у `main` публікує пакети на npm.
- 🔴 **Стан дерева на момент старту:** у робочому дереві лежать незакомічені
  правки док-синку після мержу Е1б (`CLAUDE.md`, `docs/tasks/platform-roadmap.md`,
  спека К3 — статус треку К3 і версія в реєстрі) плюс цей план. Перший крок
  Task 1 — завести гілку й закомітити їх окремим `docs:`-комітом, щоб дифи
  треку T були чистими:
  `git checkout -b claude/track-t-tsdown && git add -A docs CLAUDE.md && git commit -m "docs: синк статусу К3 після мержу Е1б"`.

---

## Мапа файлів

**Створюються:**

| Файл | Відповідальність |
|---|---|
| `tests/dist-chunk-boundary.test.ts` | Гейт: чотири server-only entry ядра — самодостатні (нуль відносних імпортів у зібраному файлі), а стаб `admin-server/index` тримає `impl` BARE-специфікатором |
| `packages/simplycms/tsdown.config.ts` | Конфіг збірки ядра: `isolated()` (один entry — один конфіг) для груп межі довіри + `grouped()` для React-тірів |
| `packages/simplycms-theme-solarstore/tsdown.config.ts` | Конфіг теми (1 entry, декларації бандлером) |
| `packages/simplycms-plugin-faq/tsdown.config.ts` | Конфіг плагіна (2 entry, кожен окремим конфігом) |

**Змінюються:**

| Файл | Що саме |
|---|---|
| `package.json` (корінь) | `tsup` → `tsdown` у `devDependencies` |
| `packages/simplycms/package.json:478` | скрипт `build`: `tsup` → `tsdown` |
| `packages/simplycms-theme-solarstore/package.json:37-38` | `build`/`prepublishOnly` |
| `packages/simplycms-plugin-faq/package.json:46-47` | `build`/`prepublishOnly` |
| `vitest.packaging.config.ts` | новий тест у `include` |
| `tests/dts-toolchain.test.ts` | читає `tsdown.config.ts` замість `tsup.config.ts` |
| `packages/simplycms/tsconfig.dts.json:2` | коментар про інструмент |
| `packages/simplycms/src/{storefront/loaders/session.ts,storefront/loaders/index.ts,storefront-routes/server/is-admin.ts,admin-server/index.ts,admin-server/impl.ts,schema/index.ts,supabase/vite-env.d.ts}` | коментарі, що називають tsup поіменно |
| `CLAUDE.md`, `docs/architecture/test-contours.md`, `docs/tasks/platform-roadmap.md` | опис тулчейна збірки |

**Видаляються:**

| Файл | Коли |
|---|---|
| `packages/simplycms/tsup.config.ts` | Task 8 (після переїзду останнього профілю) |
| `packages/simplycms-theme-solarstore/tsup.config.ts` | Task 3 |
| `packages/simplycms-plugin-faq/tsup.config.ts` | Task 2 |

## Мапа профілів: що куди їде

| Профіль ядра | entry | Сьогодні | Механізм у tsdown | Задача |
|---|---|---|---|---|
| `contracts` | 7 | `splitting: false` | `isolated()` — 7 конфігів | Task 6 |
| `plugin-sdk` | 2 | `splitting: false` 🔴 межа довіри | `isolated()` — 2 конфіги | Task 7 |
| `schema` | 3 | `splitting: false` | `isolated()` — 3 конфіги | Task 6 |
| `admin-server` | 2 | `splitting: false` 🔴 межа довіри | `isolated()` — 2 конфіги | Task 7 |
| `db` | 1 | `splitting: false`, `platform: 'node'` | `isolated()` — 1 конфіг | Task 5 |
| `auth` | 1 | `splitting: false`, `platform: 'node'` | `isolated()` — 1 конфіг | Task 5 |
| `tiers` | ~120 | `splitting: true` | `grouped()` — 1 конфіг | Task 4 |
| `storefront-routes` | ~40 | `splitting: true` | `grouped()` — 1 конфіг | Task 4 |

🔴 Для профілів `db`, `auth`, `contracts`, `schema` `splitting: false` — це
самодостатність entry (кожен .js без спільних чанків). Для `plugin-sdk` і
`admin-server` — **межа довіри**: у спільному чанку серверні імпорти
(`pg`, `drizzle-orm`, пул) опинилися б у модулі, який тягне клієнтський граф.
Саме цю пару стереже гейт Task 1 і Gate C пілота.

---

### Task 1: Гейт межі чанків

**Files:**
- Create: `tests/dist-chunk-boundary.test.ts`
- Modify: `vitest.packaging.config.ts:15-40` (список `include`)

**Interfaces:**
- Consumes: `publishableDirs()` із `scripts/pack-inspect.mjs` (уже існує).
- Produces: гейт, на який спираються Task 5–7 як на доказ ізоляції. Констант
  назовні не експортує.

Гейт заводиться ПЕРШИМ і зеленим на чинній збірці `tsup` — це baseline:
властивість, яку міграція мусить зберегти. Доказ, що він не вхолосту, —
негативний контроль у Кроці 4.

- [ ] **Крок 1: Переконатись, що `dist/` свіжий**

```bash
pnpm build:packages
```

Очікувано: `build:packages: ok за NN с під кепом 3072 МБ.`

- [ ] **Крок 2: Написати гейт**

Створити `tests/dist-chunk-boundary.test.ts`:

```ts
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Гейт межі чанків (трек T, міграція tsup → tsdown).
//
// 🔴 Що саме стережеться і чому саме так. Чотири субшляхи ядра — server-only
// за побудовою: `db` (пул Postgres), `auth` (Better Auth), `admin-server/impl`
// (фабрика + операції адмінки), `plugin-sdk/server` (порти плагінів). Сьогодні
// їхню ізоляцію тримає `splitting: false` у профілі бандлера. У tsdown цієї
// опції НЕМАЄ (офіційний гайд міграції: «splitting removed — always enabled»),
// тож інваріант мусить триматись розкладкою конфігів — один entry на конфіг.
// Цей тест перевіряє ВЛАСТИВІСТЬ АРТЕФАКТА, а не конфіг: він однаково чинний
// до міграції й після неї, і саме тому заводиться ДО неї.
//
// 🔴 Чому «нуль відносних імпортів», а не «не ділить чанк із клієнтом»: у
// зібраному ESM спільний чанк проявляється рівно як відносний імпорт
// (`../../chunk-XXXX.js`). Bare-специфікатори (`pg`, `simplycms/db`) —
// зовнішні, вони межу не порушують, а навпаки її й тримають.
//
// 🔴 Свідома межа: `storefront/loaders` сюди НЕ входить. Він живе у профілі
// зі спільними чанками (`tiers`) і має відносний імпорт уже сьогодні — його
// межу тримає не ізоляція чанка, а bare-специфікатор із боку споживача плюс
// tree-shaking бандлера магазину (доводить Gate C пілота). Додати його сюди
// означало б червонити на чинному стані.

const ROOT = resolve(import.meta.dirname, '..');
const CORE = resolve(ROOT, 'packages/simplycms/dist');

/** Субшляхи, чиї зібрані файли мусять бути самодостатніми. */
const SERVER_ONLY = [
  'db/index.js',
  'auth/index.js',
  'admin-server/impl.js',
  'plugin-sdk/server/index.js',
];

/** Статичні відносні специфікатори модуля (`./x`, `../x`). */
const relativeImports = (code: string): string[] => {
  const found = new Set<string>();
  const rx = /\bfrom\s*["'](\.[^"']*)["']|^\s*import\s*["'](\.[^"']*)["']/gm;
  for (const match of code.matchAll(rx)) found.add(match[1] ?? match[2]);
  return [...found];
};

const read = (rel: string): string => readFileSync(resolve(CORE, rel), 'utf8');

describe('межа чанків: server-only субшляхи ядра', () => {
  it('dist ядра зібраний (інакше тест мовчав би)', () => {
    expect(
      existsSync(CORE),
      'спершу `pnpm build:packages` — інакше гейт нічого не перевіряє',
    ).toBe(true);
    for (const file of SERVER_ONLY) {
      expect(existsSync(resolve(CORE, file)), `немає ${file}`).toBe(true);
    }
  });

  it.each(SERVER_ONLY)(
    '%s — самодостатній: нуль відносних імпортів',
    (file) => {
      expect(
        relativeImports(read(file)),
        `${file} ділить чанк із іншим entry — межа довіри пробита: у клієнтський ` +
          `граф може приїхати серверний код разом зі спільним чанком`,
      ).toEqual([]);
    },
  );

  it('стаб admin-server/index тримає impl BARE-специфікатором', () => {
    // На цьому розрізненні стоїть Gate C пілота: у клієнті легальний СТАБ
    // (`dist/admin-server/index`), але не нутрощі (`dist/admin-server/impl`).
    // Відносний імпорт заінлайнив би impl у стаб і зробив би різницю невидимою.
    const code = read('admin-server/index.js');
    expect(code).toContain('simplycms/admin-server/impl');
    expect(relativeImports(code)).toEqual([]);
  });
});
```

- [ ] **Крок 3: Додати гейт у packaging-suite**

У `vitest.packaging.config.ts`, у масив `include`, після рядка
`'tests/dts-toolchain.test.ts',` додати:

```ts
      // Межа чанків server-only субшляхів (трек T): ламається першою, коли
      // бандлер починає ділити чанк між серверним і клієнтським entry.
      'tests/dist-chunk-boundary.test.ts',
```

- [ ] **Крок 4: Прогнати — має бути ЗЕЛЕНО на чинній збірці**

```bash
pnpm vitest run --config vitest.packaging.config.ts tests/dist-chunk-boundary.test.ts
```

Очікувано: 6 passed (1 + 4 параметризованих + 1).

- [ ] **Крок 5: Негативний контроль — довести, що гейт червоніє**

Тимчасово злити два entry профілю `admin-server` у профіль зі спільними
чанками: у `packages/simplycms/tsup.config.ts` у профілі `admin-server`
замінити `{ splitting: false }` на `{ splitting: true }`, потім:

```bash
pnpm --filter simplycms run build
pnpm vitest run --config vitest.packaging.config.ts tests/dist-chunk-boundary.test.ts
```

Очікувано: FAIL на `admin-server/impl.js` або на стабі — у повідомленні видно
відносний імпорт `../chunk-*.js`.

🔴 Якщо тест лишився зеленим — гейт хибний, і далі йти не можна: розберись,
чому спільний чанк не утворився (можливо, esbuild усе заінлайнив), і посиль
асерт до «жоден із чотирьох файлів не імпортує чанк, який імпортує ще
хтось». Не рухайся далі з гейтом, який не червоніє.

- [ ] **Крок 6: Відкотити негативний контроль і перезібрати**

```bash
git checkout packages/simplycms/tsup.config.ts
pnpm --filter simplycms run build
pnpm vitest run --config vitest.packaging.config.ts tests/dist-chunk-boundary.test.ts
```

Очікувано: знову зелено.

- [ ] **Крок 7: Мінімальний гейт і коміт**

```bash
pnpm lint && pnpm test
git add tests/dist-chunk-boundary.test.ts vitest.packaging.config.ts
git commit -m "test(track-t): гейт межі чанків — server-only субшляхи самодостатні

Baseline перед міграцією на tsdown: у tsdown немає опції splitting:false,
тож ізоляція серверних entry мусить триматися розкладкою конфігів.
Гейт перевіряє властивість артефакта, тому чинний до і після міграції.
Негативний контроль: splitting:true у профілі admin-server червонить.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01XHLV45MWSk1MxN5fi2UywF"
```

---

### Task 2: tsdown у дереві + міграція `@simplycms/plugin-faq`

**Files:**
- Modify: `package.json` (devDependencies)
- Create: `packages/simplycms-plugin-faq/tsdown.config.ts`
- Delete: `packages/simplycms-plugin-faq/tsup.config.ts`
- Modify: `packages/simplycms-plugin-faq/package.json:46-47`

**Interfaces:**
- Produces: **канонічний набір опцій tsdown для цього репо** — записується
  коментарем у створеному конфізі й переноситься далі дослівно (Task 3–7).
  Імена полів: `entry`, `format`, `platform`, `dts`, `sourcemap`, `clean`,
  `tsconfig`, `target`, плюс правило зовнішності (`external` АБО
  `deps.neverBundle` — визначається Кроком 2).

Плагін іде першим свідомо: два entry, `splitting: false`, декларації
бандлером — найменший пакет, на якому видно ВСІ механізми міграції.

- [ ] **Крок 1: Поставити tsdown**

```bash
pnpm add -Dw tsdown@0.22.14
```

Очікувано: `tsdown` у `devDependencies` кореня, `pnpm-lock.yaml` оновлено.

🔴 `tsup` на цьому кроці НЕ знімається — ядро ще збирається ним аж до Task 7.
Обидва інструменти співіснують у дереві до Task 8; це свідомий перехідний
стан, а не недогляд.

- [ ] **Крок 2: Звірити поверхню опцій встановленої версії**

```bash
grep -rn "neverBundle\|^  external\|external?:\|tsconfig?:\|target?:\|unbundle?:" node_modules/tsdown/dist/*.d.ts | head -20
```

Записати результат у коментар конфігу нижче: чи зовнішність задається полем
`external`, чи `deps: { neverBundle: [...] }` (офіційний гайд міграції показує
друге), і чи приймає воно `RegExp`. Далі в плані вживається `external` як
основна форма; якщо типи її не мають — усюди підставляється
`deps: { neverBundle: [...] }` з тим самим значенням. `pnpm typecheck`
доводить вибір машинно: конфіги входять у кореневий tsconfig.

- [ ] **Крок 3: Створити конфіг плагіна**

`packages/simplycms-plugin-faq/tsdown.config.ts`:

```ts
import { defineConfig, type UserConfig } from 'tsdown';

// 🔴 ДВА конфіги, а не один із двома entry. У tsdown немає `splitting: false`
// («splitting removed — always enabled», офіційний гайд міграції з tsup), а
// спільний hash-чанк між `index` і `pages/FaqAdmin` дав би .d.ts, який
// ре-експортує з чанка через .js, — це ламає `moduleResolution: node` у
// магазині-споживачі. Збірка з ОДНИМ entry не має з чим ділити чанки, тож
// інваріант тримається структурно.
const base = {
  format: ['esm'],
  platform: 'neutral',
  // Ядро приїжджає до магазину окремим пакетом; вбудовувати його копію в
  // бандл плагіна означало б дубль React-контекстів.
  external: [/^simplycms(\/|$)/, /^@simplycms\//],
  dts: true,
  tsconfig: './tsconfig.json',
  sourcemap: true,
  target: 'esnext',
  clean: false,
} satisfies UserConfig;

export default defineConfig([
  { ...base, clean: true, entry: { index: 'src/index.ts' } },
  { ...base, entry: { 'pages/FaqAdmin': 'src/pages/FaqAdmin.tsx' } },
]);
```

🔴 `clean: true` стоїть РІВНО в одного конфігу — першого. Обидва пишуть в
один `dist/`, тож чистка з обох затирала б уже записане (конфіги масиву
збираються паралельно).

- [ ] **Крок 4: Перемкнути скрипти пакета**

У `packages/simplycms-plugin-faq/package.json` замінити:

```json
    "build": "tsdown",
    "prepublishOnly": "tsdown"
```

- [ ] **Крок 5: Зняти знімок чинного `dist/` для порівняння**

```bash
cd packages/simplycms-plugin-faq
find dist -type f | sort > /tmp/claude-1000/-home-vsydorenko-github-simplyCMS/05e4009a-cd29-4467-a742-d0f5adeff1b4/scratchpad/faq-dist-before.txt
cat /tmp/claude-1000/-home-vsydorenko-github-simplyCMS/05e4009a-cd29-4467-a742-d0f5adeff1b4/scratchpad/faq-dist-before.txt
```

Очікувано: `dist/index.js`, `dist/index.d.ts`, `dist/pages/FaqAdmin.js`,
`dist/pages/FaqAdmin.d.ts` + мапи.

- [ ] **Крок 6: Зібрати новим інструментом і порівняти**

```bash
rm -rf dist && pnpm run build
find dist -type f | sort > /tmp/claude-1000/-home-vsydorenko-github-simplyCMS/05e4009a-cd29-4467-a742-d0f5adeff1b4/scratchpad/faq-dist-after.txt
diff /tmp/claude-1000/-home-vsydorenko-github-simplyCMS/05e4009a-cd29-4467-a742-d0f5adeff1b4/scratchpad/faq-dist-{before,after}.txt || true
```

Очікувано: набір `.js`/`.d.ts` збігається (розширення й імена — ті самі, бо
`entry` задано обʼєктною мапою). Допустима різниця — імена/наявність
`.map`-файлів. 🔴 Поява файлів `chunk-*.js` — ПОМИЛКА: означає, що конфіги
злилися в один; повернись до Кроку 3.

- [ ] **Крок 7: Видалити старий конфіг і перевірити межу**

```bash
cd /home/vsydorenko/github/simplyCMS
rm packages/simplycms-plugin-faq/tsup.config.ts
grep -c "chunk-" packages/simplycms-plugin-faq/dist/index.js || true
grep -o "from\"[^\"]*\"" packages/simplycms-plugin-faq/dist/index.js | sort -u | head
```

Очікувано: нуль згадок `chunk-`; серед імпортів — лише bare (`simplycms/…`,
`react`, `zod`, `lucide-react`).

- [ ] **Крок 8: Гейти й коміт**

```bash
pnpm lint && pnpm test && pnpm typecheck
pnpm build:packages && pnpm test:packaging
```

Очікувано: `published-exports-parity` зелений (усі цілі exports плагіна лежать
у tarball-і), `dist-import-meta` зелений, кеп памʼяті витриманий.

```bash
git add package.json pnpm-lock.yaml packages/simplycms-plugin-faq
git commit -m "build(track-t): @simplycms/plugin-faq на tsdown

Один entry — один конфіг: у tsdown немає splitting:false, а спільний чанк
між index і pages/FaqAdmin дав би .d.ts з ре-експортом через .js.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01XHLV45MWSk1MxN5fi2UywF"
```

---

### Task 3: `@simplycms/theme-solarstore`

**Files:**
- Create: `packages/simplycms-theme-solarstore/tsdown.config.ts`
- Delete: `packages/simplycms-theme-solarstore/tsup.config.ts`
- Modify: `packages/simplycms-theme-solarstore/package.json:37-38`

**Interfaces:**
- Consumes: канонічний набір опцій із Task 2 (той самий `base`).
- Produces: нічого нового — тема лишається одним entry.

- [ ] **Крок 1: Знімок чинного `dist/`**

```bash
cd packages/simplycms-theme-solarstore && find dist -type f | sort
```

- [ ] **Крок 2: Створити конфіг**

`packages/simplycms-theme-solarstore/tsdown.config.ts`:

```ts
import { defineConfig } from 'tsdown';

// Тема — один entry, тож питання спільних чанків не постає взагалі
// (на відміну від плагіна, див. його конфіг). Декларації емітить бандлер:
// поверхня типів теми — це один `ThemeModule`, і причин виносити її в
// окремий крок tsc, як у ядрі, немає.
export default defineConfig({
  entry: { index: 'src/index.ts' },
  format: ['esm'],
  platform: 'neutral',
  // Ядро приїжджає до магазину окремим пакетом — інакше дубль
  // React-контекстів (ThemeRegistry тощо) у рантаймі.
  external: [/^simplycms(\/|$)/, /^@simplycms\//],
  dts: true,
  tsconfig: './tsconfig.json',
  sourcemap: true,
  target: 'esnext',
  clean: true,
});
```

- [ ] **Крок 3: Перемкнути скрипти**

У `packages/simplycms-theme-solarstore/package.json`:

```json
    "build": "tsdown",
    "prepublishOnly": "tsdown"
```

- [ ] **Крок 4: Зібрати й порівняти**

```bash
rm -rf dist && pnpm run build && find dist -type f | sort
```

Очікувано: `dist/index.js`, `dist/index.d.ts` (+ мапи), нуль `chunk-*`.

- [ ] **Крок 5: Видалити старий конфіг, прогнати гейти**

```bash
cd /home/vsydorenko/github/simplyCMS
rm packages/simplycms-theme-solarstore/tsup.config.ts
pnpm lint && pnpm test && pnpm typecheck
pnpm build:packages && pnpm test:packaging
```

- [ ] **Крок 6: Перевірити conformance теми на зібраному пакеті**

```bash
pnpm simplycms theme:conformance solarstore
```

Очікувано: гейт views v3 проходить — тобто зібрана тема лишилась робочим
`ThemeModule`, а не просто набором файлів.

- [ ] **Крок 7: Коміт**

```bash
git add packages/simplycms-theme-solarstore
git commit -m "build(track-t): @simplycms/theme-solarstore на tsdown

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01XHLV45MWSk1MxN5fi2UywF"
```

---

### Task 4: Ядро, крок 1 — каркас конфігу + профілі зі спільними чанками

**Files:**
- Create: `packages/simplycms/tsdown.config.ts`
- Modify: `packages/simplycms/tsup.config.ts` (вилучити два профілі)
- Modify: `packages/simplycms/package.json:478` (скрипт `build`)

**Interfaces:**
- Produces (споживають Task 5–7):
  - `entries(patterns: string[]): Record<string, string>` — глоби → мапа
    `<шлях у dist без розширення> → <файл>`, без `__tests__`, відсортовано;
  - `grouped(patterns: string[], extra?: Partial<UserConfig>): UserConfig` —
    один конфіг на групу entry (спільні чанки дозволені);
  - `isolated(patterns: string[], extra?: Partial<UserConfig>): UserConfig[]` —
    по конфігу на кожен entry (еквівалент `splitting: false`);
  - `base` — спільні опції (`format`, `dts: false`, `sourcemap`, `clean: false`,
    `external`, `target`, `tsconfig`, `platform: 'neutral'`).

🔴 Перехідний стан: ядро збирається ДВОМА інструментами (`tsdown && tsup &&
tsc`). Це безпечно рівно тому, що набори entry не перетинаються, а `clean`
вимкнено в обох (теку зносить сам скрипт `build`). Стан живе рівно до Task 8.

- [ ] **Крок 1: Знімок чинного `dist/` ядра — джерело порівняння для Task 4–7**

```bash
cd packages/simplycms
pnpm run build
find dist -name '*.js' -not -name 'chunk-*' | sort > /tmp/claude-1000/-home-vsydorenko-github-simplyCMS/05e4009a-cd29-4467-a742-d0f5adeff1b4/scratchpad/core-entries-before.txt
wc -l /tmp/claude-1000/-home-vsydorenko-github-simplyCMS/05e4009a-cd29-4467-a742-d0f5adeff1b4/scratchpad/core-entries-before.txt
```

🔴 Цей файл — контракт на всі задачі по ядру: перелік entry-файлів (без
hash-чанків) мусить лишитися ТИМ САМИМ після кожного кроку міграції.

- [ ] **Крок 2: Створити `packages/simplycms/tsdown.config.ts`**

```ts
import { globSync } from 'node:fs';
import { defineConfig, type UserConfig } from 'tsdown';

// Флагманський пакет тримає всі тіри T0→T5 в одній теці `src/`, а вимоги до
// збірки в них РІЗНІ — тому конфіг є масивом, а не одним обʼєктом.
//
// 🔴 Головна різниця з попереднім тулчейном (tsup): у tsdown НЕМА опції
// `splitting: false` — офіційний гайд міграції каже «splitting removed —
// always enabled», а «Unsupported Options» перелічує «disabling code
// splitting». Там, де ізоляція entry була інваріантом (самодостатність .d.ts
// і — важливіше — межа довіри server-only модулів), її тримає РОЗКЛАДКА:
// один entry на конфіг (`isolated`). Збірка з одним входом не має з чим
// ділити чанки, тож інваріант структурний, а не опційний.
//
// 🔴 `external` обовʼязковий у КОЖНОМУ конфізі. Інтра-пакетні імпорти — це
// self-reference субшляхи (`simplycms/contracts` усередині цього ж пакета);
// бандлер авто-зовнішнить лише `dependencies`/`peerDependencies`, а пакет не
// може залежати сам від себе. Без явного правила граф вбудувався б у кожен
// entry й задублював stateful-модулі (ThemeRegistry, пул) МОВЧКИ.
const external = [/^simplycms(\/|$)/, /^@simplycms\//];

const base = {
  format: ['esm'],
  // 🔴 dts вимкнено НАЗАВЖДИ — декларації видає `tsc -p tsconfig.dts.json`
  // (крок `build` у package.json). Причина історична й виміряна: dts-механізм
  // бандлера створював окрему повну ts.Program на КОЖНУ теку entry й тримав
  // їх усі живими — 36 програм / 9 ГБ / 191 с там, де tsc емітить ті самі
  // декларації за ~26 с і 1.1 ГБ. Повернення `dts: true` пробиває кеп
  // памʼяті build:packages (3 ГБ) і червонить миттєво; структурний гард —
  // tests/dts-toolchain.test.ts.
  dts: false,
  tsconfig: './tsconfig.json',
  sourcemap: true,
  // 🔴 `clean` вимкнено: конфіги масиву збираються паралельно, і чистка
  // спільного `dist/` одним із них затирала б уже записане іншим. Теку
  // зносить скрипт `build` пакета — один раз, до запуску бандлера.
  clean: false,
  external,
  // 🔴 `platform: 'neutral'` — дефолт tsdown це `'node'`, а більшість
  // субшляхів ядра доїжджають до браузера через бандлер магазину. Node-
  // специфіка вмикається точково (`db`, `auth`), а не глобально.
  platform: 'neutral',
  // 🔴 `target: esnext` живе у СПІЛЬНОМУ base, а не в окремому конфізі. За
  // нижчого таргета бандлер лоуерить `import.meta` у `var import_meta = {}`,
  // і опублікований dist читає `{}.env.VITE_…`: TypeError на гідрації ще до
  // дружнього throw про відсутній ключ. Форму `import.meta.env` треба
  // ЗБЕРЕГТИ, щоб її підставив бандлер магазину.
  // Гард — tests/dist-import-meta.test.ts (packaging-suite).
  target: 'esnext',
} satisfies UserConfig;

/**
 * Розгортає глоби у мапу entry: `<шлях у dist без розширення> → <файл>`.
 *
 * 🔴 Обʼєктна форма обовʼязкова, спискова — ні: за списковою бандлер бере
 * спільний предок entry-шляхів як базу виводу, і група `contracts` писала б
 * `dist/index.js`, затираючи корінь пакета. Ключ фіксує вихідний шлях явно й
 * тримає `dist/` дзеркалом `publishConfig.exports`.
 *
 * 🔴 Порожній результат — ПОМИЛКА: глоб без збігів означає одруку чи забутий
 * перенос, і збірка мусить впасти гучно, а не мовчки лишити пакет без entry.
 */
const entries = (patterns: string[]): Record<string, string> => {
  const map = Object.fromEntries(
    globSync(patterns)
      .map((file) => file.split('\\').join('/'))
      .filter((file) => !file.includes('__tests__'))
      .sort()
      .map((file) => [
        file.replace(/^src\//, '').replace(/\.tsx?$/, ''),
        `./${file}`,
      ]),
  );
  if (Object.keys(map).length === 0) {
    throw new Error(`tsdown.config: глоби без збігів — ${patterns.join(', ')}`);
  }
  return map;
};

/** Група entry в ОДНІЙ збірці: спільні чанки дозволені й потрібні — модулі
 *  зі станом мусять лишатися одним інстансом для всіх субшляхів групи. */
const grouped = (
  patterns: string[],
  extra: Partial<UserConfig> = {},
): UserConfig => ({ ...base, ...extra, entry: entries(patterns) });

/** Кожен entry — власна збірка. Еквівалент знятого `splitting: false`:
 *  ділити чанк нема з чим. Ціна — N дрібних збірок замість однієї. */
const isolated = (
  patterns: string[],
  extra: Partial<UserConfig> = {},
): UserConfig[] =>
  Object.entries(entries(patterns)).map(([out, file]) => ({
    ...base,
    ...extra,
    entry: { [out]: file },
  }));

export default defineConfig([
  // Node/React-тіри: спільні чанки ОБОВʼЯЗКОВІ — модулі зі станом (реєстри,
  // провайдери) мусять лишатися одним інстансом для всіх субшляхів пакета.
  //
  // 🔴 Патерни ДЗЕРКАЛЯТЬ `exports`, а не «усе, що є в теці»: сусідній модуль
  // без export-входу (`themes/server/registry-db.ts`, `admin/lib/*`,
  // `storefront-routes/pages/catalog/*`) мусить лишитися чанком, а не стати
  // окремим entry — інакше `dist/` перестає бути дзеркалом exports-мапи.
  grouped([
    'src/index.ts',
    'src/domain/*.ts',
    'src/domain/user-categories/index.ts',
    'src/supabase/index.ts',
    'src/supabase/keys.ts',
    'src/supabase/*-client.ts',
    'src/supabase/SupabaseProvider.tsx',
    'src/react-query/index.ts',
    'src/react-query/queries.ts',
    'src/runtime/index.ts',
    'src/i18n/index.ts',
    'src/storefront/index.ts',
    'src/storefront/*/index.ts',
    'src/ui/*.ts',
    'src/ui/*.tsx',
    'src/themes/index.ts',
    'src/themes/ThemeRegistry.ts',
    'src/themes/ThemeContext.tsx',
    'src/themes/applyTokens.ts',
    'src/themes/safeFontStylesheets.ts',
    'src/themes/bootstrapThemes.ts',
    'src/themes/validateThemeModule.ts',
    'src/themes/conformance/index.ts',
    'src/themes/server/index.ts',
    'src/plugins/server/index.ts',
    'src/themes/useThemeT.ts',
    'src/themes/types.ts',
    'src/plugins/index.ts',
    'src/plugins/PluginSlot.tsx',
    'src/plugins/bootstrap.ts',
    'src/plugins/types.ts',
    'src/{cart,catalog,checkout,profile,reviews}-ui/index.ts',
    'src/{cart,catalog,checkout,profile,reviews}-ui/*.tsx',
    'src/admin/index.ts',
    'src/admin/{components,pages,layouts}/*.tsx',
    // Реєстр колекцій адмінки (Е1б): клієнтський React-тір, спільні чанки
    // легальні — на відміну від `admin-server`, де ізоляція тримає межу довіри.
    'src/admin-data/index.ts',
    // Тір `core`: `lib/**` і `components/**` рекурсивні — wildcard-входи
    // `./core/lib/*` і `./core/components/*` накривають і вкладені шляхи.
    'src/core/index.ts',
    'src/core/providers/CMSProvider.tsx',
    'src/core/hooks/*.ts',
    'src/core/hooks/*.tsx',
    'src/core/lib/**/*.ts',
    'src/core/components/**/*.tsx',
  ]),
  // Route-шар вітрини.
  grouped([
    'src/storefront-routes/index.ts',
    'src/storefront-routes/active-theme.ts',
    'src/storefront-routes/server/*.ts',
    'src/storefront-routes/seo/*.ts',
    'src/storefront-routes/pages/*.tsx',
    'src/storefront-routes/components/*.tsx',
    'src/storefront-routes/shells/*.ts',
    'src/storefront-routes/shells/*.tsx',
    'src/storefront-routes/views/*.ts',
    'src/storefront-routes/views/*.tsx',
    'src/storefront-routes/views/slots/*.tsx',
  ]),
]);
```

- [ ] **Крок 3: Вилучити переїхалі профілі зі старого конфігу**

У `packages/simplycms/tsup.config.ts` видалити з масиву `profiles` елементи
`profile('tiers', …)` і `profile('storefront-routes', …)` ЦІЛКОМ (разом із
їхніми коментарями — вони переїхали в новий конфіг). Решта шести профілів
лишається недоторканою.

- [ ] **Крок 4: Перемкнути скрипт `build` на два інструменти**

У `packages/simplycms/package.json` рядок 478:

```json
    "build": "node -e \"require('node:fs').rmSync('dist',{recursive:true,force:true})\" && tsdown && tsup && tsc -p tsconfig.dts.json",
```

🔴 Перехідний стан, який знімає Task 8. Порядок `tsdown && tsup` не важливий
(набори entry не перетинаються), важливо, що `rmSync` лишається ПЕРШИМ і
єдиним, хто чистить теку.

- [ ] **Крок 5: Зібрати й звірити перелік entry**

```bash
cd packages/simplycms && pnpm run build
find dist -name '*.js' -not -name 'chunk-*' | sort > /tmp/claude-1000/-home-vsydorenko-github-simplyCMS/05e4009a-cd29-4467-a742-d0f5adeff1b4/scratchpad/core-entries-t4.txt
diff /tmp/claude-1000/-home-vsydorenko-github-simplyCMS/05e4009a-cd29-4467-a742-d0f5adeff1b4/scratchpad/core-entries-{before,t4}.txt && echo "ПЕРЕЛІК ENTRY ЗБІГАЄТЬСЯ"
```

Очікувано: `ПЕРЕЛІК ENTRY ЗБІГАЄТЬСЯ`. 🔴 Будь-яка різниця — стоп: або глоб
розійшовся, або обʼєктна мапа entry дала інший вихідний шлях.

- [ ] **Крок 6: Довести, що stateful-модуль не задубльовано**

```bash
grep -rl "class ThemeRegistryClass" dist | sort
```

Очікувано: РІВНО один файл (чанк або `themes/ThemeRegistry.js`). Два і більше
— реєстр тем існує в кількох інстансах, і активна тема в магазині «губилась
би» між субшляхами.

- [ ] **Крок 7: Гейти**

```bash
cd /home/vsydorenko/github/simplyCMS
pnpm lint && pnpm test && pnpm typecheck
pnpm build:packages && pnpm test:packaging
```

Очікувано: усе зелено, включно з `dist-import-meta` (форма `import.meta`
збереглась) і `dist-chunk-boundary` (Task 1 — чотири server-only entry ще на
`tsup`, тож гейт стереже їх незмінними).

- [ ] **Крок 8: Коміт**

```bash
git add packages/simplycms/tsdown.config.ts packages/simplycms/tsup.config.ts packages/simplycms/package.json
git commit -m "build(track-t): ядро — тіри й роут-шар вітрини на tsdown

Перехідний стан: ядро збирають обидва інструменти, набори entry не
перетинаються, clean вимкнено в обох. Профілі splitting:true переїхали
першими — їхня семантика збігається з дефолтом tsdown.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01XHLV45MWSk1MxN5fi2UywF"
```

---

### Task 5: Ядро, крок 2 — node-профілі `db` і `auth`

**Files:**
- Modify: `packages/simplycms/tsdown.config.ts` (додати два `isolated`)
- Modify: `packages/simplycms/tsup.config.ts` (вилучити `db`, `auth`)

**Interfaces:**
- Consumes: `isolated()`, `base` з Task 4.
- Produces: нічого нового.

- [ ] **Крок 1: Додати конфіги в масив `defineConfig`**

У `packages/simplycms/tsdown.config.ts`, ПЕРЕД `grouped([...])`-елементами
(порядок читабельності: ізольовані — вгорі), додати:

```ts
  // db-рантайм: `platform: 'node'` — модуль server-only за побудовою (пул
  // `pg`), і нейтральний таргет вибирав би browser-поля `exports`
  // залежностей. Один entry, тож `client.ts` і `with-actor.ts` лишаються
  // всередині бандла: шляху до них у споживача немає ні в exports, ні у
  // вигляді .js-файла.
  ...isolated(['src/db/index.ts'], { platform: 'node' }),
  // Auth-контур: та сама пара причин — server-only за побудовою (Better Auth,
  // `node:crypto`, пул через `withActor`), один entry, тож `drizzle-proxy`,
  // `provision` та `invite-store` не отримують шляху назовні. Межу довіри
  // тримає ще й артефакт, не лише лінт-зона.
  ...isolated(['src/auth/index.ts'], { platform: 'node' }),
```

- [ ] **Крок 2: Вилучити ці профілі зі старого конфігу**

У `packages/simplycms/tsup.config.ts` видалити елементи `profile('db', …)` і
`profile('auth', …)` разом із їхніми коментарями.

- [ ] **Крок 3: Зібрати й звірити перелік entry**

```bash
cd packages/simplycms && pnpm run build
find dist -name '*.js' -not -name 'chunk-*' | sort > /tmp/claude-1000/-home-vsydorenko-github-simplyCMS/05e4009a-cd29-4467-a742-d0f5adeff1b4/scratchpad/core-entries-t5.txt
diff /tmp/claude-1000/-home-vsydorenko-github-simplyCMS/05e4009a-cd29-4467-a742-d0f5adeff1b4/scratchpad/core-entries-{before,t5}.txt && echo "ПЕРЕЛІК ENTRY ЗБІГАЄТЬСЯ"
```

- [ ] **Крок 4: Перевірити самодостатність двох модулів вручну**

```bash
grep -oE "from ['\"][^'\"]+['\"]" dist/db/index.js | sort -u
grep -oE "from ['\"][^'\"]+['\"]" dist/auth/index.js | sort -u
```

Очікувано для `db`: рівно `drizzle-orm/node-postgres` і `pg`.
Для `auth`: bare-специфікатори (`better-auth*`, `drizzle-orm*`, `crypto`,
`@tanstack/react-start/server`, `simplycms/db`, `simplycms/schema`).
🔴 Жодного відносного (`./`, `../`) — інакше ізоляція не спрацювала.

- [ ] **Крок 5: Гейт межі чанків**

```bash
cd /home/vsydorenko/github/simplyCMS
pnpm build:packages && pnpm vitest run --config vitest.packaging.config.ts tests/dist-chunk-boundary.test.ts
```

Очікувано: зелено — тепер це вже доказ по МІГРОВАНИХ `db`/`auth`, а не
baseline.

- [ ] **Крок 6: Гейти й коміт**

```bash
pnpm lint && pnpm test && pnpm typecheck && pnpm test:packaging
git add packages/simplycms/tsdown.config.ts packages/simplycms/tsup.config.ts
git commit -m "build(track-t): db і auth на tsdown — по конфігу на entry

platform:'node' збережено; ізоляція, яку раніше давав splitting:false,
тримається розкладкою: один вхід — одна збірка, ділити чанк нема з чим.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01XHLV45MWSk1MxN5fi2UywF"
```

---

### Task 6: Ядро, крок 3 — `contracts` і `schema`

**Files:**
- Modify: `packages/simplycms/tsdown.config.ts` (два `isolated` — 10 конфігів)
- Modify: `packages/simplycms/tsup.config.ts` (вилучити `contracts`, `schema`)

**Interfaces:**
- Consumes: `isolated()`, `entries()` з Task 4.

- [ ] **Крок 1: Додати конфіги**

У `packages/simplycms/tsdown.config.ts`, у блок ізольованих:

```ts
  // T0-контракти (7 entry): кожен самодостатній. Причина історична й досі
  // чинна для споживача — спільний hash-чанк змусив би .d.ts ре-експортувати
  // через .js і зламав би `moduleResolution: node` у магазинах.
  ...isolated([
    'src/contracts/index.ts',
    'src/contracts/entities.ts',
    'src/contracts/*/index.ts',
    'src/contracts/views/fixtures/index.ts',
  ]),
  // Схема БД (3 entry): та сама самодостатність. 🔴 Історична чесність:
  // первинне пояснення профілю («виносимо схему, бо Drizzle-типи вибухають у
  // dts») було ХИБНИМ — розтин 2026-08-24 виміряв, що Drizzle-типи коштують
  // ~0.6 с, а причиною OOM була програма-на-теку в dts-механізмі бандлера.
  ...isolated([
    'src/schema/schema.ts',
    'src/schema/relations.ts',
    'src/schema/types.ts',
  ]),
```

- [ ] **Крок 2: Вилучити профілі `contracts` і `schema` зі старого конфігу**

- [ ] **Крок 3: Зібрати й звірити перелік entry**

```bash
cd packages/simplycms && pnpm run build
find dist -name '*.js' -not -name 'chunk-*' | sort > /tmp/claude-1000/-home-vsydorenko-github-simplyCMS/05e4009a-cd29-4467-a742-d0f5adeff1b4/scratchpad/core-entries-t6.txt
diff /tmp/claude-1000/-home-vsydorenko-github-simplyCMS/05e4009a-cd29-4467-a742-d0f5adeff1b4/scratchpad/core-entries-{before,t6}.txt && echo "ПЕРЕЛІК ENTRY ЗБІГАЄТЬСЯ"
```

- [ ] **Крок 4: Довести самодостатність контрактів**

```bash
for f in dist/contracts/*.js dist/contracts/*/*.js; do
  echo "--- $f"; grep -oE "from ['\"]\.[^'\"]*['\"]" "$f" || echo "  (відносних немає)"
done
```

Очікувано: у КОЖНОГО — «(відносних немає)». `contracts` — тір T0 без
рантайм-залежностей, тож у `dist/contracts/index.js` імпортів може не бути
взагалі.

- [ ] **Крок 5: Перевірити, що декларації не зачепило**

```bash
ls dist/contracts/index.d.ts dist/schema/types.d.ts dist/schema/schema.d.ts
head -3 dist/schema/types.d.ts
```

Очікувано: файли на місці (їх емітить `tsc`, не бандлер — міграція їх не
торкається).

- [ ] **Крок 6: Гейти й коміт**

```bash
cd /home/vsydorenko/github/simplyCMS
pnpm lint && pnpm test && pnpm typecheck
pnpm build:packages && pnpm test:packaging
git add packages/simplycms/tsdown.config.ts packages/simplycms/tsup.config.ts
git commit -m "build(track-t): contracts і schema на tsdown — по конфігу на entry

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01XHLV45MWSk1MxN5fi2UywF"
```

---

### Task 7: Ядро, крок 4 — межа довіри: `plugin-sdk` і `admin-server`

**Files:**
- Modify: `packages/simplycms/tsdown.config.ts` (два `isolated` — 4 конфіги)
- Delete: `packages/simplycms/tsup.config.ts`
- Modify: `packages/simplycms/package.json:478` (скрипт `build` — без tsup)
- Modify: `tests/dts-toolchain.test.ts:26-40, 55-60`

**Interfaces:**
- Consumes: `isolated()` з Task 4.
- Produces: доказ, що межа довіри тримається на новому бандлері — Gate C
  пілота + `dist-chunk-boundary`; `tsdown.config.ts` як default-export масив
  конфігів, що його читає `dts-toolchain.test.ts`.

🔴 Найризикованіша задача треку: тут ізоляція — не оптимізація, а межа. Якщо
`plugin-sdk/server` склеїться з `plugin-sdk/index`, пул Postgres поїде в
браузер разом із `usePluginTable`; якщо `admin-server/impl` склеїться зі
стабом — Gate C перестане розрізняти стаб і нетрансформований модуль.

- [ ] **Крок 1: Додати конфіги**

```ts
  // Поверхня плагінів. 🔴 `plugin-sdk/server` — ОКРЕМА збірка, а не модуль
  // усередині бандла SDK. Трансформація Start вирізає з клієнтського бандла
  // тіла serverFn-хендлерів, після чого їхні серверні імпорти стають
  // невживаними і зникають. Це працює лише поки хендлери живуть у власному
  // модулі: у спільному чанку з хуками їхні імпорти лишилися б на верхньому
  // рівні ЖИВОГО модуля, і пул Postgres поїхав би в браузер разом із
  // `usePluginTable`.
  ...isolated(['src/plugin-sdk/index.ts', 'src/plugin-sdk/server/index.ts']),
  // serverFn-шар адмінки (Е1б, К3-9′): ДВА entry, дві збірки. `index` —
  // serverFn-стаби, що імпортують `impl` BARE-специфікатором (зовнішній);
  // `impl` — server-only нутрощі, куди інлайняться фабрика, операції та
  // Zod-схеми. Саме ця пара дає Gate C розрізнення «стаб vs нетрансформований
  // модуль»: у клієнті легальний `dist/admin-server/index`, але НІКОЛИ
  // `dist/admin-server/impl`.
  // БЕЗ `platform: 'node'` — index імпортує клієнтський граф (стаби).
  ...isolated(['src/admin-server/index.ts', 'src/admin-server/impl.ts']),
```

- [ ] **Крок 2: Знести старий конфіг ядра цілком**

Останні два профілі — це весь залишок `tsup.config.ts`, тож файл видаляється,
а не спорожнюється: масив без елементів лишив би невживані `entries`/`profile`/
`base`, і `pnpm lint` червонів би на `no-unused-vars`.

```bash
rm packages/simplycms/tsup.config.ts
```

І прибрати `tsup` зі скрипта `build` у `packages/simplycms/package.json`:

```json
    "build": "node -e \"require('node:fs').rmSync('dist',{recursive:true,force:true})\" && tsdown && tsc -p tsconfig.dts.json",
```

- [ ] **Крок 2а: Перемкнути гейт тулчейна декларацій на новий конфіг**

`tests/dts-toolchain.test.ts` імпортує `tsup.config.ts`, якого вже немає, тож
перемикання належить цій задачі, а не наступній. Замінити перший тест:

```ts
  it('жоден конфіг tsdown не вмикає dts (декларації — лише tsc)', async () => {
    // Імпорт, не регекс: конфіг — код, і форма запису може мінятись.
    const mod = (await import(
      resolve(root, 'packages/simplycms/tsdown.config.ts')
    )) as { default: Array<{ dts?: unknown; entry: Record<string, string> }> };
    const offenders = mod.default
      .filter((config) => Boolean(config.dts))
      .map((config) => Object.keys(config.entry).join(','));
    expect(
      offenders,
      'конфіги з dts: true — це шлях назад до 36 ts.Program і OOM',
    ).toEqual([]);
  });
```

У тесті `build пакета ядра викликає tsc-емісію декларацій` дописати два
асерти:

```ts
    expect(pkg.scripts.build).toContain('tsdown');
    // Перехідний стан «збирають обидва інструменти» (Task 4–6) закритий.
    expect(pkg.scripts.build).not.toContain('tsup');
```

Шапку файлу оновити: «dts-механізм tsup» → «dts-механізм бандлера
(rollup-plugin-dts у tsup, rolldown-plugin-dts у tsdown — обидва створюють
повну ts.Program на теку entry)».

- [ ] **Крок 2б: Довести, що гейт читає САМЕ новий конфіг**

```bash
mv packages/simplycms/tsdown.config.ts /tmp/claude-1000/-home-vsydorenko-github-simplyCMS/05e4009a-cd29-4467-a742-d0f5adeff1b4/scratchpad/tsdown.config.ts.bak
pnpm vitest run --config vitest.packaging.config.ts tests/dts-toolchain.test.ts
```

Очікувано: FAIL із помилкою резолву модуля — без цієї перевірки тест міг би
мовчки нічого не перевіряти. Повернути файл:

```bash
mv /tmp/claude-1000/-home-vsydorenko-github-simplyCMS/05e4009a-cd29-4467-a742-d0f5adeff1b4/scratchpad/tsdown.config.ts.bak packages/simplycms/tsdown.config.ts
pnpm vitest run --config vitest.packaging.config.ts tests/dts-toolchain.test.ts
```

Очікувано: зелено.

- [ ] **Крок 3: Зібрати й звірити перелік entry — фінальна звірка ядра**

```bash
cd packages/simplycms && pnpm run build
find dist -name '*.js' -not -name 'chunk-*' | sort > /tmp/claude-1000/-home-vsydorenko-github-simplyCMS/05e4009a-cd29-4467-a742-d0f5adeff1b4/scratchpad/core-entries-t7.txt
diff /tmp/claude-1000/-home-vsydorenko-github-simplyCMS/05e4009a-cd29-4467-a742-d0f5adeff1b4/scratchpad/core-entries-{before,t7}.txt && echo "ПЕРЕЛІК ENTRY ЗБІГАЄТЬСЯ ПОВНІСТЮ"
```

Очікувано: `ПЕРЕЛІК ENTRY ЗБІГАЄТЬСЯ ПОВНІСТЮ` — весь пакет зібрано новим
інструментом, і перелік субшляхів той самий, що був на tsup.

- [ ] **Крок 4: Прямий доказ межі довіри**

```bash
echo "--- plugin-sdk/index (клієнт)"; grep -oE "from ['\"][^'\"]+['\"]" dist/plugin-sdk/index.js | sort -u
echo "--- plugin-sdk/server (сервер)"; grep -oE "from ['\"][^'\"]+['\"]" dist/plugin-sdk/server/index.js | sort -u
echo "--- admin-server/index (стаб)"; grep -oE "from ['\"][^'\"]+['\"]" dist/admin-server/index.js | sort -u
echo "--- admin-server/impl (нутрощі)"; grep -oE "from ['\"][^'\"]+['\"]" dist/admin-server/impl.js | sort -u
```

Очікувано:
- `plugin-sdk/index` — БЕЗ `drizzle-orm`, БЕЗ `pg`, без відносних імпортів;
- `plugin-sdk/server` — `drizzle-orm`, `simplycms/auth`, `simplycms/schema`,
  `simplycms/storefront/loaders`, без відносних;
- `admin-server/index` — рівно `@tanstack/react-start` і
  `simplycms/admin-server/impl`, без відносних;
- `admin-server/impl` — `drizzle-orm`, `drizzle-zod`, `simplycms/db`,
  `simplycms/auth`, `simplycms/schema`, `zod`, без відносних.

- [ ] **Крок 5: Гейт межі чанків — тепер по мігрованих модулях**

```bash
cd /home/vsydorenko/github/simplyCMS
pnpm build:packages && pnpm vitest run --config vitest.packaging.config.ts tests/dist-chunk-boundary.test.ts
```

Очікувано: 6 passed.

- [ ] **Крок 6: Gate C пілота — доказ у справжньому клієнтському бандлі**

```bash
pnpm pilot:pack
```

Очікувано: гейти A/C/D + CLI/TOOL зелені. 🔴 Саме Gate C доводить головне:
`simplycms/dist/admin-server/impl`, `simplycms/dist/db`, `drizzle-orm` і `pg`
відсутні в клієнтських чанках магазину, а стаб `admin-server/index` —
присутній (гейт не вхолосту).

- [ ] **Крок 7: Гейти й коміт**

```bash
pnpm lint && pnpm test && pnpm typecheck && pnpm test:packaging
git add -A packages/simplycms tests/dts-toolchain.test.ts
git commit -m "build(track-t): plugin-sdk і admin-server на tsdown — межа довіри збережена

Останні два профілі ядра. Ізоляція server-only entry тримається розкладкою
конфігів; доказ — dist-chunk-boundary + Gate C пілота (impl і pg відсутні
в клієнтських чанках, стаб index присутній).

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01XHLV45MWSk1MxN5fi2UywF"
```

---

### Task 8: Знос tsup із дерева й документації

**Files:**
- Modify: `package.json` (девзалежність `tsup` геть)
- Modify: `packages/simplycms/tsconfig.dts.json:2`
- Modify: `packages/simplycms/src/storefront/loaders/session.ts:19,24`,
  `packages/simplycms/src/storefront/loaders/index.ts:35`,
  `packages/simplycms/src/storefront-routes/server/is-admin.ts:20`,
  `packages/simplycms/src/admin-server/index.ts:2`,
  `packages/simplycms/src/admin-server/impl.ts:4`,
  `packages/simplycms/src/schema/index.ts:13`,
  `packages/simplycms/src/supabase/vite-env.d.ts:5`
- Modify: `CLAUDE.md`, `docs/architecture/test-contours.md`,
  `docs/tasks/platform-roadmap.md`

**Interfaces:**
- Consumes: стан після Task 7 — ядро вже збирає лише tsdown, `dts-toolchain`
  читає `tsdown.config.ts`. Ця задача нових інтерфейсів не створює.

- [ ] **Крок 1: Зняти залежність і перевірити залишкові згадки**

```bash
pnpm remove -Dw tsup
grep -rn "tsup" --include=*.json --include=*.ts --include=*.mjs --include=*.yaml . \
  --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=.git | grep -v pnpm-lock
```

Очікувано: `tsup` зник із `devDependencies` і `pnpm-lock.yaml`; у виводі
`grep` лишились ЛИШЕ коментарі в семи файлах ядра, `tsconfig.dts.json`,
`vitest.packaging.config.ts` і `tests/cli-pack.test.ts` — їх править Крок 2.

🔴 Конфіг ядра й гейт `dts-toolchain` уже перемкнуті в Task 7 (Кроки 2, 2а,
2б) — тут лишається лише прибирання дерева й тексту.

- [ ] **Крок 2: Оновити коментарі в коді**

Пройти сім файлів і замінити назву інструмента, ЗБЕРІГШИ причину. Точні
формулювання:

- `src/storefront/loaders/session.ts:19` — «tsup при `splitting: true`
  піднімає у спільний чанк» → «бандлер піднімає у спільний чанк (у tsdown
  code splitting увімкнено завжди)»;
- `src/storefront/loaders/session.ts:24` — «який у tsup зовнішній» →
  «який для бандлера зовнішній (`external`)»;
- `src/storefront/loaders/index.ts:35` — «heap воркера tsup» → «heap
  dts-механізму бандлера»;
- `src/storefront-routes/server/is-admin.ts:20` — «в один tsup-чанк» →
  «в один чанк бандлера»;
- `src/admin-server/index.ts:2` — «відносний імпорт tsup заінлайнив би» →
  «відносний імпорт бандлер заінлайнив би»;
- `src/admin-server/impl.ts:4` — «tsup лишає» → «бандлер лишає»;
- `src/schema/index.ts:13` — «Entry-точкою tsup барель НЕ стає» →
  «Entry-точкою бандлера барель НЕ стає»;
- `src/supabase/vite-env.d.ts:5` — «standalone-збірка (tsup поза
  host-програмою)» → «standalone-збірка (бандлер пакета поза host-програмою)»;
- `packages/simplycms/tsconfig.dts.json:2` — «дешевим tsc замість
  dts-механізму tsup» → «дешевим tsc замість dts-механізму бандлера»;
- `vitest.packaging.config.ts` — «dts поза tsup» → «dts поза бандлером»;
- `tests/cli-pack.test.ts:21` — «tsup-збірки пакет не має» → «збірки пакет
  не має».

- [ ] **Крок 3: Оновити документацію**

`CLAUDE.md`, блок `pnpm build:packages` у Quick Reference — замінити абзац:

```
pnpm build:packages   # Збірка публікованих пакетів. 🔴 Ходить через scripts/build-packages.mjs
                      # із кепом купи 3 ГБ: JS видає tsdown (Rolldown), ДЕКЛАРАЦІЇ — tsc
                      # (tsconfig.dts.json), бо dts-механізм бандлера жер 12 ГБ.
                      # 🔴 У tsdown НЕМА splitting:false, тож ізоляція server-only
                      # entry тримається розкладкою: один вхід — один конфіг
                      # (packages/simplycms/tsdown.config.ts). Форму стережуть
                      # tests/dts-toolchain.test.ts і tests/dist-chunk-boundary.test.ts
```

`docs/architecture/test-contours.md`, у кінець розділу «Бюджет памʼяті
збірки» — дописати підрозділ дослівно:

```markdown
### Межа чанків server-only субшляхів (трек T, 2026-09-02)

`tests/dist-chunk-boundary.test.ts` (packaging-suite) доводить, що чотири
субшляхи ядра — `db`, `auth`, `admin-server/impl`, `plugin-sdk/server` —
зібрані самодостатньо: **нуль відносних імпортів** у їхніх `.js`.

🔴 Чому саме така форма. Спільний чанк у зібраному ESM проявляється рівно як
відносний імпорт (`../../chunk-XXXX.js`); bare-специфікатор (`pg`,
`simplycms/db`) — навпаки, ознака того, що межа тримається. До треку T
ізоляцію давала опція бандлера (`splitting: false`); у tsdown такої опції
НЕМА («splitting removed — always enabled»), тож її тримає розкладка — один
entry на конфіг, — а гейт стереже результат, а не спосіб.

🔴 Чого гейт свідомо НЕ покриває: `storefront/loaders` живе у профілі зі
спільними чанками й має відносний імпорт уже сьогодні. Його межу тримає
bare-специфікатор із боку споживача плюс tree-shaking бандлера магазину, і
доводить це Gate C пілота — не цей гейт.
```

`docs/tasks/platform-roadmap.md`, пункт «4. Трек T» — замінити заголовок
пункту на:

```markdown
4. ✅ **Трек T — Тулчейн збірки: міграція tsup → tsdown; ЗАВЕРШЕНО
   2026-09-02.** Три пакети (`simplycms`, `@simplycms/theme-solarstore`,
   `@simplycms/plugin-faq`) збирає `tsdown` (Rolldown); декларації ядра
   лишились за `tsc -p tsconfig.dts.json`. 🔴 Головний висновок треку: у
   tsdown НЕМА `splitting: false`, тож ізоляцію server-only entry тримає
   розкладка «один вхід — один конфіг», а не опція; результат стереже
   новий гейт `tests/dist-chunk-boundary.test.ts`. План —
   [`2026-09-02-track-t-tsdown-migration.md`](../superpowers/plans/2026-09-02-track-t-tsdown-migration.md)
```

Мотиваційний текст пункту (чому tsup покинутий, чому Rolldown уже в стеку)
лишити як історію рішення — він пояснює, ЧОМУ трек був потрібен.

- [ ] **Крок 4: Повний ланцюг гейтів**

```bash
pnpm install --frozen-lockfile && pnpm format:check && pnpm lint && pnpm build \
  && pnpm typecheck && pnpm test && pnpm test:schema && pnpm build:packages \
  && pnpm typecheck:template && pnpm test:packaging
```

Очікувано: зелено все. `pnpm lint` — 0 errors (кількість warnings не зросла
проти 12).

- [ ] **Крок 5: Коміт**

```bash
git add -A
git commit -m "build(track-t): tsup знесено з дерева; доки й гейти на tsdown

dts-toolchain читає tsdown.config.ts; коментарі в семи файлах ядра називають
механізм, а не інструмент; CLAUDE.md, test-contours і роадмап оновлені.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01XHLV45MWSk1MxN5fi2UywF"
```

---

### Task 9: Фінальний контур — живий прогін магазину

**Files:** змін коду немає; задача — доказ.

**Interfaces:**
- Consumes: усе попереднє.
- Produces: артефакти валідації для передачі власнику.

🔴 Канон репо: зелені тести не доводять опублікований пакет. Трек закривається
магазином, зібраним зі свіжих tarball-ів.

- [ ] **Крок 1: Пілот пакування без БД**

```bash
pnpm pilot:pack
```

Очікувано: A/C/D + CLI/TOOL зелені.

- [ ] **Крок 2: Підняти чисту БД**

```bash
pnpm db:demo
```

Очікувано: канон міграцій накатано, демо-каталог є. Передумова — `DATABASE_URL`
у `.env.local` (див. `v2-state-map.md` §5).

- [ ] **Крок 3: Зібрати й запустити магазин**

```bash
pnpm build && pnpm start
```

- [ ] **Крок 4: Живий прогін вітрини**

У браузері перевірити:
1. `/` — головна віддає дані з БД (не порожній каркас);
2. `/catalog` — каталог із товарами демо-сіду;
3. картка товару — відкривається, ціна й залишок на місці;
4. `/sitemap.xml` — реальні URL;
5. консоль браузера — нуль помилок про `import_meta`, `process is not
   defined`, `Cannot read properties of undefined`.

🔴 П.5 — прямий доказ, що лоуерення `import.meta` не сталося: саме цей клас
регресії гейти ловлять структурно, а браузер — фактично.

- [ ] **Крок 5: Живий прогін адмінки — межа довіри в бою**

1. Увійти власником, відкрити `/admin/order-statuses`;
2. створити статус, перейменувати, змінити порядок, видалити;
3. у вкладці Network переконатись, що операції йдуть POST-запитами до
   serverFn, а не прямими запитами до БД;
4. у вкладці Sources пошукати `drizzle` і `pg` серед завантажених чанків —
   очікувано **нуль збігів**.

🔴 П.4 — фактичний доказ того самого, що Gate C доводить машинно. Якщо
серверний граф просочився, тут він видимий.

- [ ] **Крок 6: Записати артефакти валідації**

Зібрати в один звіт: вивід повного ланцюга гейтів (Task 8 Крок 4), вивід
`pilot:pack`, `git log --oneline` треку, короткий опис живого прогону
(що перевірено, що побачено) і час збірки `build:packages` до/після
міграції (з рядка `build:packages: ok за NN с`).

- [ ] **Крок 7: Фінальний коміт (якщо були правки доків за підсумками)**

```bash
pnpm lint && pnpm test
git add -A && git commit -m "docs(track-t): підсумок міграції — виміри й артефакти живого прогону

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01XHLV45MWSk1MxN5fi2UywF"
```

---

## DoD треку T

1. `tsup` відсутній у дереві: ні в `devDependencies`, ні конфігом, ні згадкою
   в скриптах (`grep -rn "tsup"` дає лише історичні згадки в доках/памʼяті).
2. Три пакети збираються `tsdown`; декларації ядра — `tsc -p tsconfig.dts.json`.
3. Перелік entry-файлів `dist/` ядра **побайтово той самий набір шляхів**, що
   до міграції (`diff` знімків із Task 4 Крок 1 і Task 7 Крок 3 порожній).
4. Гейт `dist-chunk-boundary` зелений і має доведений негативний контроль
   (Task 1 Крок 5).
5. `dist-import-meta`, `published-exports-parity`, `dts-toolchain`,
   `audit-exports` зелені; кеп 3 ГБ і стеля 300 с витримані.
6. `pnpm pilot:pack` зелений, Gate C розрізняє стаб і нутрощі `admin-server`.
7. Повний ланцюг гейтів зелений.
8. **Живий прогін:** магазин на чистому Postgres — вітрина віддає дані,
   `/admin/order-statuses` працює, у клієнтських чанках немає `drizzle`/`pg`.
9. Доки оновлені: CLAUDE.md, `test-contours.md`, роадмап (трек T — `[x]`).

## Що НЕ входить у трек T

- Зміна складу `publishConfig.exports` чи розкладки субшляхів — міграція
  зберігає форму артефакта, а не переглядає її.
- Перехід `@simplycms/cli` і `create-simplycms-store` на бандлер: обидва —
  чистий ESM без збірки, і такими лишаються.
- Оптимізація часу збірки понад те, що дає сам Rolldown. Мета треку —
  зійти з покинутого інструмента, а не виграти секунди.
- `unbundle: true` (режим збереження структури джерел): він зробив би `dist/`
  дзеркалом `src/`, а не `exports`, і зламав би інваріант, що внутрішні
  модулі `db`/`auth` не мають шляху назовні.
- Заміна `tsc` на щось інше в емісії декларацій — це рішення зафіксовано
  розтином 2026-08-24 і треком не переглядається.

## Точка передачі

Після Task 9 — повернутись на валідацію з чотирма артефактами: вивід повного
ланцюга; вивід `pilot:pack`; звіт про живий прогін (обидва контури — вітрина
й `/admin/order-statuses`); `git log --oneline` треку. Гілка `claude/track-t-tsdown`
НЕ мержиться без рішення власника: мерж у `main` публікує пакети на npm.

Наступний план після треку T — **Е2: Storage-мінімум** (`MediaProvider` +
драйвер `local-fs`), далі **Е3: каталог on-demand** із беклогом Е1б/Е1а
(див. роадмап, блок К3).
