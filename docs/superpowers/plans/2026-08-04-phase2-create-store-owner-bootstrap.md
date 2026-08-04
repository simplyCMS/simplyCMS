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
- 🔴 **Чинний тригер робить першого зареєстрованого АДМІНОМ**: `supabase/migrations/20260213120000_fix_handle_new_user_trigger.sql:22-28` (`IF user_count <= 1 THEN user_role := 'admin'`). Це жива діра «хто перший встиг» — Task 4 прибирає її новою міграцією. RLS на `user_roles` вимагає наявного адміна для управління ролями; `service_role` обходить RLS.
- Invite-лінк за замовчуванням НЕ дає `?code=`: `routes/auth/callback.tsx` вміє лише `exchangeCodeForSession(code)`, а стандартний invite-лист веде через GoTrue `/verify` із токенами у fragment. SSR-шлях Supabase — кастомний email-шаблон із `{{ .TokenHash }}` + серверний роут із `verifyOtp({ type: 'invite', token_hash })` — його додає Task 5.
- Пілотні гейти оркеструються в `scripts/pilot-pack/run.mjs` (`runGates`, результат — масив `[name, { ok, details }]`; `runGateB` — приватна функція там само), підсумок друкує `scripts/pilot-pack/report.mjs`. Gate E вбудовується в `run.mjs` за цим контрактом.
- React-компонентні тести живуть у `packages/**/src/__tests__/*.test.tsx` з першим рядком `// @vitest-environment jsdom` (дефолтне середовище vitest — node); у `tests/` жодного `.test.tsx` немає.
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

- [X] **Step 1: Написати падаючий тест покриття bump-ом**

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

- [X] **Step 2: Прогнати — впевнитись, що падає**

Run: `pnpm vitest run tests/release-bump-coverage.test.ts`
Expected: FAIL — `names` не містить `create-simplycms-store` (пакета ще немає).

- [X] **Step 3: Створити манифест пакета**

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

- [X] **Step 4: Додати теку у workspace і оновити lockfile**

У `pnpm-workspace.yaml` додати рядок:

```yaml
packages:
  - 'packages/simplycms/*'
  - 'packages/create-simplycms-store'
  - 'themes/*'
  - 'plugins/*'
```

Run: `pnpm install` (НЕ frozen — оновлює lockfile).

- [X] **Step 5: Розширити bump.mjs**

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

- [X] **Step 6: Тест зелений + повні гейти**

Run: `pnpm vitest run tests/release-bump-coverage.test.ts` → PASS.
Run: `pnpm install --frozen-lockfile && pnpm format:check && pnpm lint && pnpm build && pnpm typecheck && pnpm test` → усе зелене.

- [X] **Step 7: Коміт**

```bash
git add packages/create-simplycms-store pnpm-workspace.yaml pnpm-lock.yaml scripts/release/bump.mjs tests/release-bump-coverage.test.ts
git commit -m "feat(create-store): каркас пакета create-simplycms-store + охоплення реліз-бампом"
```

### Task 2: Шаблон у пакеті + `template:sync` + парність-тести

**Files:**
- Create: `scripts/sync-create-store-template.mjs`; `packages/create-simplycms-store/template/**` (див. Step 2-3); Test: `tests/create-store-template-parity.test.ts`
- Modify: `package.json` (script `template:sync`), `eslint.config.mjs` (ignores), `tsconfig.json` (exclude)

**Interfaces:**
- Produces: `TEMPLATE_DIR`, `SYNCED_FILES`, `SYNCED_DIRS` (експорти `scripts/sync-create-store-template.mjs`) — споживають парність-тест (цей Task) і пілот (Task 6). Плейсхолдери шаблону: `__STORE_NAME__`, `__SIMPLYCMS_VERSION__` у `package.json.tpl` — споживає Task 3. Перейменування при scaffold: `package.json.tpl → package.json`, `gitignore → .gitignore`, `env.example → .env.example` (npm при паці спеціально обробляє `.gitignore`, політика щодо інших dot-файлів різниться між менеджерами — у шаблоні тримаємо без крапки як страховку; фактичний вміст tarball-а стереже смоук Task 6).

- [X] **Step 1: Написати sync-скрипт (джерело правди переліків)**

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

- [X] **Step 2: Написати падаючий парність-тест**

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

- [X] **Step 3: Наповнити шаблон**

1. `pnpm template:sync` — генерує синковану частину.
2. Статичні файли — скопіювати з `tests/pilot/store-template/` і адаптувати:
   - `template/routes.ts`, `template/src/engine.shared.ts`, `template/tailwind.config.ts`, `template/tsconfig.json` — копії 1:1 з пілот-фікстури; `template/src/routes/my/.gitkeep` — порожня тека роутів магазину.
   - `template/simplycms.config.ts` — НЕ 1:1: пілотна фікстура реєструє `@themes/solarstore` (`tests/pilot/store-template/simplycms.config.ts:26`), а шаблон везе лише `themes/default` — лишити в `themes:` тільки `default` (інакше згенерований магазин не збереться). Пілотна фікстура приводиться до того самого вигляду в Task 6.
   - `template/supabase/config.toml` — мінімальний конфіг, без нього `supabase link`/`db push` із теки магазину не працюють: `project_id = "__STORE_NAME__"` + секція `[auth]` із `site_url = "http://localhost:3000"`, `additional_redirect_urls = ["http://localhost:3000"]` + `[auth.email.template.invite]` з `content_path = "./supabase/templates/invite.html"`.
   - `template/supabase/templates/invite.html` — кастомний invite-шаблон (SSR-флоу з token_hash, див. Task 5): `<h2>Вас запрошено</h2><p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite&next=/auth/set-password">Прийняти запрошення</a></p>`. README шаблону мусить казати: для hosted-проєкту вставити цей самий шаблон у Dashboard → Authentication → Email Templates → Invite user (локальний стек бере його з config.toml автоматично).
   - `template/vite.config.ts` — копія `tests/pilot/store-template/vite.config.ts` **мінус** пілотна діагностика: видалити імпорт `emitBundleStats` і його виклик у `plugins` (це єдина відмінність; решту не чіпати).
   - `template/package.json.tpl` — на основі `tests/pilot/store-template/package.json`: `"name": "__STORE_NAME__"`, `"private": true`, версії всіх `@simplycms/*` → `"__SIMPLYCMS_VERSION__"`, БЕЗ блоку `overrides`; у `scripts` додати `"owner:invite": "node scripts/owner-invite.mjs"` (сам скрипт — Task 4).
   - `template/env.example` — 4 змінні з `.env.example` кореня (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SITE_URL`, коментар про legacy `VITE_SUPABASE_ANON_KEY`).
   - `template/gitignore` — `node_modules/`, `dist/`, `.env.local`, `src/routeTree.gen.ts`.
   - `template/README.md` — «наступні кроки»: 1) заповнити `.env.local` (Connect-панель Supabase Dashboard); 2) `supabase link --project-ref <ref> && supabase db push`; 3) `OWNER_EMAIL=... SUPABASE_SERVICE_ROLE_KEY=... pnpm owner:invite`; 4) `pnpm dev`; прод — `pnpm build && pnpm start`.

- [X] **Step 4: Виключення для тулінгу**

- `eslint.config.mjs` → у `ignores` додати `'packages/create-simplycms-store/template/**'` (поруч із `'tests/pilot/store-template/**'`, з аналогічним коментарем).
- `tsconfig.json` → в `exclude` додати `"packages/create-simplycms-store/template"`.

- [X] **Step 5: Тести зелені + повні гейти**

Run: `pnpm vitest run tests/create-store-template-parity.test.ts` → PASS.
Run: повний блок гейтів із Global Constraints → зелений. Якщо `format:check` червоніє на файлах шаблону — виправити `pnpm format` і перевірити, що парність не зламалась (host-джерела вже відформатовані, тож зміни бути не повинно; якщо є — синковані файли в `.prettierignore` НЕ додавати, а розібратись, чому джерело неформатоване).

- [X] **Step 6: Коміт**

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

- [X] **Step 1: Додати залежність промптів**

Run: `pnpm --dir packages/create-simplycms-store add @clack/prompts` (оновить lockfile).

- [X] **Step 2: Написати падаючі юніти на чисті функції**

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

- [X] **Step 3: Імплементувати args.mjs**

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

- [X] **Step 4: Імплементувати scaffold.mjs**

```js
// packages/create-simplycms-store/src/scaffold.mjs
// Розгортання шаблону: копія, перейменування службових імен, підстановки.
import { cpSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Службові імена шаблону: .gitignore npm при паці обробляє спеціально,
 * решта — страховка від розбіжних політик менеджерів. Вміст tarball-а
 * стереже create-pkg-smoke (пілот).
 */
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

- [X] **Step 5: Юніти зелені**

Run: `pnpm vitest run tests/create-store-cli.test.ts` → PASS.

- [X] **Step 6: Зібрати index.mjs (промпти + оркестрація)**

Переписати `src/index.mjs`: `#!/usr/bin/env node`; прочитати власну версію з `package.json` пакета (`new URL('../package.json', import.meta.url)`); `resolveOptions(process.argv.slice(2))`; якщо НЕ `yes` — промпти @clack/prompts (`intro` → `text` тека/імʼя, якщо не задані → `text` Supabase URL і key з підказкою «Dashboard → Connect; Enter — пропустити» → `confirm` «Встановити залежності?»). **Позиційний аргумент — це ТЕКА призначення** (може бути шляхом типу `../shops/my-shop`); імʼя пакета — `basename(resolve(targetDir))`, валідоване `/^[a-z0-9][a-z0-9._-]*$/` (інакше зрозуміла помилка «некоректне npm-імʼя»); `templateDir` — через `fileURLToPath(new URL('../template', import.meta.url))` (НЕ `.pathname` — ламається на Windows). Виклик `scaffold({ templateDir, targetDir, storeName, version, ... })`; далі, якщо `git` — `git init` + `git add -A` + `git commit -m "chore: init simplycms store"` (через `execSync`, `cwd: targetDir`, у try/catch — відсутність git не валить scaffold); якщо `install` — встановлення менеджером із `npm_config_user_agent` (pnpm/npm/yarn, дефолт pnpm); `outro` з наступними кроками (як у README шаблону, включно з нагадуванням про Invite-шаблон у Dashboard). Кожна гілка помилки — зрозуміле повідомлення і `process.exitCode = 1`. Файл ≤150 рядків; якщо не влазить — винести вивід/встановлення в `src/steps.mjs`.

- [X] **Step 7: Ручний smoke**

```bash
REPO="$PWD"; TMP="$(mktemp -d)"
(cd "$TMP" && node "$REPO/packages/create-simplycms-store/src/index.mjs" smoke-shop --yes --no-install --no-git \
  --supabase-url https://example.supabase.co --supabase-key sb_publishable_x \
  && ls -la smoke-shop)
rm -rf "$TMP"
```

Expected: структура на місці (`package.json`, `.gitignore`, `.env.local`, `routes.ts`, `supabase/config.toml`, `supabase/migrations/`, `scripts/owner-invite.mjs`), `package.json.name = "smoke-shop"` (basename, не шлях), версії `@simplycms/*` = версії пакета.

> Факт прогону (Task 3): усе перелічене на місці, `name = "smoke-shop"`,
> `@simplycms/*` = `0.1.0`. Виняток — `scripts/owner-invite.mjs`: його ще немає
> у шаблоні, він додається Task 4 (Step 2). Перевірити після Task 4.

- [X] **Step 8: Повні гейти + коміт**

Гейти з Global Constraints → зелені.

```bash
git add packages/create-simplycms-store pnpm-lock.yaml tests/create-store-cli.test.ts
git commit -m "feat(create-store): CLI скаффолдера — промпти, прапорці, розгортання шаблону"
```

### Task 4: Міграція «без авто-адміна» + owner-invite у шаблоні

**Files:**
- Create: `supabase/migrations/<UTC-timestamp>_first_user_no_auto_admin.sql`, `packages/create-simplycms-store/template/scripts/owner-invite-core.mjs`, `template/scripts/owner-invite.mjs`
- Modify: `packages/create-simplycms-store/template/supabase/migrations/` (регенерат `pnpm template:sync`)
- Test: `tests/owner-invite.test.ts`

**Interfaces:**
- Consumes: шаблон Task 2 (`package.json.tpl` вже має script `owner:invite`; лист будує GoTrue за `template/supabase/templates/invite.html` → лінк веде на `/auth/confirm`, роут дає Task 5).
- Produces: `runOwnerInvite({ admin, email, siteUrl, resend, log })` → `Promise<{ userId: string, invited: boolean, roleAdded: boolean, resendLink?: string }>`; міграція `first_user_no_auto_admin` (Gate E Task 7 доводить її дію).

- [x] **Step 0: Міграція — тригер більше не дарує admin першому**

Створити `supabase/migrations/<UTC-timestamp>_first_user_no_auto_admin.sql` (timestamp — поточний UTC `YYYYMMDDHHMMSS`; тіло — копія `20260213120000_fix_handle_new_user_trigger.sql` БЕЗ гілки `user_count`):

```sql
-- Прибирає авто-призначення admin першому зареєстрованому користувачу
-- (жива діра «хто перший встиг», Codex-аудит 2026-08-04): роль admin
-- відтепер призначає ЛИШЕ owner-invite (service_role) або наявний адмін.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    default_category_id UUID;
BEGIN
    SELECT id INTO default_category_id FROM public.user_categories WHERE is_default = true LIMIT 1;

    INSERT INTO public.profiles (user_id, email, first_name, last_name, category_id)
    VALUES (
        NEW.id,
        NEW.email,
        NEW.raw_user_meta_data ->> 'first_name',
        NEW.raw_user_meta_data ->> 'last_name',
        default_category_id
    );

    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'user'::app_role);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
```

Потім `pnpm template:sync` (snapshot міграцій у шаблоні) → `pnpm vitest run tests/create-store-template-parity.test.ts` → PASS. Застосування на живу dev-БД (`pnpm db:migrate`) — окрема дія власника після мержа; локальний стек застосує міграцію сам у `pilot:e2e` (`db reset`), Gate E (Task 7) саме це й перевіряє.

- [x] **Step 1: Написати падаючі юніти з фейковим admin-клієнтом**

```ts
// tests/owner-invite.test.ts
import { describe, expect, it, vi } from 'vitest';
import { runOwnerInvite } from '../packages/create-simplycms-store/template/scripts/owner-invite-core.mjs';

const makeAdmin = ({ inviteError = null, users = [] as { id: string; email: string }[] } = {}) => {
  const upsert = vi.fn().mockResolvedValue({ error: null });
  const generateLink = vi.fn().mockResolvedValue({
    data: { properties: { hashed_token: 'hash123' } },
    error: null,
  });
  return {
    client: {
      auth: {
        admin: {
          inviteUserByEmail: vi.fn().mockResolvedValue(
            inviteError
              ? { data: { user: null }, error: inviteError }
              : { data: { user: { id: 'new-id' } }, error: null },
          ),
          // nextPage: null — одна сторінка (тест на кілька сторінок нижче)
          listUsers: vi.fn().mockResolvedValue({ data: { users, nextPage: null }, error: null }),
          generateLink,
        },
      },
      from: vi.fn().mockReturnValue({ upsert }),
    },
    upsert,
    generateLink,
  };
};

describe('owner-invite', () => {
  it('новий email: invite (без options) + роль admin', async () => {
    const { client, upsert } = makeAdmin();
    const result = await runOwnerInvite({ admin: client, email: 'o@x.com', siteUrl: 'https://s', log: () => {} });
    expect(result).toMatchObject({ userId: 'new-id', invited: true, roleAdded: true });
    expect(client.auth.admin.inviteUserByEmail).toHaveBeenCalledWith('o@x.com');
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
    const result = await runOwnerInvite({ admin: client, email: 'o@x.com', siteUrl: 'https://s', log: () => {} });
    expect(result).toMatchObject({ userId: 'old-id', invited: false, roleAdded: true });
  });

  it('email існує + --resend: генерує одноразовий confirm-лінк', async () => {
    const { client, generateLink } = makeAdmin({
      inviteError: { code: 'email_exists', status: 422 },
      users: [{ id: 'old-id', email: 'o@x.com' }],
    });
    const result = await runOwnerInvite({ admin: client, email: 'o@x.com', siteUrl: 'https://s/', resend: true, log: () => {} });
    expect(generateLink).toHaveBeenCalledWith({ type: 'magiclink', email: 'o@x.com' });
    expect(result.resendLink).toBe('https://s/auth/confirm?token_hash=hash123&type=magiclink&next=/auth/set-password');
  });

  it('інший 422 (validation_failed) — кидає, а не маскує під email_exists', async () => {
    const { client } = makeAdmin({ inviteError: { code: 'validation_failed', status: 422 } });
    await expect(runOwnerInvite({ admin: client, email: 'bad', siteUrl: 'https://s', log: () => {} })).rejects.toThrow();
  });

  it('пагінація listUsers: іде за nextPage до знахідки', async () => {
    const { client } = makeAdmin({ inviteError: { code: 'email_exists', status: 422 } });
    client.auth.admin.listUsers = vi
      .fn()
      .mockResolvedValueOnce({ data: { users: [{ id: 'a', email: 'a@x.com' }], nextPage: 2 }, error: null })
      .mockResolvedValueOnce({ data: { users: [{ id: 'old-id', email: 'o@x.com' }], nextPage: null }, error: null });
    const result = await runOwnerInvite({ admin: client, email: 'o@x.com', siteUrl: 'https://s', log: () => {} });
    expect(result.userId).toBe('old-id');
  });
});
```

Run: `pnpm vitest run tests/owner-invite.test.ts` → FAIL.

- [x] **Step 2: Імплементувати core**

```js
// packages/create-simplycms-store/template/scripts/owner-invite-core.mjs
// Ядро owner:invite — чиста логіка з інʼєкцією service_role-клієнта,
// щоб тестувалась без мережі. Модель загроз — спека 2026-08-03 §4.2.
// Лист будує GoTrue за шаблоном supabase/templates/invite.html (token_hash
// → /auth/confirm), тому redirectTo у виклику invite не потрібен.

async function findUserIdByEmail(admin, email) {
  let page = 1;
  while (page != null) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`listUsers: ${error.message ?? error.code}`);
    const hit = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (hit) return hit.id;
    page = data.nextPage ?? null;
  }
  throw new Error(`Користувача ${email} не знайдено попри email_exists — перевір проєкт.`);
}

export async function runOwnerInvite({ admin, email, siteUrl, resend = false, log }) {
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email);
  let userId;
  let invited = false;
  let resendLink;
  if (error) {
    // ЛИШЕ email_exists — легальний стан «уже є»; будь-який інший код
    // (validation_failed, rate limit, …) — справжня помилка, не ковтати.
    if (error.code !== 'email_exists') {
      throw new Error(`inviteUserByEmail: ${error.message ?? error.code}`);
    }
    log(`Користувач ${email} уже існує — invite не потрібен, перевіряю роль.`);
    userId = await findUserIdByEmail(admin, email);
    if (resend) {
      // Для існуючого користувача invite повторно не шлеться — даємо
      // одноразовий magiclink на той самий /auth/confirm-роут.
      const link = await admin.auth.admin.generateLink({ type: 'magiclink', email });
      if (link.error) throw new Error(`generateLink: ${link.error.message ?? link.error.code}`);
      resendLink = `${siteUrl.replace(/\/$/, '')}/auth/confirm?token_hash=${link.data.properties.hashed_token}&type=magiclink&next=/auth/set-password`;
      log(`Одноразове посилання (передай власнику захищеним каналом, TTL ~1 год):\n  ${resendLink}`);
    }
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
  return { userId, invited, roleAdded: true, resendLink };
}
```

- [x] **Step 3: CLI-обгортка**

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
  siteUrl,
  resend: process.argv.includes('--resend'),
  log: (message) => console.log(message),
}).catch((error) => {
  console.error(error.message);
  process.exit(1);
});
```

- [x] **Step 4: Тести зелені + гейти + коміт**

Run: `pnpm vitest run tests/owner-invite.test.ts` → PASS; повні гейти → зелені.

```bash
git add supabase/migrations packages/create-simplycms-store/template tests/owner-invite.test.ts
git commit -m "feat(create-store): міграція без авто-адміна + owner:invite через service_role"
```

### Task 5: Серверний `/auth/confirm` + канонічна сторінка `/auth/set-password`

**Files:**
- Create: `packages/simplycms/storefront-routes/routes/auth/confirm.tsx`, `packages/simplycms/storefront-routes/routes/auth/set-password.tsx`, `packages/simplycms/storefront-routes/src/pages/AuthSetPassword.tsx`
- Modify: `packages/simplycms/i18n/src/catalogs/uk.ts`, `packages/simplycms/i18n/src/catalogs/en.ts`; `packages/simplycms/storefront-routes/package.json` — ЛИШЕ якщо subpath `./pages/*` не покриває нову сторінку wildcard-ом (перевір `exports`/`publishConfig.exports`; якщо там wildcard `./pages/*` — правки не потрібні)
- Test: `packages/simplycms/storefront-routes/src/__tests__/auth-set-password.test.tsx`, `packages/simplycms/storefront-routes/src/__tests__/auth-confirm-route.test.ts`

**Interfaces:**
- Consumes: invite-лист із шаблону Task 2 (`invite.html`): лінк = `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite&next=/auth/set-password`. Стандартний `?code=`-callback для invite НЕ працює (див. Довідку) — тому окремий серверний confirm-роут із `verifyOtp`.
- Produces: GET `/auth/confirm?token_hash&type&next` → сесія в auth-cookies + 302 на `next`; роут `/auth/set-password`; після успіху — `navigate({ to: '/admin' })`. Gate E (Task 7) фетчить `/auth/confirm` напряму.

**Фактично (виконання 2026-08-04):**
- `exports`/`publishConfig.exports` пакета `storefront-routes` уже мають wildcard
  `./pages/*` — правка манифесту під нову сторінку НЕ знадобилась.
- Натомість манифест довелось правити з іншої причини: `import type { EmailOtpType }`
  у `confirm.tsx` — перший bare-імпорт `@supabase/supabase-js` у цьому пакеті, і
  `tests/audit-deps.test.ts` червонів. Додано в `peerDependencies` (`^2.0.0`) —
  так само, як у `storefront`/`data-supabase`/`plugin-system`; шаблон магазину
  цей пакет уже везе в `dependencies`. `pnpm-lock.yaml` перегенеровано.
- Взірець `revalidate-theme-route.test.ts` handler НЕ викликає (лише асертить
  реєстрацію), тож виклик GET через `Route.options.server.handlers` написано з нуля;
  інваріант «файл роуту експортує лише `Route`» перенесено зі взірця.
- Сторінку розділено на два файли заради ліміту 150 рядків: `pages/AuthSetPassword.tsx`
  (гейт сесії + виклик Supabase) і `components/SetPasswordForm.tsx` (схема + поля).
- Клієнт Supabase сторінка бере хуком `useSupabaseClient` з
  `@simplycms/supabase/SupabaseProvider` — як `ProfileSettings.tsx`.
- `/auth/set-password` навмисно БЕЗ `beforeLoad`-редіректу залогіненого: користувач
  приходить туди саме із сесією після `verifyOtp`.

- [X] **Step 0: Серверний confirm-роут (за зразком callback.tsx)**

`routes/auth/confirm.tsx`:

```tsx
import { createFileRoute } from '@tanstack/react-router';
import { createServerSupabase } from '@simplycms/supabase/server-client';
import type { EmailOtpType } from '@supabase/supabase-js';

/**
 * Підтвердження email-лінків (invite/magiclink/recovery) за SSR-моделлю
 * Supabase: verifyOtp(token_hash) на сервері ставить auth-cookies і
 * редиректить на `next`. Редірект одразу прибирає токен з URL —
 * у History/Referer сторінок застосунку він не потрапляє.
 */
export const Route = createFileRoute('/auth/confirm')({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const { searchParams, origin } = new URL(request.url);
        const tokenHash = searchParams.get('token_hash');
        const type = searchParams.get('type') as EmailOtpType | null;

        // Той самий захист від open redirect, що в callback.tsx.
        const rawNext = searchParams.get('next') ?? '/';
        const next =
          rawNext.startsWith('/') &&
          !rawNext.startsWith('//') &&
          !rawNext.startsWith('/\\')
            ? rawNext
            : '/';

        if (tokenHash && type) {
          const supabase = createServerSupabase();
          const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
          if (!error) {
            return Response.redirect(`${origin}${next}`, 302);
          }
        }
        return Response.redirect(`${origin}/auth?error=auth_error`, 302);
      },
    },
  },
});
```

Юніт `src/__tests__/auth-confirm-route.test.ts` — за зразком сусіднього `revalidate-theme-route.test.ts` (подивись, як там мокається `createServerSupabase` і викликається handler): (1) валідний `token_hash+type` → 302 на `next`, `verifyOtp` викликано з `{ type, token_hash }`; (2) `next=//evil.com` → редірект на `/`; (3) без `token_hash` → редірект на `/auth?error=auth_error`.

- [X] **Step 1: Розвідка перед кодом (обовʼязково)**

```bash
git grep -n "supabase" packages/simplycms/storefront-routes/src/pages/ProfileSettings.tsx | head -5
git grep -n "\"./pages/\|'./pages/" packages/simplycms/storefront-routes/package.json
ls tests/ | grep -i "tsx"
```

Зафіксувати: (а) як ProfileSettings отримує supabase-клієнт — використати той самий імпорт; (б) чи `exports` має wildcard `./pages/*`; (в) зразок наявного компонентного тесту (`tests/*.test.tsx`) — повторити його setup (jsdom, провайдери).

- [X] **Step 2: i18n-ключі**

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

- [X] **Step 3: Падаючий тест сторінки**

`packages/simplycms/storefront-routes/src/__tests__/auth-set-password.test.tsx` — React-тести живуть САМЕ тут (у `tests/` кореня `.test.tsx` немає), перший рядок обовʼязково `// @vitest-environment jsdom` (дефолтне середовище vitest — node; зразок setup — сусідній `catalog-ssr.test.tsx`). Кейси: рендер `AuthSetPassword` з замоканим supabase-модулем (`vi.mock` на модуль, знайдений у Step 1а): (1) без сесії — показує текст `auth.setPassword.noSession`; (2) із сесією: сабміт валідної пари паролів викликає `updateUser({ password })`. Використати `I18nProvider` як у зразку (або замокати `useT` → identity). Run → FAIL.

- [X] **Step 4: Сторінка**

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

- [X] **Step 5: Тести зелені + гейти + коміт**

Run: `pnpm vitest run packages/simplycms/storefront-routes/src/__tests__/auth-set-password.test.tsx packages/simplycms/storefront-routes/src/__tests__/auth-confirm-route.test.ts` → PASS. Повні гейти (build згенерує обидва роути в `routeTree.gen.ts`; typecheck підтвердить типізацію `Link`/route id). Нові кириличні warning-и НЕ мають зʼявитись (сторінка повністю на `useT`) — перевірити: `pnpm lint 2>&1 | grep -c "no-restricted-syntax"` → ті самі ≈954.

```bash
git add packages/simplycms/storefront-routes packages/simplycms/i18n
git commit -m "feat(storefront): /auth/confirm (verifyOtp) + /auth/set-password для invite-флоу власника"
```

---

## Етап C — пілот і фініш

### Task 6: Пілот споживає шаблон пакета

**Files:**
- Modify: `scripts/pilot-pack/scaffold.mjs`; Delete: дубльовані файли з `tests/pilot/store-template/` (лишаються ЛИШЕ `package.json` і `vite.config.ts` — пілотний оверлей)
- Test: наявні `tests/create-store-template-parity.test.ts` (deps-парність уже стереже) + прогін `pnpm pilot:pack`

**Interfaces:**
- Consumes: `TEMPLATE_DIR` з `scripts/sync-create-store-template.mjs` (Task 2).

- [X] **Step 1: Перебудувати scaffold.mjs**

- ⚠️ Колізія імен: у `scripts/pilot-pack/scaffold.mjs:24` ВЖЕ є локальна
  `const TEMPLATE_DIR = join(REPO_ROOT, 'tests/pilot/store-template')` —
  перейменувати її на `PILOT_OVERLAY_DIR` (вона тепер вказує лише на оверлей),
  а `TEMPLATE_DIR` імпортувати з sync-скрипта.
- Імпортувати `TEMPLATE_DIR`, `SYNCED_FILES` з `scripts/sync-create-store-template.mjs`.
- `scaffoldStore()`: (1) скопіювати `TEMPLATE_DIR` → скретч (замість копіювання host-файлів з кореня і фікстури); (2) застосувати ті самі перейменування, що CLI (`package.json.tpl` видалити — пілот кладе власний manifest, `gitignore`/`env.example` можна ігнорувати або перейменувати — вибрати і задокументувати в коментарі); (3) поверх накласти пілотний оверлей: `tests/pilot/store-template/vite.config.ts` (з `emitBundleStats`) і `tests/pilot/store-template/package.json` (з overrides-плейсхолдером) — далі `writeManifest`/`writeEnv` працюють як зараз; (4) `themes/` і `plugins/hello-world` більше НЕ копіювати з кореня — вони вже в шаблоні.
- Видалити з `tests/pilot/store-template/` файли, що переїхали в шаблон: `routes.ts`, `src/engine.shared.ts`, `tailwind.config.ts`, `tsconfig.json`, `src/routes/my/.gitkeep`. Оновити шапковий коментар scaffold.mjs: джерело — шаблон create-simplycms-store, оверлей — пілот.
- **Теми:** шаблонний `simplycms.config.ts` реєструє лише `default` (Task 2), тож: `git grep -n solarstore scripts/pilot-pack tests/pilot` — якщо гейти/фікстури на solarstore не завʼязані (очікувано ні: маркери Gate D — з `@simplycms/ui`/`catalog-ui`, сід активує `default`), видалити `tests/pilot/store-template/simplycms.config.ts` з оверлею (шаблонний стає єдиним) і НЕ копіювати `themes/solarstore` у скретч. Якщо завʼязані — зафіксувати де саме і лишити пілотний конфіг в оверлеї з коментарем-причиною.

- [X] **Step 2: Смоук упакованого CLI (те, чого не бачить monorepo-scaffold)**

`scripts/pilot-pack/create-pkg-smoke.mjs` — пакує САМ create-пакет і запускає bin із tarball-а (ловить втрату `template/` у `files`, зламаний `bin`, зіпсуті перейменування):

```js
// Смоук опублікованого артефакту скаффолдера: pnpm pack → запуск bin
// із розпакованого tarball-а в tmp → структура магазину на місці.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export function createPkgSmoke() {
  const details = [];
  const work = mkdtempSync(join(tmpdir(), 'create-smoke-'));
  execFileSync('pnpm', ['--dir', 'packages/create-simplycms-store', 'pack', '--pack-destination', work], { stdio: 'pipe' });
  const tarball = readdirSync(work).find((f) => f.endsWith('.tgz'));
  if (!tarball) return { ok: false, details: ['tarball не створився'] };
  execFileSync('tar', ['-xzf', join(work, tarball), '-C', work], { stdio: 'pipe' });
  const target = join(work, 'smoke-shop');
  execFileSync('node', [join(work, 'package/src/index.mjs'), target, '--yes', '--no-install', '--no-git'], { stdio: 'pipe' });
  for (const file of ['package.json', '.gitignore', '.env.example', 'routes.ts', 'supabase/config.toml', 'supabase/templates/invite.html', 'scripts/owner-invite.mjs']) {
    if (!existsSync(join(target, file))) return { ok: false, details: [...details, `✗ відсутній ${file}`] };
    details.push(`✓ ${file}`);
  }
  return { ok: true, details };
}
```

Підключення: у `scripts/pilot-pack/run.mjs` усередині `runGates` (після Gate D, до Gate B) — `step('Gate CLI — tarball скаффолдера'); results.push(['CLI', createPkgSmoke()]);` — контракт `[name, { ok, details }]` той самий, `report.mjs` підхопить без змін.

- [X] **Step 3: Верифікація пілотом**

Run: `pnpm build:packages && pnpm pilot:pack`
Expected: Gates A, C, D, CLI — PASS (доказ, що шаблон пакета еквівалентний старому scaffold-у і що упакований CLI живий).

- [X] **Step 4: Повні гейти + коміт**

Повний блок гейтів + `pnpm test:packaging` → зелені.

```bash
git add scripts/pilot-pack tests/pilot/store-template
git commit -m "refactor(pilot): scaffold споживає шаблон create-simplycms-store + Gate CLI на tarball скаффолдера"
```

### Task 7: Gate E — owner-флоу в pilot:e2e

**Files:**
- Create: `scripts/pilot-pack/gate-e.mjs`
- Modify: `scripts/pilot-pack/e2e.mjs` (видобути service_role + anon key локального стеку), `scripts/pilot-pack/run.mjs` (виклик Gate E у e2e-режимі за контрактом `[name, { ok, details }]`), `scripts/pilot-pack/gate-b.mjs` (додати `/auth/set-password` до перевірених шляхів → очікування 200)

**Interfaces:**
- Consumes: `template/scripts/owner-invite.mjs` (Task 4), роути `/auth/confirm` і `/auth/set-password` (Task 5), міграція `first_user_no_auto_admin` (Task 4), локальний стек `supabase start` (`e2e.mjs` вже піднімає його і робить `db reset`).
- Produces: `gateOwner(ctx)` → `Promise<{ ok: boolean, details: string[] }>` — стандартний контракт гейтів (`run.mjs:runGates` / `report.mjs`).

- [ ] **Step 1: Видобути ключі стеку**

У `e2e.mjs` після старту стеку: `supabase status -o env` (або `--output json` — звірити з фактичним виводом встановленої CLI) → витягти `SERVICE_ROLE_KEY`, `ANON_KEY`, `API_URL` і передати далі в opts гейтів поряд з наявними ключами (подивись, як e2e.mjs вже дістає ключі для `writeEnv`, — розширити те саме місце).

- [ ] **Step 2: gate-e.mjs (контракт `{ ok, details }`, як gate-a…gate-d)**

```js
// scripts/pilot-pack/gate-e.mjs
// Gate E — owner-флоу проти ЛОКАЛЬНОГО стеку (ніколи проти живої БД):
// 1) перший звичайний signup НЕ отримує admin (міграція first_user_no_auto_admin);
// 2) owner-invite ідемпотентно призначає admin запрошеному;
// 3) /auth/confirm обмінює token_hash на сесію і редиректить на set-password.
import { execFileSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';

export async function gateOwner({ storeDir, storeUrl, supabaseUrl, anonKey, serviceRoleKey }) {
  const details = [];
  const fail = (message) => ({ ok: false, details: [...details, `✗ ${message}`] });
  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const anon = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });

  // 1. Перший signup — НЕ адмін (доводить дію міграції Task 4).
  const shopper = await anon.auth.signUp({ email: 'shopper-gate-e@pilot.local', password: 'shopper-password-1' });
  if (shopper.error) return fail(`signUp: ${shopper.error.message}`);
  const shopperRoles = await admin.from('user_roles').select('role').eq('user_id', shopper.data.user.id);
  if (shopperRoles.error) return fail(`user_roles read: ${shopperRoles.error.message}`);
  if (shopperRoles.data.some((r) => r.role === 'admin')) return fail('перший signup отримав admin — діра жива');
  details.push('✓ перший signup БЕЗ ролі admin');

  // 2. owner-invite двічі — ідемпотентність + роль.
  const ownerEmail = 'owner-gate-e@pilot.local';
  const env = {
    ...process.env,
    VITE_SUPABASE_URL: supabaseUrl,
    VITE_SITE_URL: storeUrl,
    SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey,
    OWNER_EMAIL: ownerEmail,
  };
  execFileSync('node', ['scripts/owner-invite.mjs'], { cwd: storeDir, env, stdio: 'pipe' });
  execFileSync('node', ['scripts/owner-invite.mjs'], { cwd: storeDir, env, stdio: 'pipe' });
  const list = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (list.error) return fail(`listUsers: ${list.error.message}`);
  const owner = list.data.users.find((u) => u.email === ownerEmail);
  if (!owner) return fail('запрошеного немає в auth.users');
  const ownerRoles = await admin.from('user_roles').select('role').eq('user_id', owner.id);
  if (!ownerRoles.data?.some((r) => r.role === 'admin')) return fail('у власника немає ролі admin');
  details.push('✓ owner-invite ідемпотентний, роль admin на місці');

  // 3. /auth/confirm: token_hash → auth-cookies → redirect на set-password.
  const link = await admin.auth.admin.generateLink({ type: 'magiclink', email: ownerEmail });
  if (link.error) return fail(`generateLink: ${link.error.message}`);
  const confirmUrl = `${storeUrl}/auth/confirm?token_hash=${link.data.properties.hashed_token}&type=magiclink&next=/auth/set-password`;
  const response = await fetch(confirmUrl, { redirect: 'manual' });
  const location = response.headers.get('location') ?? '';
  const cookies = (response.headers.getSetCookie?.() ?? []).join(';');
  if (response.status !== 302 || !location.endsWith('/auth/set-password')) {
    return fail(`/auth/confirm: ${response.status} → ${location || '(без Location)'}`);
  }
  if (!cookies.includes('sb-')) return fail('/auth/confirm не поставив auth-cookies');
  details.push('✓ /auth/confirm: 302 → /auth/set-password + auth-cookies');

  return { ok: true, details };
}
```

- [ ] **Step 3: Підключити в run.mjs + gate-b доповнення**

У `run.mjs` (там, де вже є `results.push(['B', await runGateB(opts)])` у не-packOnly гілці) — після Gate B: `step('Gate E — owner-флоу'); results.push(['E', await gateOwner({ storeDir: opts.storeDir, storeUrl, supabaseUrl, anonKey, serviceRoleKey })]);` — точні імена полів opts звірити з тим, як `runGateB` бере адресу магазину і env; Gate E ганяти ЛИШЕ в e2e-режимі (коли serviceRoleKey присутній — інакше пропустити з явним рядком у details звіту, не мовчки). У `gate-b.mjs` до списку шляхів додати `GET /auth/set-password` → очікуваний статус 200.

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

- `release-process.md`: додати абзац про 22-й пакет (unscoped, без `build`-кроку, публікується тим самим `pnpm publish -r`) і 🔴 **дію власника до першого релізу з новим пакетом**: чинний `NPM_TOKEN` — Granular Access Token, обмежений scope `@simplycms` (`publish-packages.yml:15`), — unscoped `create-simplycms-store` він НЕ покриє, і granular-токен не може заздалегідь включити пакет, якого ще немає в реєстрі. Власник має або видати токен з доступом «Read and write» до **всіх** пакетів акаунта (з Bypass 2FA), або опублікувати першу версію пакета вручну зі своєї машини й потім звузити токен назад.
- Роадмап, Фаза 2: пункт `create-simplycms-store` відмітити `[x]` з датою і посиланням на план. Пункт «Bootstrap власника» відмічати `[x]` **ЛИШЕ якщо зафіксовано успішний повний `pnpm pilot:e2e` (Gates A–E зелені)**; якщо Docker недоступний — лишити `[ ]` з приміткою «код готовий, Gate E не проганявся: немає Docker, дата» (та сама політика чесності, що для наявної позначки «pilot:e2e ще не запускався»). Додати дію власника про NPM_TOKEN (див. вище).
- Спека: (а) §2.3 — виправлення факту вже внесене окремим комітом (тригер РОБИВ першого адміном); (б) §9: під кожним відкритим питанням дописати «**Розвʼязано (2026-08-XX):** …» — (1) callback обмінює лише `?code=`, для invite додано `/auth/confirm` з `verifyOtp` + сторінка set-password; (2) перелік фактично оновленого тулінгу (workspace, bump, eslint/tsconfig); (3) обрано закомічені копії + `template:sync` + парність-тест.

- [ ] **Step 3: Фінальний повний прогін**

```bash
pnpm install --frozen-lockfile && pnpm format:check && pnpm lint && pnpm build && pnpm typecheck && pnpm test \
  && pnpm build:packages && pnpm test:packaging && pnpm pilot:pack
```

Плюс, якщо Docker доступний — обовʼязково:

```bash
pnpm pilot:e2e   # Gates A–E зелені; без цього пункт «Bootstrap власника» в роадмапі НЕ закривається
```

Expected: усе зелене. Будь-який червоний гейт — виправити ДО коміту, не рапортувати «переважно зелено».

- [ ] **Step 4: Коміт**

```bash
git add CLAUDE.md docs
git commit -m "docs: create-simplycms-store і owner:invite — синхронізація CLAUDE.md, release-process, роадмапу і спеки"
```

---

## Верифікація плану

- Покриття спеки: §3.1→Task 1, §3.2→Task 2 (+6), §3.3→Task 3, §4→Task 4-5, §6→Task 2/4/7, §7 DoD→Task 3 (smoke), 6 (pilot:pack + Gate CLI), 7 (e2e), 8 (фінальний прогін + доки). §5 (pull-модель) — свідомо не в плані (спека: не v1).
- Узгодженість імен між тасками: `TEMPLATE_DIR`/`SYNCED_FILES`/`SYNCED_DIRS` (Task 2 → 6), `renderManifest`/`scaffold`/`resolveOptions` (Task 3), `runOwnerInvite` (Task 4 → 7), `gateOwner`/`createPkgSmoke` (Task 6-7 → run.mjs), ланцюг invite: `invite.html` (Task 2) → `/auth/confirm?token_hash&type&next=/auth/set-password` (Task 5) → Gate E (Task 7).
- Відомі точки, де виконавець МУСИТЬ звіритись із живим кодом (навмисно, бо точні рядки дрейфують): спосіб отримання supabase-клієнта сторінками (Task 5 Step 1), точні імена полів opts у `run.mjs` (Task 7 Step 3), формат `supabase status` встановленої версії CLI (Task 7 Step 1).
- **Codex-аудит 2026-08-04 (adversarial, read-only):** 14 знахідок (5 blocker / 7 major / 2 minor), усі верифіковані проти коду і внесені в цю версію плану. Ключове: чинний тригер robив першого зареєстрованого адміном (→ Task 4 Step 0); invite-лінк несумісний із `?code=`-callback (→ `/auth/confirm` + email-шаблон); шаблон не збирався без `supabase/config.toml` і з `solarstore` у конфігу; Gate E приведений до контракту `run.mjs`; NPM_TOKEN не покриє unscoped пакет (→ дія власника в Task 8).
