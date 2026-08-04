# create-simplycms-store + bootstrap власника — імплементаційний план

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. План сумісний із `/виконай-задачу` (фази = Tasks, кроки = `- [ ] **Step N:**`).

**Goal:** Опублікований пакет `create-simplycms-store` створює окремий git-репозиторій магазину зі справжніх npm-пакетів `@simplycms/*`, а `pnpm owner:invite` у створеному магазині безпечно робить власником конкретну людину — без вікна «хто перший зайшов».

**Architecture:** Шаблон магазину живе всередині пакета (`packages/create-simplycms-store/template/`) і стає єдиним джерелом правди: синкований генерат з монорепо (11 host-файлів, міграції, тема, плагін) стережеться парність-тестами за моделлю `pilot-seed`, а пілот пакування перебудовується споживати цей самий шаблон — `pilot:e2e` стає e2e-тестом справжнього create-флоу. Bootstrap власника — push-модель: `auth.admin.inviteUserByEmail` + INSERT ролі `admin` через service_role з консолі розробника; єдиний runtime-код у ядрі — канонічна сторінка `/auth/set-password`.

**Tech Stack:** Node ≥20 ESM (`.mjs`, без збірки для CLI), @clack/prompts, @supabase/supabase-js v2 (Admin API), TanStack Start/Router (наявний контур), Vitest 4, Zod 4, @simplycms/i18n.

**Джерело правди скоупу:** [`docs/superpowers/specs/2026-08-03-create-store-owner-bootstrap-design.md`](../specs/2026-08-03-create-store-owner-bootstrap-design.md). Поза скоупом (спека §8): `@simplycms/cli`, деплой-артефакти, автостворення Supabase-проєкту, вибір теми в промптах, migrate-on-boot, переведення серверного env на `process.env`.

## Global Constraints

- **Гейти після КОЖНОГО Task** (канонічний порядок): `pnpm install --frozen-lockfile && pnpm format:check && pnpm lint && pnpm build && pnpm typecheck && pnpm test`. `build` перед `typecheck` (генерує `src/routeTree.gen.ts`); `format:check`, не `format`. Task 6 і Task 8 додатково ганяють `pnpm build:packages && pnpm test:packaging` і `pnpm pilot:pack`.
- 🔴 Після БУДЬ-ЯКОЇ зміни `package.json` (нові пакети/залежності): спершу звичайний `pnpm install` (оновлює `pnpm-lock.yaml`), закомітити lockfile разом зі зміною; далі гейти вже з `--frozen-lockfile` (урок PR #20 — CI падає з `ERR_PNPM_OUTDATED_LOCKFILE`).
- `pnpm lint` = **0 errors** (≈961 warnings — норма, i18n-селектори не чіпати й не глушити).
- Strict TypeScript, без `any`; коментарі українською; файли ≤150 рядків (розбивати на модулі).
- Нові UI-рядки — **одразу через `useT`** (`@simplycms/i18n`), ключі спершу в `uk.ts` (джерело `MessageKey`), потім у `en.ts`.
- `SUPABASE_SERVICE_ROLE_KEY` ніколи не пишеться в жоден файл (ні в репо, ні в шаблон, ні в `.env.local`) — лише env процесу на час запуску.
- Пошук по репо — тільки `git grep` (не `grep -r`).
- Кожен Task завершується комітом; повідомлення — `тип(scope): опис` українською (зразки: `git log --oneline -15`).

## Довідка для виконавця (перевірені факти, 2026-08-04)

- `pnpm-workspace.yaml` покриває лише `packages/simplycms/*`, `themes/*`, `plugins/*` — нову теку треба додати явно.
- `scripts/release/bump.mjs`: `PACKAGES_DIR = 'packages/simplycms'` — сканує тільки її; гард `currentVersion()` падає при розбіжності версій. Всі 21 манифест зараз `0.1.0`.
- `build:packages` = `pnpm --filter "@simplycms/*" run build` — новий unscoped пакет не зачіпає (CLI — чистий `.mjs`, без збірки).
- `scripts/pack-inspect.mjs:24`: `PACKAGES_ROOT = packages/simplycms` → `test:packaging` новий пакет не бачить (і не мусить: у нього немає `publishConfig.exports`).
- `scripts/audit-deps.mjs` / `audit-exports` — теж скоуплені на `packages/simplycms/*`; **не розширюємо** (аудитять subpath-exports runtime-пакетів; у CLI їх немає).
- `scripts/pilot-pack/scaffold.mjs:31-43`: `HOST_FILES` — 11 файлів, що копіюються З КОРЕНЯ монорепо; `:94-109` `writeManifest` (tarball-overrides); `:112-117` `writeEnv`.
- `tests/pilot/store-template/`: `package.json` (хардкод `@simplycms/*: 0.1.0` + third-party deps + плейсхолдер overrides), `routes.ts`, `simplycms.config.ts`, `src/engine.shared.ts`, `tailwind.config.ts`, `tsconfig.json`, `vite.config.ts` (з пілотним `emitBundleStats`), `src/routes/my/.gitkeep`.
- Auth-контур: `routes/auth/callback.tsx` вже обмінює `?code=` на сесію і редиректить на `?next=` (з захистом від open redirect). Роут-обгортки імпортують сторінки subpath-ом: `import Auth from '@simplycms/storefront-routes/pages/Auth'` (зразок — `routes/auth/index.tsx`). Зміна пароля вже є в `packages/simplycms/storefront-routes/src/pages/ProfileSettings.tsx:158` (`supabase.auth.updateUser({ password })`) — звідти ж брати спосіб отримання клієнта.
- `user_roles`: `id` PK + `unique("user_roles_user_id_role_key").on(userId, role)` (`packages/simplycms/schema/src/schema.ts:113-124`) → upsert `onConflict: 'user_id,role'`.
- Перший адмін зараз НЕ призначається без ручного SQL: тригер `handle_new_user` дає роль `user`; RLS на `user_roles` вимагає наявного адміна (`supabase/migrations/20260126120345_*.sql`). `service_role` обходить RLS.
- i18n-каталог — плоскі ключі (`'nav.profile': 'Профіль'`) у `packages/simplycms/i18n/src/catalogs/uk.ts` (+ частковий `en.ts`).
- Модель парність-тесту: `scripts/pilot-seed.mjs` (генерація) + `tests/pilot-seed.test.ts` (звірка) — повторити для шаблону.

---

## Етап A — пакет і шаблон

### Task 1: Каркас пакета + охоплення реліз-тулінгом

**Files:**
- Create: `packages/create-simplycms-store/package.json`, `packages/create-simplycms-store/README.md`, `packages/create-simplycms-store/src/index.mjs` (мінімальний вхід)
- Modify: `pnpm-workspace.yaml`, `scripts/release/bump.mjs`
- Test: `tests/release-bump-coverage.test.ts`

**Interfaces:**
- Produces: workspace-пакет `create-simplycms-store@0.1.0` (bin `create-simplycms-store` → `src/index.mjs`); `readPublishableManifests()` у `bump.mjs` повертає його разом із 21 `@simplycms/*`.

- [ ] **Step 1: Написати падаючий тест покриття bump-ом**

```ts
// tests/release-bump-coverage.test.ts
import { describe, expect, it } from 'vitest';
import { readPublishableManifests } from '../scripts/release/bump.mjs';

// Гард синхронної моделі версій: реліз-бамп мусить бачити ВСІ публіковані
// пакети, інакше версії розійдуться на першому ж релізі після появи пакета.
describe('release bump: покриття манифестів', () => {
  it('бачить create-simplycms-store і всі @simplycms/*', () => {
    const names = readPublishableManifests().map(({ manifest }) => manifest.name);
    expect(names).toContain('create-simplycms-store');
    expect(names.filter((n) => n.startsWith('@simplycms/')).length).toBeGreaterThanOrEqual(21);
  });

  it('версія одна на всіх (синхронна модель)', () => {
    const versions = new Set(readPublishableManifests().map(({ manifest }) => manifest.version));
    expect(versions.size).toBe(1);
  });
});
```

- [ ] **Step 2: Прогнати — впевнитись, що падає**

Run: `pnpm vitest run tests/release-bump-coverage.test.ts`
Expected: FAIL — `names` не містить `create-simplycms-store` (пакета ще немає).

- [ ] **Step 3: Створити манифест пакета**

`packages/create-simplycms-store/package.json` (версія = поточна версія ядра, зараз `0.1.0` — звір з `packages/simplycms/objects/package.json`):

```json
{
  "name": "create-simplycms-store",
  "version": "0.1.0",
  "description": "Скаффолдер магазину SimplyCMS: pnpm create simplycms-store my-shop",
  "type": "module",
  "license": "MIT",
  "bin": { "create-simplycms-store": "src/index.mjs" },
  "files": ["src", "template"],
  "engines": { "node": ">=20" },
  "publishConfig": {
    "access": "public",
    "registry": "https://registry.npmjs.org"
  }
}
```

`src/index.mjs` — тимчасовий вхід (Task 3 замінить):

```js
#!/usr/bin/env node
// Вхід CLI. Логіка зʼявиться в наступних кроках плану (Task 3).
console.log('create-simplycms-store: у розробці');
```

`README.md` — 5-10 рядків: що це, `pnpm create simplycms-store my-shop`, посилання на спеку.

- [ ] **Step 4: Додати теку у workspace і оновити lockfile**

У `pnpm-workspace.yaml` додати рядок:

```yaml
packages:
  - 'packages/simplycms/*'
  - 'packages/create-simplycms-store'
  - 'themes/*'
  - 'plugins/*'
```

Run: `pnpm install` (НЕ frozen — оновлює lockfile).

- [ ] **Step 5: Розширити bump.mjs**

У `scripts/release/bump.mjs` замінити константу і `readPublishableManifests`:

```js
const PACKAGES_DIR = 'packages/simplycms';
/** Публіковані пакети поза PACKAGES_DIR (unscoped скаффолдер). */
const STANDALONE_PACKAGE_DIRS = ['packages/create-simplycms-store'];
```

```js
export function readPublishableManifests() {
  const dirs = readdirSync(PACKAGES_DIR)
    .map((dir) => join(PACKAGES_DIR, dir))
    .concat(STANDALONE_PACKAGE_DIRS);
  const result = [];
  for (const dir of dirs) {
    const path = join(dir, 'package.json');
    if (!existsSync(path)) continue;
    const manifest = JSON.parse(readFileSync(path, 'utf8'));
    if (manifest.private === true) continue;
    result.push({ path, manifest });
  }
  return result;
}
```

- [ ] **Step 6: Тест зелений + повні гейти**

Run: `pnpm vitest run tests/release-bump-coverage.test.ts` → PASS.
Run: `pnpm install --frozen-lockfile && pnpm format:check && pnpm lint && pnpm build && pnpm typecheck && pnpm test` → усе зелене.

- [ ] **Step 7: Коміт**

```bash
git add packages/create-simplycms-store pnpm-workspace.yaml pnpm-lock.yaml scripts/release/bump.mjs tests/release-bump-coverage.test.ts
git commit -m "feat(create-store): каркас пакета create-simplycms-store + охоплення реліз-бампом"
```

### Task 2: Шаблон у пакеті + `template:sync` + парність-тести

**Files:**
- Create: `scripts/sync-create-store-template.mjs`; `packages/create-simplycms-store/template/**` (див. Step 2-3); Test: `tests/create-store-template-parity.test.ts`
- Modify: `package.json` (script `template:sync`), `eslint.config.mjs` (ignores), `tsconfig.json` (exclude)

**Interfaces:**
- Produces: `TEMPLATE_DIR`, `SYNCED_FILES`, `SYNCED_DIRS` (експорти `scripts/sync-create-store-template.mjs`) — споживають парність-тест (цей Task) і пілот (Task 6). Плейсхолдери шаблону: `__STORE_NAME__`, `__SIMPLYCMS_VERSION__` у `package.json.tpl` — споживає Task 3. Перейменування при scaffold: `package.json.tpl → package.json`, `gitignore → .gitignore`, `env.example → .env.example` (npm pack ламає/виключає dot-файли — тому в шаблоні без крапки).

- [ ] **Step 1: Написати sync-скрипт (джерело правди переліків)**

```js
// scripts/sync-create-store-template.mjs
// Синхронізує генеровану частину шаблону create-simplycms-store з монорепо.
// Статичні файли шаблону (package.json.tpl, vite.config.ts, README тощо)
// НЕ чіпає — їхнє джерело правди сам шаблон.
import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';

export const TEMPLATE_DIR = 'packages/create-simplycms-store/template';

/** Host-файли: байт-ідентичні кореню монорепо (та сама 11-ка, що в пілоті). */
export const SYNCED_FILES = [
  'server.mjs',
  'server-runtime.mjs',
  'src/styles/globals.css',
  'src/routes/__root.tsx',
  'src/start.ts',
  'src/client.tsx',
  'src/router.tsx',
  'src/server.ts',
  'src/server/engine.ts',
  'src/engine-provider.tsx',
  'src/theme-registry.ts',
];

/** Теки: байт-ідентичні монорепо (snapshot на момент релізу). */
export const SYNCED_DIRS = [
  { from: 'supabase/migrations', to: 'supabase/migrations' },
  { from: 'themes/default', to: 'themes/default' },
  { from: 'plugins/hello-world', to: 'plugins/hello-world' },
];

export function syncTemplate(root = '.') {
  for (const file of SYNCED_FILES) {
    const target = join(root, TEMPLATE_DIR, file);
    mkdirSync(dirname(target), { recursive: true });
    cpSync(join(root, file), target);
  }
  for (const { from, to } of SYNCED_DIRS) {
    const target = join(root, TEMPLATE_DIR, to);
    rmSync(target, { recursive: true, force: true });
    cpSync(join(root, from), target, { recursive: true });
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  syncTemplate();
  console.log('Шаблон синхронізовано з монорепо.');
}
```

У кореневий `package.json` (блок scripts) додати: `"template:sync": "node scripts/sync-create-store-template.mjs"`.

- [ ] **Step 2: Написати падаючий парність-тест**

```ts
// tests/create-store-template-parity.test.ts
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  SYNCED_DIRS,
  SYNCED_FILES,
  TEMPLATE_DIR,
} from '../scripts/sync-create-store-template.mjs';

// Шаблон create-simplycms-store — генерат: дрейф із монорепо лагодиться
// `pnpm template:sync`, а не руками (модель tests/pilot-seed.test.ts).
const read = (p: string) => readFileSync(p, 'utf8');
const listFiles = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true, recursive: true })
    .filter((e) => e.isFile())
    .map((e) => join(e.parentPath ?? e.path, e.name).slice(dir.length + 1))
    .sort();

describe('create-store template: парність із монорепо', () => {
  it.each(SYNCED_FILES)('host-файл %s байт-ідентичний', (file) => {
    expect(read(join(TEMPLATE_DIR, file))).toBe(read(file));
  });

  it.each(SYNCED_DIRS.map((d) => [d.from, d.to] as const))(
    'тека %s байт-ідентична',
    (from, to) => {
      const source = listFiles(from);
      expect(listFiles(join(TEMPLATE_DIR, to))).toEqual(source);
      for (const f of source) {
        expect(read(join(TEMPLATE_DIR, to, f))).toBe(read(join(from, f)));
      }
    },
  );

  it('deps шаблону і пілот-фікстури не розійшлися', () => {
    const tpl = JSON.parse(
      read(join(TEMPLATE_DIR, 'package.json.tpl'))
        .replaceAll('__SIMPLYCMS_VERSION__', '0.0.0')
        .replaceAll('__STORE_NAME__', 'x'),
    );
    const pilot = JSON.parse(read('tests/pilot/store-template/package.json'));
    expect(Object.keys(tpl.dependencies).sort()).toEqual(
      Object.keys(pilot.dependencies).sort(),
    );
  });
});
```

Run: `pnpm vitest run tests/create-store-template-parity.test.ts` → FAIL (шаблону немає).

- [ ] **Step 3: Наповнити шаблон**

1. `pnpm template:sync` — генерує синковану частину.
2. Статичні файли — скопіювати з `tests/pilot/store-template/` і адаптувати:
   - `template/routes.ts`, `template/simplycms.config.ts`, `template/src/engine.shared.ts`, `template/tailwind.config.ts`, `template/tsconfig.json` — копії 1:1 з пілот-фікстури; `template/src/routes/my/.gitkeep` — порожня тека роутів магазину.
   - `template/vite.config.ts` — копія `tests/pilot/store-template/vite.config.ts` **мінус** пілотна діагностика: видалити імпорт `emitBundleStats` і його виклик у `plugins` (це єдина відмінність; решту не чіпати).
   - `template/package.json.tpl` — на основі `tests/pilot/store-template/package.json`: `"name": "__STORE_NAME__"`, `"private": true`, версії всіх `@simplycms/*` → `"__SIMPLYCMS_VERSION__"`, БЕЗ блоку `overrides`; у `scripts` додати `"owner:invite": "node scripts/owner-invite.mjs"` (сам скрипт — Task 4).
   - `template/env.example` — 4 змінні з `.env.example` кореня (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SITE_URL`, коментар про legacy `VITE_SUPABASE_ANON_KEY`).
   - `template/gitignore` — `node_modules/`, `dist/`, `.env.local`, `src/routeTree.gen.ts`.
   - `template/README.md` — «наступні кроки»: 1) заповнити `.env.local` (Connect-панель Supabase Dashboard); 2) `supabase link --project-ref <ref> && supabase db push`; 3) `OWNER_EMAIL=... SUPABASE_SERVICE_ROLE_KEY=... pnpm owner:invite`; 4) `pnpm dev`; прод — `pnpm build && pnpm start`.

- [ ] **Step 4: Виключення для тулінгу**

- `eslint.config.mjs` → у `ignores` додати `'packages/create-simplycms-store/template/**'` (поруч із `'tests/pilot/store-template/**'`, з аналогічним коментарем).
- `tsconfig.json` → в `exclude` додати `"packages/create-simplycms-store/template"`.

- [ ] **Step 5: Тести зелені + повні гейти**

Run: `pnpm vitest run tests/create-store-template-parity.test.ts` → PASS.
Run: повний блок гейтів із Global Constraints → зелений. Якщо `format:check` червоніє на файлах шаблону — виправити `pnpm format` і перевірити, що парність не зламалась (host-джерела вже відформатовані, тож зміни бути не повинно; якщо є — синковані файли в `.prettierignore` НЕ додавати, а розібратись, чому джерело неформатоване).

- [ ] **Step 6: Коміт**

```bash
git add packages/create-simplycms-store/template scripts/sync-create-store-template.mjs tests/create-store-template-parity.test.ts package.json eslint.config.mjs tsconfig.json
git commit -m "feat(create-store): шаблон магазину в пакеті + template:sync + парність-тести"
```

---

## Етап B — CLI і власник

### Task 3: Логіка CLI скаффолдера

**Files:**
- Create: `packages/create-simplycms-store/src/args.mjs`, `src/scaffold.mjs`; Rewrite: `src/index.mjs`
- Modify: `packages/create-simplycms-store/package.json` (dependency `@clack/prompts`), `pnpm-lock.yaml`
- Test: `tests/create-store-cli.test.ts`

**Interfaces:**
- Consumes: `TEMPLATE_DIR`-структуру і плейсхолдери з Task 2.
- Produces: `resolveOptions(argv, env, isTTY)` → `{ storeName?, supabaseUrl?, supabaseKey?, install: boolean, git: boolean, yes: boolean }`; `renderManifest(tpl, { storeName, version })` → string; `scaffold({ templateDir, targetDir, storeName, version, supabaseUrl?, supabaseKey? })` — розгортає магазин. Ці ж функції використовує ручний smoke і майбутні тести.

- [ ] **Step 1: Додати залежність промптів**

Run: `pnpm --dir packages/create-simplycms-store add @clack/prompts` (оновить lockfile).

- [ ] **Step 2: Написати падаючі юніти на чисті функції**

```ts
// tests/create-store-cli.test.ts
import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveOptions } from '../packages/create-simplycms-store/src/args.mjs';
import { renderManifest, scaffold } from '../packages/create-simplycms-store/src/scaffold.mjs';

describe('create-store CLI', () => {
  it('resolveOptions: прапорці перекривають промпти; CI ⇒ yes', () => {
    const o = resolveOptions(
      ['my-shop', '--supabase-url', 'https://x.supabase.co', '--supabase-key', 'sb_pk', '--no-install', '--no-git'],
      { CI: 'true' },
      false,
    );
    expect(o).toMatchObject({
      storeName: 'my-shop',
      supabaseUrl: 'https://x.supabase.co',
      supabaseKey: 'sb_pk',
      install: false,
      git: false,
      yes: true,
    });
  });

  it('renderManifest підставляє імʼя і версію в усі @simplycms/*', () => {
    const tpl = '{"name":"__STORE_NAME__","dependencies":{"@simplycms/ui":"__SIMPLYCMS_VERSION__"}}';
    const out = JSON.parse(renderManifest(tpl, { storeName: 'shop', version: '0.1.0' }));
    expect(out.name).toBe('shop');
    expect(out.dependencies['@simplycms/ui']).toBe('0.1.0');
  });

  it('scaffold: перейменовує tpl/gitignore/env.example і пише .env.local', async () => {
    const target = mkdtempSync(join(tmpdir(), 'css-'));
    await scaffold({
      templateDir: 'packages/create-simplycms-store/template',
      targetDir: target,
      storeName: 'demo',
      version: '0.1.0',
      supabaseUrl: 'https://x.supabase.co',
      supabaseKey: 'sb_pk',
    });
    expect(existsSync(join(target, 'package.json'))).toBe(true);
    expect(existsSync(join(target, '.gitignore'))).toBe(true);
    expect(existsSync(join(target, '.env.example'))).toBe(true);
    expect(existsSync(join(target, 'package.json.tpl'))).toBe(false);
    expect(readFileSync(join(target, '.env.local'), 'utf8')).toContain('VITE_SUPABASE_URL=https://x.supabase.co');
    expect(JSON.parse(readFileSync(join(target, 'package.json'), 'utf8')).name).toBe('demo');
  });
});
```

Run: `pnpm vitest run tests/create-store-cli.test.ts` → FAIL.

- [ ] **Step 3: Імплементувати args.mjs**

```js
// packages/create-simplycms-store/src/args.mjs
// Розбір аргументів. Неінтерактивність: --yes АБО CI=true АБО не-TTY.
export function resolveOptions(argv, env = process.env, isTTY = process.stdout.isTTY) {
  const options = { install: true, git: true, yes: false };
  const rest = [];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--yes' || arg === '-y') options.yes = true;
    else if (arg === '--no-install') options.install = false;
    else if (arg === '--no-git') options.git = false;
    else if (arg === '--supabase-url') options.supabaseUrl = argv[(i += 1)];
    else if (arg === '--supabase-key') options.supabaseKey = argv[(i += 1)];
    else if (arg.startsWith('-')) throw new Error(`Невідомий прапорець: ${arg}`);
    else rest.push(arg);
  }
  if (rest[0]) options.storeName = rest[0];
  if (env.CI === 'true' || !isTTY) options.yes = true;
  return options;
}
```

- [ ] **Step 4: Імплементувати scaffold.mjs**

```js
// packages/create-simplycms-store/src/scaffold.mjs
// Розгортання шаблону: копія, перейменування службових імен, підстановки.
import { cpSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/** npm pack псує dot-файли — у шаблоні вони без крапки/із суфіксом .tpl. */
const RENAMES = {
  'package.json.tpl': 'package.json',
  gitignore: '.gitignore',
  'env.example': '.env.example',
};

export function renderManifest(tpl, { storeName, version }) {
  return tpl
    .replaceAll('__STORE_NAME__', storeName)
    .replaceAll('__SIMPLYCMS_VERSION__', version);
}

export async function scaffold(input) {
  const { templateDir, targetDir, storeName, version } = input;
  cpSync(templateDir, targetDir, { recursive: true });
  for (const [from, to] of Object.entries(RENAMES)) {
    renameSync(join(targetDir, from), join(targetDir, to));
  }
  const manifestPath = join(targetDir, 'package.json');
  writeFileSync(manifestPath, renderManifest(readFileSync(manifestPath, 'utf8'), { storeName, version }));
  if (input.supabaseUrl && input.supabaseKey) {
    writeFileSync(
      join(targetDir, '.env.local'),
      [
        `VITE_SUPABASE_URL=${input.supabaseUrl}`,
        `VITE_SUPABASE_PUBLISHABLE_KEY=${input.supabaseKey}`,
        `VITE_SITE_URL=http://localhost:3000`,
        '',
      ].join('\n'),
    );
  }
}
```

- [ ] **Step 5: Юніти зелені**

Run: `pnpm vitest run tests/create-store-cli.test.ts` → PASS.

- [ ] **Step 6: Зібрати index.mjs (промпти + оркестрація)**

Переписати `src/index.mjs`: `#!/usr/bin/env node`; прочитати власну версію з `package.json` пакета (`new URL('../package.json', import.meta.url)`); `resolveOptions(process.argv.slice(2))`; якщо НЕ `yes` — промпти @clack/prompts (`intro` → `text` імʼя, якщо не задане → `text` Supabase URL і key з підказкою «Dashboard → Connect; Enter — пропустити» → `confirm` «Встановити залежності?»); виклик `scaffold({ templateDir: new URL('../template', import.meta.url).pathname, targetDir: resolve(storeName), storeName, version, ... })`; далі, якщо `git` — `git init` + `git add -A` + `git commit -m "chore: init simplycms store"` (через `execSync`, `cwd: targetDir`, у try/catch — відсутність git не валить scaffold); якщо `install` — встановлення менеджером із `npm_config_user_agent` (pnpm/npm/yarn, дефолт pnpm); `outro` з трьома наступними кроками (як у README шаблону). Кожна гілка помилки — зрозуміле повідомлення і `process.exitCode = 1`. Файл ≤150 рядків; якщо не влазить — винести вивід/встановлення в `src/steps.mjs`.

- [ ] **Step 7: Ручний smoke**

```bash
node packages/create-simplycms-store/src/index.mjs /tmp/claude-smoke-shop --yes --no-install --no-git \
  --supabase-url https://example.supabase.co --supabase-key sb_publishable_x
ls -la /tmp/claude-smoke-shop   # package.json, .gitignore, .env.local, routes.ts, supabase/migrations/...
rm -rf /tmp/claude-smoke-shop
```

Expected: структура на місці, `package.json.name = claude-smoke-shop`-подібне імʼя з аргументу, версії `@simplycms/*` = версії пакета.

- [ ] **Step 8: Повні гейти + коміт**

Гейти з Global Constraints → зелені.

```bash
git add packages/create-simplycms-store pnpm-lock.yaml tests/create-store-cli.test.ts
git commit -m "feat(create-store): CLI скаффолдера — промпти, прапорці, розгортання шаблону"
```

### Task 4: owner-invite у шаблоні

**Files:**
- Create: `packages/create-simplycms-store/template/scripts/owner-invite-core.mjs`, `template/scripts/owner-invite.mjs`
- Test: `tests/owner-invite.test.ts`

**Interfaces:**
- Consumes: шаблон Task 2 (`package.json.tpl` вже має script `owner:invite`).
- Produces: `runOwnerInvite({ admin, email, redirectTo, log })` → `Promise<{ userId: string, invited: boolean, roleAdded: boolean }>`; `redirectTo` = `${siteUrl}/auth/callback?next=/auth/set-password` — сторінку дає Task 5.

- [ ] **Step 1: Написати падаючі юніти з фейковим admin-клієнтом**

```ts
// tests/owner-invite.test.ts
import { describe, expect, it, vi } from 'vitest';
import { runOwnerInvite } from '../packages/create-simplycms-store/template/scripts/owner-invite-core.mjs';

const makeAdmin = ({ inviteError = null, users = [] as { id: string; email: string }[] } = {}) => {
  const upsert = vi.fn().mockResolvedValue({ error: null });
  return {
    client: {
      auth: {
        admin: {
          inviteUserByEmail: vi.fn().mockResolvedValue(
            inviteError
              ? { data: { user: null }, error: inviteError }
              : { data: { user: { id: 'new-id' } }, error: null },
          ),
          listUsers: vi.fn().mockResolvedValue({ data: { users }, error: null }),
        },
      },
      from: vi.fn().mockReturnValue({ upsert }),
    },
    upsert,
  };
};

describe('owner-invite', () => {
  it('новий email: invite + роль admin', async () => {
    const { client, upsert } = makeAdmin();
    const result = await runOwnerInvite({ admin: client, email: 'o@x.com', redirectTo: 'https://s/auth/callback?next=/auth/set-password', log: () => {} });
    expect(result).toMatchObject({ userId: 'new-id', invited: true, roleAdded: true });
    expect(upsert).toHaveBeenCalledWith(
      { user_id: 'new-id', role: 'admin' },
      { onConflict: 'user_id,role', ignoreDuplicates: true },
    );
  });

  it('email існує: знаходить id через listUsers і дописує роль', async () => {
    const { client } = makeAdmin({
      inviteError: { code: 'email_exists', status: 422 },
      users: [{ id: 'old-id', email: 'o@x.com' }],
    });
    const result = await runOwnerInvite({ admin: client, email: 'o@x.com', redirectTo: 'r', log: () => {} });
    expect(result).toMatchObject({ userId: 'old-id', invited: false, roleAdded: true });
  });

  it('інша помилка invite — кидає', async () => {
    const { client } = makeAdmin({ inviteError: { code: 'over_email_send_rate_limit', status: 429 } });
    await expect(runOwnerInvite({ admin: client, email: 'o@x.com', redirectTo: 'r', log: () => {} })).rejects.toThrow();
  });
});
```

Run: `pnpm vitest run tests/owner-invite.test.ts` → FAIL.

- [ ] **Step 2: Імплементувати core**

```js
// packages/create-simplycms-store/template/scripts/owner-invite-core.mjs
// Ядро owner:invite — чиста логіка з інʼєкцією service_role-клієнта,
// щоб тестувалась без мережі. Модель загроз — спека 2026-08-03 §4.2.

async function findUserIdByEmail(admin, email) {
  for (let page = 1; page <= 50; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`listUsers: ${error.message ?? error.code}`);
    const hit = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (hit) return hit.id;
    if (data.users.length < 200) break;
  }
  throw new Error(`Користувача ${email} не знайдено попри email_exists — перевір проєкт.`);
}

export async function runOwnerInvite({ admin, email, redirectTo, log }) {
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo });
  let userId;
  let invited = false;
  if (error) {
    if (error.code !== 'email_exists' && error.status !== 422) {
      throw new Error(`inviteUserByEmail: ${error.message ?? error.code}`);
    }
    log(`Користувач ${email} уже існує — invite не потрібен, перевіряю роль.`);
    userId = await findUserIdByEmail(admin, email);
  } else {
    userId = data.user.id;
    invited = true;
    log(`Запрошення надіслано на ${email}.`);
  }
  const roleResult = await admin
    .from('user_roles')
    .upsert({ user_id: userId, role: 'admin' }, { onConflict: 'user_id,role', ignoreDuplicates: true });
  if (roleResult.error) throw new Error(`user_roles upsert: ${roleResult.error.message}`);
  log(`Роль admin закріплена за ${email}.`);
  return { userId, invited, roleAdded: true };
}
```

- [ ] **Step 3: CLI-обгортка**

```js
// packages/create-simplycms-store/template/scripts/owner-invite.mjs
// Запуск: OWNER_EMAIL=... SUPABASE_SERVICE_ROLE_KEY=... pnpm owner:invite
// service_role-ключ живе ЛИШЕ в env цього процесу — не в .env.local.
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { runOwnerInvite } from './owner-invite-core.mjs';

function readEnvLocal() {
  try {
    return Object.fromEntries(
      readFileSync('.env.local', 'utf8')
        .split('\n')
        .filter((line) => line.includes('=') && !line.trimStart().startsWith('#'))
        .map((line) => [line.slice(0, line.indexOf('=')).trim(), line.slice(line.indexOf('=') + 1).trim()]),
    );
  } catch {
    return {};
  }
}

const local = readEnvLocal();
const url = process.env.VITE_SUPABASE_URL ?? local.VITE_SUPABASE_URL;
const siteUrl = process.env.VITE_SITE_URL ?? local.VITE_SITE_URL ?? 'http://localhost:3000';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.env.OWNER_EMAIL;

if (!url || !serviceKey || !email) {
  console.error(
    'Потрібні: VITE_SUPABASE_URL (env або .env.local), SUPABASE_SERVICE_ROLE_KEY і OWNER_EMAIL (env).',
  );
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

runOwnerInvite({
  admin,
  email,
  redirectTo: `${siteUrl.replace(/\/$/, '')}/auth/callback?next=/auth/set-password`,
  log: (message) => console.log(message),
}).catch((error) => {
  console.error(error.message);
  process.exit(1);
});
```

- [ ] **Step 4: Тести зелені + гейти + коміт**

Run: `pnpm vitest run tests/owner-invite.test.ts` → PASS; повні гейти → зелені.

```bash
git add packages/create-simplycms-store/template/scripts tests/owner-invite.test.ts
git commit -m "feat(create-store): owner:invite — запрошення власника + роль admin через service_role"
```

### Task 5: Канонічна сторінка `/auth/set-password`

**Files:**
- Create: `packages/simplycms/storefront-routes/routes/auth/set-password.tsx`, `packages/simplycms/storefront-routes/src/pages/AuthSetPassword.tsx`
- Modify: `packages/simplycms/i18n/src/catalogs/uk.ts`, `packages/simplycms/i18n/src/catalogs/en.ts`; `packages/simplycms/storefront-routes/package.json` — ЛИШЕ якщо subpath `./pages/*` не покриває нову сторінку wildcard-ом (перевір `exports`/`publishConfig.exports`; якщо там wildcard `./pages/*` — правки не потрібні)
- Test: `tests/auth-set-password.test.tsx`

**Interfaces:**
- Consumes: redirect-ланцюг Task 4: invite-лінк → GoTrue → `/auth/callback?next=/auth/set-password` (обмін `?code=` вже реалізований у `routes/auth/callback.tsx`) → ця сторінка з активною сесією.
- Produces: роут `/auth/set-password`; після успіху — `navigate({ to: '/admin' })`.

- [ ] **Step 1: Розвідка перед кодом (обовʼязково)**

```bash
git grep -n "supabase" packages/simplycms/storefront-routes/src/pages/ProfileSettings.tsx | head -5
git grep -n "\"./pages/\|'./pages/" packages/simplycms/storefront-routes/package.json
ls tests/ | grep -i "tsx"
```

Зафіксувати: (а) як ProfileSettings отримує supabase-клієнт — використати той самий імпорт; (б) чи `exports` має wildcard `./pages/*`; (в) зразок наявного компонентного тесту (`tests/*.test.tsx`) — повторити його setup (jsdom, провайдери).

- [ ] **Step 2: i18n-ключі**

В `uk.ts` (формат плоский, як `'cart.title'`):

```ts
  // Встановлення пароля після запрошення власника
  'auth.setPassword.title': 'Встановіть пароль',
  'auth.setPassword.description': 'Ви прийняли запрошення. Задайте пароль для входу в магазин.',
  'auth.setPassword.password': 'Пароль',
  'auth.setPassword.confirm': 'Повторіть пароль',
  'auth.setPassword.submit': 'Зберегти і продовжити',
  'auth.setPassword.mismatch': 'Паролі не збігаються',
  'auth.setPassword.tooShort': 'Мінімум 8 символів',
  'auth.setPassword.noSession': 'Посилання недійсне або протермінувалось. Попросіть надіслати запрошення повторно.',
  'auth.setPassword.error': 'Не вдалося зберегти пароль. Спробуйте ще раз.',
```

В `en.ts` — ті самі ключі англійською.

- [ ] **Step 3: Падаючий тест сторінки**

`tests/auth-set-password.test.tsx` — за setup-зразком знайденого в Step 1 тесту: рендер `AuthSetPassword` з замоканим supabase-модулем (`vi.mock` на модуль, знайдений у Step 1а): (1) без сесії — показує текст `auth.setPassword.noSession`; (2) із сесією: сабміт валідної пари паролів викликає `updateUser({ password })`. Використати `I18nProvider` як у зразку (або замокати `useT` → identity). Run → FAIL.

- [ ] **Step 4: Сторінка**

`src/pages/AuthSetPassword.tsx` (default export, як інші сторінки): `useT()`; отримання клієнта — імпорт зі Step 1а; на маунті `supabase.auth.getSession()` → без сесії рендерити `noSession`-стан із лінком на `/auth`; форма react-hook-form + zod (`z.object({ password: z.string().min(8, t('auth.setPassword.tooShort')), confirm: z.string() }).refine(d => d.password === d.confirm, { message: t('auth.setPassword.mismatch'), path: ['confirm'] })`); сабміт → `supabase.auth.updateUser({ password })` → успіх `navigate({ to: '/admin' })`, помилка — `auth.setPassword.error`. UI-примітиви — з `@simplycms/ui` (Card/Input/Button/Form — як у `Auth.tsx`). ≤150 рядків.

`routes/auth/set-password.tsx` — за зразком `routes/auth/index.tsx`:

```tsx
import { createFileRoute } from '@tanstack/react-router';
import AuthSetPassword from '@simplycms/storefront-routes/pages/AuthSetPassword';

/** Встановлення пароля після invite-редіректу (спека 2026-08-03 §4.4). */
export const Route = createFileRoute('/auth/set-password')({
  component: AuthSetPassword,
});
```

(Якщо в `routes/auth/index.tsx` є `ssr`-опція чи інший обовʼязковий патерн — повторити його.)

- [ ] **Step 5: Тести зелені + гейти + коміт**

Run: `pnpm vitest run tests/auth-set-password.test.tsx` → PASS. Повні гейти (build згенерує роут у `routeTree.gen.ts`; typecheck підтвердить типізацію `Link`/route id). Нові кириличні warning-и НЕ мають зʼявитись (сторінка повністю на `useT`) — перевірити: `pnpm lint 2>&1 | grep -c "no-restricted-syntax"` → ті самі ≈954.

```bash
git add packages/simplycms/storefront-routes packages/simplycms/i18n tests/auth-set-password.test.tsx
git commit -m "feat(storefront): сторінка /auth/set-password для invite-флоу власника"
```

---

## Етап C — пілот і фініш

### Task 6: Пілот споживає шаблон пакета

**Files:**
- Modify: `scripts/pilot-pack/scaffold.mjs`; Delete: дубльовані файли з `tests/pilot/store-template/` (лишаються ЛИШЕ `package.json` і `vite.config.ts` — пілотний оверлей)
- Test: наявні `tests/create-store-template-parity.test.ts` (deps-парність уже стереже) + прогін `pnpm pilot:pack`

**Interfaces:**
- Consumes: `TEMPLATE_DIR` з `scripts/sync-create-store-template.mjs` (Task 2).

- [ ] **Step 1: Перебудувати scaffold.mjs**

- ⚠️ Колізія імен: у `scripts/pilot-pack/scaffold.mjs:24` ВЖЕ є локальна
  `const TEMPLATE_DIR = join(REPO_ROOT, 'tests/pilot/store-template')` —
  перейменувати її на `PILOT_OVERLAY_DIR` (вона тепер вказує лише на оверлей),
  а `TEMPLATE_DIR` імпортувати з sync-скрипта.
- Імпортувати `TEMPLATE_DIR`, `SYNCED_FILES` з `scripts/sync-create-store-template.mjs`.
- `scaffoldStore()`: (1) скопіювати `TEMPLATE_DIR` → скретч (замість копіювання host-файлів з кореня і фікстури); (2) застосувати ті самі перейменування, що CLI (`package.json.tpl` видалити — пілот кладе власний manifest, `gitignore`/`env.example` можна ігнорувати або перейменувати — вибрати і задокументувати в коментарі); (3) поверх накласти пілотний оверлей: `tests/pilot/store-template/vite.config.ts` (з `emitBundleStats`) і `tests/pilot/store-template/package.json` (з overrides-плейсхолдером) — далі `writeManifest`/`writeEnv` працюють як зараз; (4) `themes/` і `plugins/hello-world` більше НЕ копіювати з кореня — вони вже в шаблоні.
- Видалити з `tests/pilot/store-template/` файли, що переїхали в шаблон: `routes.ts`, `simplycms.config.ts`, `src/engine.shared.ts`, `tailwind.config.ts`, `tsconfig.json`, `src/routes/my/.gitkeep`. Оновити шапковий коментар scaffold.mjs: джерело — шаблон create-simplycms-store, оверлей — пілот.

- [ ] **Step 2: Верифікація пілотом**

Run: `pnpm build:packages && pnpm pilot:pack`
Expected: Gates A, C, D — PASS (це головний доказ, що шаблон пакета еквівалентний старому scaffold-у).

- [ ] **Step 3: Повні гейти + коміт**

Повний блок гейтів + `pnpm test:packaging` → зелені.

```bash
git add scripts/pilot-pack/scaffold.mjs tests/pilot/store-template
git commit -m "refactor(pilot): scaffold споживає шаблон create-simplycms-store; фікстура стиснута до оверлею"
```

### Task 7: Gate E — owner-флоу в pilot:e2e

**Files:**
- Create: `scripts/pilot-pack/gate-e.mjs`
- Modify: `scripts/pilot-pack/e2e.mjs` (видобути service_role key локального стеку), `scripts/pilot-pack.mjs` (запуск Gate E у `--e2e`), `scripts/pilot-pack/gate-b.mjs` (додати `/auth/set-password` до перевірених шляхів → очікування 200)

**Interfaces:**
- Consumes: `template/scripts/owner-invite.mjs` (Task 4), роут `/auth/set-password` (Task 5), локальний стек `supabase start` (`e2e.mjs` вже піднімає його і робить `db reset`).

- [ ] **Step 1: Видобути service_role key стеку**

У `e2e.mjs` після старту стеку: `supabase status -o env` (або `supabase status --output json` — перевірити фактичний вивід встановленої версії CLI) → витягти `SERVICE_ROLE_KEY` і `API_URL`, передати в контекст гейтів поряд з наявними ключами.

- [ ] **Step 2: gate-e.mjs**

```js
// scripts/pilot-pack/gate-e.mjs
// Gate E: owner-флоу. Проти ЛОКАЛЬНОГО стеку (ніколи проти живої БД):
// 1) owner-invite призначає роль admin запрошеному;
// 2) звичайний signup ролі admin НЕ отримує;
// 3) повторний запуск owner-invite ідемпотентний.
import { execFileSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';

export async function runGateE({ storeDir, supabaseUrl, serviceRoleKey }) {
  const ownerEmail = 'owner-gate-e@pilot.local';
  const run = () =>
    execFileSync('node', ['scripts/owner-invite.mjs'], {
      cwd: storeDir,
      env: {
        ...process.env,
        VITE_SUPABASE_URL: supabaseUrl,
        VITE_SITE_URL: 'http://localhost:3000',
        SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey,
        OWNER_EMAIL: ownerEmail,
      },
      stdio: 'pipe',
    }).toString();
  run();
  run(); // ідемпотентність: другий прогін не падає

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: users } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  const owner = users.users.find((u) => u.email === ownerEmail);
  if (!owner) throw new Error('Gate E: запрошеного користувача немає в auth.users');

  const roles = await admin.from('user_roles').select('role').eq('user_id', owner.id);
  if (!roles.data?.some((r) => r.role === 'admin')) {
    throw new Error('Gate E: у власника немає ролі admin');
  }

  const { data: shopper } = await admin.auth.admin.createUser({
    email: 'shopper-gate-e@pilot.local',
    password: 'shopper-password-1',
    email_confirm: true,
  });
  const shopperRoles = await admin.from('user_roles').select('role').eq('user_id', shopper.user.id);
  if (shopperRoles.data?.some((r) => r.role === 'admin')) {
    throw new Error('Gate E: звичайний користувач отримав admin — ДІРА');
  }
  return 'Gate E: PASS';
}
```

(Сигнатуру/спосіб підключення звірити з тим, як `pilot-pack.mjs` викликає gate-a…gate-d — повторити їхній контракт: параметри, логування, формат PASS/FAIL.)

- [ ] **Step 3: Підключити + gate-b доповнення**

У `pilot-pack.mjs` в `--e2e`-гілці після Gate B — виклик Gate E. У `gate-b.mjs` до списку шляхів додати `GET /auth/set-password` → очікуваний статус 200.

- [ ] **Step 4: Прогін і чесна фіксація**

Якщо Docker доступний: `pnpm pilot:e2e` → Gates A-E PASS. **Якщо Docker недоступний** — НЕ позначати крок виконаним: зафіксувати в підсумковому звіті сесії і в коміт-повідомленні «Gate E не проганявся локально — потрібен Docker» (та сама політика, що для `pilot:e2e` в роадмапі).

- [ ] **Step 5: Повні гейти + коміт**

```bash
git add scripts/pilot-pack
git commit -m "feat(pilot): Gate E — e2e owner-флоу проти локального стеку"
```

### Task 8: Документація + фінальний прогін

**Files:**
- Modify: `CLAUDE.md`, `docs/architecture/release-process.md`, `docs/tasks/platform-roadmap.md`, `docs/superpowers/specs/2026-08-03-create-store-owner-bootstrap-design.md` (§9)

- [ ] **Step 1: CLAUDE.md**

- Quick Reference: додати `pnpm template:sync` (регенерація шаблону create-simplycms-store з монорепо).
- Project Structure: додати `packages/create-simplycms-store/` (CLI + template) з одним рядком опису; у рядку scripts — `sync-create-store-template.mjs`.
- Розділ «Публікація пакетів»: «усі 21 пакет» → «усі 22 пакети (21 `@simplycms/*` + unscoped `create-simplycms-store`)»; згадати, що bump охоплює обидві теки (`STANDALONE_PACKAGE_DIRS` у `bump.mjs`).

- [ ] **Step 2: release-process.md + роадмап + спека**

- `release-process.md`: додати абзац про 22-й пакет (unscoped, без `build`-кроку, публікується тим самим `pnpm publish -r`).
- Роадмап, Фаза 2: відмітити `[x]` пункти `create-simplycms-store` і «Bootstrap власника» з датою і посиланням на цей план; якщо Gate E не проганявся через відсутність Docker — дописати це до наявної позначки «pilot:e2e ще не запускався».
- Спека §9: під кожним відкритим питанням дописати «**Розвʼязано (2026-08-XX):** …» — (1) callback уже обмінює code, додана сторінка set-password; (2) перелік фактично оновленого тулінгу; (3) обрано закомічені копії + `template:sync` + парність-тест.

- [ ] **Step 3: Фінальний повний прогін**

```bash
pnpm install --frozen-lockfile && pnpm format:check && pnpm lint && pnpm build && pnpm typecheck && pnpm test \
  && pnpm build:packages && pnpm test:packaging && pnpm pilot:pack
```

Expected: усе зелене. Будь-який червоний гейт — виправити ДО коміту, не рапортувати «переважно зелено».

- [ ] **Step 4: Коміт**

```bash
git add CLAUDE.md docs
git commit -m "docs: create-simplycms-store і owner:invite — синхронізація CLAUDE.md, release-process, роадмапу і спеки"
```

---

## Верифікація плану (self-review виконано автором плану)

- Покриття спеки: §3.1→Task 1, §3.2→Task 2 (+6), §3.3→Task 3, §4→Task 4-5, §6→Task 2/4/7, §7 DoD→Task 3 (smoke), 6 (pilot:pack), 7 (e2e), 8 (фінальний прогін + доки). §5 (pull-модель) — свідомо не в плані (спека: не v1).
- Узгодженість імен між тасками: `TEMPLATE_DIR`/`SYNCED_FILES`/`SYNCED_DIRS` (Task 2 → 6), `renderManifest`/`scaffold`/`resolveOptions` (Task 3), `runOwnerInvite` (Task 4 → 7), redirect `/auth/callback?next=/auth/set-password` (Task 4 ↔ 5 ↔ 7).
- Відомі точки, де виконавець МУСИТЬ звіритись із живим кодом (навмисно, бо точні рядки дрейфують): спосіб отримання supabase-клієнта сторінками (Task 5 Step 1), контракт виклику gate-* у `pilot-pack.mjs` (Task 7 Step 2), формат `supabase status` встановленої версії CLI (Task 7 Step 1).
