# Фаза 0 «Фундамент у монорепо» — імплементаційний план

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Перебудувати монорепо на цільову топологію платформи (spec §16 Фаза 0): роути ядра в пакетах через `physical()`, канонічні сторінки в ядрі, теми = tokens+components, плагін-контур підключено, supabase консолідовано, Drizzle-конвеєр міграцій, scope `@simplycms` — все на workspace-теках, без публікації.

**Architecture:** Кожен етап лишає репозиторій зеленим (`typecheck`/`lint`/`test`/`build`) і закінчується комітом. Порядок: механічний фундамент (rename/LICENSE/subtree) → supabase → каркас роутів → тема v2 → плагіни → Drizzle → i18n → гігієна → фініш. Джерело правди: [`docs/superpowers/specs/2026-07-30-platform-architecture-design.md`](../specs/2026-07-30-platform-architecture-design.md).

**Tech Stack:** TanStack Start 1.167 / Router 1.168 (`@tanstack/virtual-file-routes`), Vite 8, React 19, TS 5.9 strict, Supabase (`@supabase/ssr`), Drizzle ORM/Kit, Vitest 4, Zod 4.

## Global Constraints

- Strict TypeScript; без `any`; коментарі українською; файли ≤150 рядків (розбивати).
- Жодного глобального supabase-singleton — тільки DI/порти (`useSupabaseClient()` / інжектований client).
- `ssr: false`-роути завжди мають `pendingComponent`.
- `src/routeTree.gen.ts` не редагується руками; порядок CI: `install → build (генерація) → typecheck → test`.
- Рішення D5 (spec §2): breaking-реструктуризація **без перехідних шимів** — старі шляхи видаляються, не re-export'яться.
- Після КОЖНОГО завдання: `pnpm typecheck && pnpm lint && pnpm test && pnpm build` — зелені; потім коміт.
- Комміт-меседжі: `тип(scope): опис українською` (як у git log).

---

## Етап A — механічний фундамент

### Task 1: LICENSE

**Files:**
- Create: `LICENSE`
- Modify: `package.json` (додати `"license": "MIT"`)

- [ ] **Step 1:** Створити `LICENSE` з текстом MIT:

```
MIT License

Copyright (c) 2026 simplyCMS

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

- [ ] **Step 2:** У кореневий `package.json` після `"private": true` додати `"license": "MIT",`. Перевірити, що всі `packages/simplycms/*/package.json` мають `"license": "MIT"`; де немає (10 private-пакетів) — додати:

```bash
node -e "const fs=require('fs');const g=require('path');for(const d of fs.readdirSync('packages/simplycms',{withFileTypes:true})){if(!d.isDirectory())continue;const p='packages/simplycms/'+d.name+'/package.json';if(!fs.existsSync(p))continue;const j=JSON.parse(fs.readFileSync(p,'utf8'));if(!j.license){j.license='MIT';fs.writeFileSync(p,JSON.stringify(j,null,2)+'\n');console.log('added',p)}}"
```

- [ ] **Step 3:** Верифікація + коміт:

```bash
pnpm typecheck && pnpm lint && pnpm test
git add -A && git commit -m "chore(license): LICENSE MIT у корінь + license-поле в усі пакети"
```

### Task 2: Rename scope `@simplysoftua` → `@simplycms`

**Files:** Modify: усі файли зі згадкою `@simplysoftua` (≈390+, за прецедентом червня): `packages/**`, `src/**`, `themes/**`, `plugins/**`, `docs/**`, `.github/**`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, `package.json`, `simplycms.config.ts`, `tests/published-exports-parity.test.ts`, `CLAUDE.md`, `AGENTS.md`.

**Прим.:** npm org `simplycms` уже створена власником; публікації в цій фазі немає, тож реєстр не задіюється.

- [ ] **Step 1:** Механічна заміна (без `node_modules`/`.git`; префіксна заміна покриває і `@simplysoftua/db-types`):

```bash
grep -rl '@simplysoftua' --exclude-dir=node_modules --exclude-dir=.git . \
  | xargs sed -i 's|@simplysoftua|@simplycms|g'
```

- [ ] **Step 2:** Точкові перевірки після sed: (а) `package.json` → `build:packages` filter = `"@simplycms/*"`; (б) `.github/workflows/publish-packages.yml` → scope `@simplycms` (джоба призупинена — ок); (в) `tsconfig.json` paths і `vite.config.ts`/`vitest.config.ts` alias-ключі починаються з `@simplycms/`.

- [ ] **Step 3:** Контроль нуля залишків і повна верифікація:

```bash
grep -rn '@simplysoftua' --exclude-dir=node_modules --exclude-dir=.git . | wc -l   # має бути 0
pnpm install && pnpm build && pnpm typecheck && pnpm lint && pnpm test
```

- [ ] **Step 4:** Коміт: `git add -A && git commit -m "refactor(scope): rename @simplysoftua → @simplycms по всьому репо (npm org simplycms)"`

### Task 3: Вивід git-subtree `simplyCMS-core`

**Files:**
- Modify: `package.json` (видалити скрипти `cms:remote`, `cms:pull`, `cms:push`, `cms:push:branch`, `cms:diff`)
- Modify: `CLAUDE.md` (видалити розділ «Git Subtree Workflow» цілком; з Quick Reference прибрати cms-рядки)
- Modify: `AGENTS.md` (прибрати `cms:pull`/`cms:push` з Quick Reference; згадку subtree в описі структури → «monorepo packages»)
- Modify: `.github/instructions/tooling.instructions.md` (видалити розділ «Git Subtree (ядро CMS)» і «Git Subtree Workflow»)
- Modify: `.github/instructions/architecture-core.instructions.md` (рядок «Git Subtree для синхронізації ядра…» видалити)
- Modify: `packages/simplycms/README.md` (переписати: пакети живуть у монорепо `simplyCMS/simplyCMS`, публікуються на npmjs; блок про subtree/remote видалити)

- [ ] **Step 1:** Внести всі правки вище; локальний remote: `git remote remove simplycms-core`.
- [ ] **Step 2:** `grep -rn "subtree\|cms:pull\|cms:push\|simplycms-core" --include='*.md' --include='*.json' . | grep -v node_modules | grep -v docs/architecture` → залишки лише в історичних описах `docs/architecture/platform-delivery-options.md` (допустимо) і spec §4.1 (описує сам вивід — допустимо).
- [ ] **Step 3:** Верифікація + коміт: `chore(repo): вивести git-subtree simplyCMS-core з експлуатації (spec §4.1)`.
- [ ] **Step 4 (дія власника, поза репо):** архівувати `simplyCMS/simplyCMS-core` на GitHub (Settings → Archive). Зазначити в PR-описі.

---

## Етап B — консолідація Supabase

### Task 4: Пакет `@simplycms/supabase`

**Files:**
- Create: `packages/simplycms/supabase/package.json`, `packages/simplycms/supabase/src/{browser-client.ts,server-client.ts,anon-client.ts,keys.ts,SupabaseProvider.tsx,index.ts}`
- Move (git mv, потім правки): вміст `packages/simplycms/core/src/supabase/{client.ts,server.ts → server-client.ts,anon.ts → anon-client.ts,SupabaseProvider.tsx,types.ts}` → `packages/simplycms/supabase/src/`
- Modify: `tsconfig.json`, `vite.config.ts`, `vitest.config.ts` (alias `@simplycms/supabase` → `packages/simplycms/supabase/src`), усі імпорти `@simplycms/core/supabase/*` по репо
- Modify: `.env.example`
- Test: `packages/simplycms/supabase/src/__tests__/keys.test.ts`

**Interfaces (Produces):**
- `createBrowserSupabase(): SupabaseClient<Database>` (browser, `createBrowserClient` з `@supabase/ssr`)
- `createServerSupabase(): SupabaseClient<Database>` (cookie-based, `getCookies`/`setCookie` з `@tanstack/react-start/server`)
- `createAnonSupabaseClient(): SupabaseClient<Database>` (без cookies, для cross-request кешів)
- `SupabaseProvider`, `useSupabaseClient()` (DI-контекст, як зараз)
- `getSupabaseKeys(): { url: string; key: string }` — env-резолв

- [ ] **Step 1: Тест на env-резолв ключів (новий контракт нейминга):**

```ts
// packages/simplycms/supabase/src/__tests__/keys.test.ts
import { describe, expect, it, vi } from 'vitest';
import { resolveSupabaseKeys } from '../keys';

describe('resolveSupabaseKeys', () => {
  it('віддає publishable key, коли задано', () => {
    expect(
      resolveSupabaseKeys({ VITE_SUPABASE_URL: 'https://x.supabase.co', VITE_SUPABASE_PUBLISHABLE_KEY: 'pk' }),
    ).toEqual({ url: 'https://x.supabase.co', key: 'pk' });
  });
  it('fallback на legacy anon key', () => {
    expect(
      resolveSupabaseKeys({ VITE_SUPABASE_URL: 'https://x.supabase.co', VITE_SUPABASE_ANON_KEY: 'anon' }),
    ).toEqual({ url: 'https://x.supabase.co', key: 'anon' });
  });
  it('кидає зрозумілу помилку без ключів', () => {
    expect(() => resolveSupabaseKeys({ VITE_SUPABASE_URL: 'https://x.supabase.co' })).toThrow(/SUPABASE.*KEY/);
  });
});
```

- [ ] **Step 2:** Прогнати — FAIL (модуля немає).
- [ ] **Step 3:** Реалізувати `keys.ts` (pure-функція `resolveSupabaseKeys(env: Record<string,string|undefined>)` + обгортка `getSupabaseKeys()` на `import.meta.env`); `package.json` пакета:

```json
{
  "name": "@simplycms/supabase",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "license": "MIT",
  "exports": {
    ".": "./src/index.ts",
    "./browser-client": "./src/browser-client.ts",
    "./server-client": "./src/server-client.ts",
    "./anon-client": "./src/anon-client.ts",
    "./SupabaseProvider": "./src/SupabaseProvider.tsx"
  },
  "peerDependencies": { "@supabase/ssr": "*", "@supabase/supabase-js": "*", "react": "*" }
}
```

- [ ] **Step 4:** `git mv` файлів з `core/src/supabase/`, оновити їх внутрішні імпорти на `./keys`; `server-client.ts` звірити з офіційним quickstart Supabase для TanStack Start (`getCookies`/`setCookie`/`setResponseHeader`); алаіси в tsconfig/vite/vitest.
- [ ] **Step 5:** Замінити імпорти по репо (без шимів, D5):

```bash
grep -rl "@simplycms/core/supabase" --exclude-dir=node_modules . \
  | xargs sed -i "s|@simplycms/core/supabase/SupabaseProvider|@simplycms/supabase/SupabaseProvider|g; s|@simplycms/core/supabase/server|@simplycms/supabase/server-client|g; s|@simplycms/core/supabase/anon|@simplycms/supabase/anon-client|g; s|@simplycms/core/supabase/client|@simplycms/supabase/browser-client|g; s|@simplycms/core/supabase/types|@simplycms/supabase|g"
```

Пройти `grep -rn "core/supabase"` → 0; видалити порожню теку `core/src/supabase/`.
- [ ] **Step 6:** `.env.example`: додати `VITE_SUPABASE_PUBLISHABLE_KEY=` з коментарем «новий нейминг; VITE_SUPABASE_ANON_KEY підтримується як legacy-fallback».
- [ ] **Step 7:** Повна верифікація + коміт: `refactor(supabase): консолідація в @simplycms/supabase (spec §10)`.

---

## Етап C — каркас роутів на `physical()`

### Task 5: Скелет пакетів `storefront-routes` і `admin-routes`

**Files:**
- Create: `packages/simplycms/storefront-routes/{package.json,routes/.gitkeep,src/.gitkeep}`
- Create: `packages/simplycms/admin-routes/{package.json,routes/.gitkeep}`
- Modify: `tsconfig.json`, `vite.config.ts`, `vitest.config.ts` (аліаси `@simplycms/storefront-routes`, `@simplycms/admin-routes` → відповідні `src`), `tailwind.config.ts`

**Interfaces (Produces):** теки `routes/` обох пакетів — цілі для `physical()` (Task 6+); `storefront-routes/src/` — server-функції та сторінки (Task 8, 13).

- [ ] **Step 1:** `package.json` (обидва однакові за формою):

```json
{
  "name": "@simplycms/storefront-routes",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "license": "MIT",
  "exports": { ".": "./src/index.ts", "./routes/*": "./routes/*" },
  "peerDependencies": { "@tanstack/react-router": "*", "@tanstack/react-start": "*", "react": "*" }
}
```

(`peerDependencies` на `@tanstack/react-start` — контракт пакета зі spec §5: у майбутньому вмикає авто-noExternal.)

- [ ] **Step 2:** `tailwind.config.ts` → у `content` додати `"./packages/simplycms/**/routes/**/*.{ts,tsx}"`.
- [ ] **Step 3:** Верифікація + коміт: `feat(routes-pkg): скелети @simplycms/storefront-routes і @simplycms/admin-routes`.

### Task 6: `routes.ts` + virtualRouteConfig + пілотний роут

**Files:**
- Create: `routes.ts` (корінь)
- Modify: `vite.config.ts`
- Move: `src/routes/admin/index.tsx` → `packages/simplycms/admin-routes/routes/admin/index.tsx`

- [ ] **Step 1: Зʼясувати точну назву опції плагіна** (задокументована поведінка різниться між версіями):

```bash
grep -rn "virtualRouteConfig" node_modules/@tanstack/router-plugin/dist/esm/*.d.ts node_modules/@tanstack/start-plugin-core/dist/esm/*.d.ts | head
grep -rn "virtualRouteConfig\|routesDirectory" node_modules/@tanstack/react-start/dist -l | head -3
```

Очікування: опція `virtualRouteConfig` в конфігу router-generator; у `tanstackStart()` передається через блок роутер-опцій (`tsr` або `router` — взяти те, що показує `.d.ts` типу `TanStackStartInputConfig`). Якщо опція приймає **шлях до файлу** — використати `'./routes.ts'`; якщо лише обʼєкт — імпортувати `routes` у `vite.config.ts` і передати обʼєктом.

- [ ] **Step 2:** Створити `routes.ts`:

```ts
// Монтаж каркаса платформи: віртуальне дерево роутів (spec §5).
// Виконується генератором на етапі збірки як звичайний TS-модуль.
import { physical, rootRoute } from '@tanstack/virtual-file-routes';

// Шляхи ВІДНОСНІ до routesDirectory (src/routes).
const STOREFRONT = '../../packages/simplycms/storefront-routes/routes';
const ADMIN = '../../packages/simplycms/admin-routes/routes';

export const routes = rootRoute('__root.tsx', [
  physical('/', STOREFRONT),
  physical('/', ADMIN),
  physical('/', 'my'), // власні сторінки магазину (референс-стенд)
]);
```

Створити `src/routes/my/.gitkeep`.
- [ ] **Step 3:** Підключити опцію у `vite.config.ts` (за результатом Step 1) і перенести пілот: `git mv src/routes/admin/index.tsx packages/simplycms/admin-routes/routes/admin/index.tsx`.
- [ ] **Step 4:** `pnpm build` → відкрити `src/routeTree.gen.ts`: (а) імпорт пілотного роуту йде відносним шляхом у пакет; (б) route id лишився `/admin/`; (в) решта дерева без змін. `pnpm typecheck && pnpm test` зелені.
- [ ] **Step 5:** Коміт: `feat(routes): virtualRouteConfig + physical() — пілотний admin/index у пакеті`.

### Task 7: Переїзд усіх admin-роутів

**Files:**
- Move: `src/routes/admin.tsx` → `packages/simplycms/admin-routes/routes/admin.tsx`; `src/routes/admin/**` (41 файл, що лишилися) → `packages/simplycms/admin-routes/routes/admin/**`

- [ ] **Step 1:** Зафіксувати еталон: `grep -oE "'/[^']*'" src/routeTree.gen.ts | sort -u > /tmp/route-ids-before.txt`
- [ ] **Step 2:** `git mv src/routes/admin.tsx packages/simplycms/admin-routes/routes/ && git mv src/routes/admin packages/simplycms/admin-routes/routes/admin` (пілотна тека вже там — mv доповнить). Імпорти в цих файлах — тільки алаісні (`@simplycms/admin/...`) — правок не потребують; перевірити: `grep -rn "from '\.\." packages/simplycms/admin-routes/routes | grep -v routeTree` → 0.
- [ ] **Step 3:** `pnpm build` → `grep -oE "'/[^']*'" src/routeTree.gen.ts | sort -u | diff /tmp/route-ids-before.txt -` → порожньо (URL-простір не змінився). `typecheck`/`lint`/`test` зелені.
- [ ] **Step 4:** Коміт: `feat(routes): адмін-роути переїхали в @simplycms/admin-routes`.

### Task 8: Переїзд storefront/protected/auth/api + server-шару

**Files:**
- Move: `src/routes/{_storefront.tsx,_storefront,_protected.tsx,_protected,auth,api}` → `packages/simplycms/storefront-routes/routes/…`
- Move: `src/server/*` → `packages/simplycms/storefront-routes/src/server/*`; `src/seo/*` → `.../src/seo/*`; `src/active-theme.ts` → `.../src/active-theme.ts`
- Modify: відносні імпорти в перенесених route-файлах; `src/routes/__root.tsx`; `vite.config.ts` (`seoRoutesPlugin` імпорт-шлях); `src/client.tsx` (якщо імпортує active-theme)

- [ ] **Step 1:** Еталон route id → `/tmp/route-ids-before.txt` (як у Task 7).
- [ ] **Step 2:** `git mv` за списком Files. Виправити відносні імпорти в route-файлах: `../../server/home` → `../../src/server/home` **не** підійде (routes/ і src/ — сусіди в пакеті): з `routes/_storefront/index.tsx` шлях = `../../src/server/home`; з `routes/_storefront/catalog/$sectionSlug/$productSlug.tsx` = `../../../../src/server/products`; перевірити всі: `grep -rn "\.\./server\|\.\./seo\|\.\./active-theme" packages/simplycms/storefront-routes/routes` і перерахувати глибину для кожного.
- [ ] **Step 3:** `src/routes/__root.tsx`: `'../server/themes'` → `'@simplycms/storefront-routes/src/server/themes'`? — ні: __root має бути тонким. Додати в `storefront-routes/src/index.ts` експорти `getActiveTheme`, `serializeActiveThemeScript` і імпортувати з `@simplycms/storefront-routes`. `vite.config.ts`: `import { seoRoutesPlugin } from './packages/simplycms/storefront-routes/src/seo/plugin'`.
- [ ] **Step 4:** `pnpm build` → diff route id = порожньо; `typecheck`/`lint`/`test` зелені; `pnpm dev` вручну: `/`, `/catalog`, `/admin`, `/auth` відкриваються (smoke).
- [ ] **Step 5:** Підсумковий стан `src/routes/` = `__root.tsx` + `my/` — перевірити `ls`. Коміт: `feat(routes): storefront/auth/api-роути й server-шар у @simplycms/storefront-routes — host стиснуто до __root + my/`.

### Task 9: Регрес-тест `physical()`-механізму

**Files:**
- Create: `tests/virtual-routes-escape.test.ts`, `tests/fixtures/vfr/{routes.ts, pkg/routes/products.tssx→products.tsx, host/__root.tsx}`

- [ ] **Step 1:** Тест (Generator API напряму, за зразком експерименту з дослідження):

```ts
// tests/virtual-routes-escape.test.ts
// Регрес-гард spec §5: physical() МУСИТЬ монтувати теку поза routesDirectory.
// Якщо апстрім зламає цю поведінку — тест упаде ДО того, як зламається платформа.
import { describe, expect, it } from 'vitest';
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

it('physical() монтує теку поза routesDirectory і підхоплює нові файли', async () => {
  const { Generator, getConfig } = await import('@tanstack/router-generator');
  const dir = mkdtempSync(join(tmpdir(), 'vfr-'));
  const routesDir = join(dir, 'app', 'routes');
  const pkgRoutes = join(dir, 'pkg', 'routes');
  mkdirSync(routesDir, { recursive: true });
  mkdirSync(pkgRoutes, { recursive: true });
  writeFileSync(join(routesDir, '__root.tsx'), `import { createRootRoute } from '@tanstack/react-router'\nexport const Route = createRootRoute()\n`);
  writeFileSync(join(pkgRoutes, 'products.tsx'), `import { createFileRoute } from '@tanstack/react-router'\nexport const Route = createFileRoute('/shop/products')({})\n`);
  writeFileSync(join(dir, 'routes.ts'), `import { rootRoute, physical } from '@tanstack/virtual-file-routes'\nexport const routes = rootRoute('__root.tsx', [physical('/shop', '../../pkg/routes')])\n`);
  const generated = join(dir, 'app', 'routeTree.gen.ts');
  const config = getConfig({ routesDirectory: routesDir, generatedRouteTree: generated, virtualRouteConfig: join(dir, 'routes.ts') }, dir);
  await new Generator({ config, root: dir }).run();
  const tree = readFileSync(generated, 'utf8');
  expect(tree).toContain('/shop/products');
  expect(tree).toMatch(/pkg\/routes\/products/);
});
```

- [ ] **Step 2:** Прогнати; якщо сигнатури `Generator`/`getConfig` відрізняються у встановленій версії — звірити з `node_modules/@tanstack/router-generator/dist/esm/index.d.ts` і поправити виклик (поведінка, що перевіряється, незмінна).
- [ ] **Step 3:** Верифікація + коміт: `test(routes): регрес-гард physical() поза routesDirectory`.

---

## Етап D — контракт теми v2 + канонікалізація сторінок

### Task 10: Типи ThemeModule v2 + аплаєр токенів

**Files:**
- Modify: `packages/simplycms/theme-system/src/types.ts` (повна заміна контракту)
- Create: `packages/simplycms/theme-system/src/applyTokens.ts`
- Modify: `packages/simplycms/theme-system/src/ThemeRegistry.ts` (`validateTheme` під новий контракт)
- Test: `packages/simplycms/theme-system/src/__tests__/registry-v2.test.ts`

**Interfaces (Produces):**

```ts
export interface ThemeManifest { name: string; displayName: string; version: string; engines: { simplycms: string } }
export interface DesignTokens { colors?: Record<string, string>; radius?: string; fonts?: Record<string, string> } // CSS custom properties
export interface ThemeComponents {
  Header: React.ComponentType; Footer: React.ComponentType;
  HeroBanner?: React.ComponentType<{ banners: Banner[] }>;
}
export interface ThemeModule {
  manifest: ThemeManifest; tokens: DesignTokens; components: ThemeComponents;
  settings?: z.ZodTypeAny;
}
export function applyTokens(tokens: DesignTokens): string // → рядок CSS ':root{--color-…}' для <style>
```

- [ ] **Step 1:** Тест: `validateTheme` приймає модуль `{manifest, tokens, components:{Header,Footer}}` і відхиляє модуль без `Header` / без `engines.simplycms`; `applyTokens({colors:{primary:'#07f'}})` містить `--color-primary: #07f`.
- [ ] **Step 2:** FAIL → реалізація: нові типи (старі `ThemePages`/`MainLayout`-вимоги видалити повністю, D5), `validateTheme` перевіряє manifest+engines+Header+Footer, `applyTokens` — pure. `ThemeRegistry.load()` при невдачі активної теми (немає в реєстрі) → fallback `'default'` + `console.error` (деградація зі spec §8) — окремий тест.
- [ ] **Step 3:** Тести пакета зелені (решта репо ще червона — themes/сторінки не переведені; **не комітити**, Task 10-13 — один атомарний ланцюг, коміт у Task 13).

### Task 11: Канонічні сторінки в `storefront-routes`

**Files:**
- Move: `packages/simplycms/core/src/pages/*` (16 сторінок) → `packages/simplycms/storefront-routes/src/pages/*`
- Create: `packages/simplycms/storefront-routes/src/layout/StorefrontShell.tsx`
- Modify: route-файли `storefront-routes/routes/**` — рендерять канонічні сторінки напряму (замість `theme.pages.X`)

- [ ] **Step 1:** `git mv packages/simplycms/core/src/pages packages/simplycms/storefront-routes/src/pages`; внутрішні імпорти сторінок — алаісні, виправити лише відносні (`grep -rn "from '\.\." …/src/pages`).
- [ ] **Step 2:** `StorefrontShell.tsx` — канонічний каркас, який бере компоненти активної теми:

```tsx
// Канонічний shell вітрини: Header/Footer з активної теми, токени — інлайн-стилем.
import { use } from 'react';
import { ThemeRegistry, applyTokens } from '@simplycms/themes';
import { useTheme } from '@simplycms/themes/ThemeContext';

export function StorefrontShell({ children }: { children: React.ReactNode }) {
  const { themeName } = useTheme();
  const theme = use(ThemeRegistry.load(themeName));
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: applyTokens(theme.tokens) }} />
      <theme.components.Header />
      <main>{children}</main>
      <theme.components.Footer />
    </>
  );
}
```

- [ ] **Step 3:** `routes/_storefront.tsx` рендерить `StorefrontShell` з `<Outlet/>`; кожен route-файл `_storefront/**`: замість `theme.pages.XxxPage` імпортує сторінку `../../src/pages/Xxx` і рендерить її (loader-и без змін). Те саме для `_protected`/auth-роутів (Profile*/Auth сторінки).
- [ ] **Step 4:** Прибрати з route-файлів мертві імпорти `ThemeRegistry`/`use` де більше не потрібні. Не комітити (ланцюг).

### Task 12: Перебудова тем `default` і `solarstore`

**Files:**
- Modify: `themes/default/index.ts`, `themes/default/manifest.ts`; Create: `themes/default/tokens.ts`; Delete: `themes/default/{pages,layouts}` (компоненти Header/Footer лишаються в `themes/default/components/`)
- Те саме дзеркально для `themes/solarstore` (токени — синя палітра з поточних styles)

- [ ] **Step 1:** `themes/default/index.ts` → експорт нового `ThemeModule`: `{ manifest: {...engines:{simplycms:'^0.1'}}, tokens (з поточних styles/CSS-variables), components: { Header, Footer, HeroBanner } }`. Вилучити `pages/`+`layouts/` (`git rm -r`): усе, що там було унікального (не re-export core) — перенести в `components/` теми або в канонічні сторінки, звіривши diff перед видаленням (`git diff --stat`).
- [ ] **Step 2:** Те саме для solarstore.
- [ ] **Step 3:** `src/theme-registry.ts` без змін (лоадери ті самі). Не комітити (ланцюг).

### Task 13: Зелений стан ланцюга тем + видалення legacy

**Files:**
- Modify: `packages/simplycms/core/src/providers/CMSProvider.tsx` (прибрати згадки ThemePages, якщо є), `packages/simplycms/theme-system/src/{ThemeContext.tsx,getActiveThemeSSR.ts,ThemeResolver.ts}` — під новий тип
- Delete: невикористані re-export шими core, що торкались pages (`grep`-контроль перед видаленням)

- [ ] **Step 1:** `pnpm typecheck` → виправити всі місця, що ще очікують старий контракт (компілятор — чекліст).
- [ ] **Step 2:** `pnpm build && pnpm test && pnpm lint` зелені; `pnpm dev` smoke: `/` рендерить Header/Footer теми + канонічну головну; перемикання теми в адмінці міняє шапку/токени.
- [ ] **Step 3:** Коміт усього ланцюга D: `feat(themes)!: контракт v2 (tokens+components) + канонічні сторінки в ядрі (spec §6, D3/D4)`.

---

## Етап E — плагін-контур від конфігу

### Task 14: `simplycms.config.ts` як джерело істини + bootstrap плагінів

**Files:**
- Modify: `packages/simplycms/runtime/src/index.ts` (тип конфіга: + `plugins`, + `themes`)
- Modify: `simplycms.config.ts`
- Create: `packages/simplycms/plugin-system/src/bootstrap.ts`
- Modify: `src/routes/__root.tsx` (виклик bootstrap на клієнті)
- Create: `plugins/hello-world/{index.ts,package.json}` (référens-плагін)
- Test: `packages/simplycms/plugin-system/src/__tests__/bootstrap.test.ts`

**Interfaces (Produces):**

```ts
// runtime
export interface PluginRegistration { name: string; module: () => Promise<{ default: PluginModule }> }
export interface SimplyCMSConfig { supabase: {...як є}; seo: {...}; locale: string; currency: string;
  plugins?: PluginRegistration[]; themes?: Record<string, () => Promise<{ default: ThemeModule }>> }
// plugin-system
export async function bootstrapPlugins(regs: PluginRegistration[], supabase: SupabaseClient): Promise<void>
// реєструє модулі (registerPluginModule) і вмикає активні за таблицею plugins (loadPlugins);
// невідомий у білді активний плагін → console.error + пропуск (деградація spec §8)
```

- [ ] **Step 1:** Тест `bootstrap.test.ts` з mock-supabase (см. патерн `engine-provider.test.tsx`): (а) активний у БД і зареєстрований → його hook зареєстровано в `hookRegistry`; (б) активний у БД, але НЕ зареєстрований → не кидає, пише `console.error`; (в) зареєстрований, але неактивний → hooks не зареєстровані.
- [ ] **Step 2:** FAIL → реалізація `bootstrapPlugins`; `console.log` у `PluginLoader.ts` (3 шт.) замінити на `console.error`-only при помилках (беклог-пункт гігієни).
- [ ] **Step 3:** `simplycms.config.ts`: `plugins: [{ name: 'hello-world', module: () => import('@plugins/hello-world') }]`; `themes:` — перенести реєстрацію з `src/theme-registry.ts` сюди, а `theme-registry.ts` зробити генерованим споживачем конфіга (читає `config.themes`, викликає `ThemeRegistry.register`).
- [ ] **Step 4:** `plugins/hello-world/index.ts` — мінімальний `PluginModule` з одним hook на слот `dashboard.widgets` (слот уже існує в `Dashboard.tsx`). `__root.tsx`: після монтування клієнта — `bootstrapPlugins(config.plugins ?? [], supabase)` (client-only effect; для SSR-безпеки хуки сторфронту в цій фазі не вмикаємо — задокументувати коментарем).
- [ ] **Step 5:** Верифікація повна + ручний smoke: увімкнути плагін в `/admin/plugins` → віджет зʼявився на дашборді. Коміт: `feat(plugins): контур підключено — config як джерело істини, bootstrap, референс-плагін`.

---

## Етап F — Drizzle-конвеєр міграцій

### Task 15 (spike + baseline): `@simplycms/schema` з інтроспекції

**Files:**
- Create: `packages/simplycms/schema/drizzle.config.ts`, `packages/simplycms/schema/src/**` (згенероване), `packages/simplycms/schema/package.json`
- Modify: кореневий `package.json` (devDeps: `drizzle-orm`, `drizzle-kit`; скрипт `db:pull`)

- [ ] **Step 1:** `pnpm add -D drizzle-orm drizzle-kit`; `drizzle.config.ts`:

```ts
import { defineConfig } from 'drizzle-kit';
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema.ts',
  out: '../../../supabase/migrations',           // цільова тека міграцій магазину
  dbCredentials: { url: process.env.DATABASE_URL! }, // supabase db url (session pooler)
  entities: { roles: { provider: 'supabase' } },
});
```

- [ ] **Step 2:** `DATABASE_URL=... pnpm drizzle-kit pull --config packages/simplycms/schema/drizzle.config.ts` → згенерує `schema.ts` (+`relations.ts`). **Перевірити покриття RLS:** чи зʼявились `pgPolicy`-визначення для політик наявних таблиць. Якщо політики НЕ витягнуто — зафіксувати в `packages/simplycms/schema/README.md`: «RLS-політики керуються SQL-міграціями напряму; Drizzle покриває таблиці/індекси/FK» і не блокуватись.
- [ ] **Step 3:** Snapshot-baseline: перший `drizzle-kit generate` після pull має дати **порожню** міграцію (схема = БД). Якщо дає діф — розібрати причини (типи, дефолти) і поправити schema.ts до нуль-діфа. Жодних змін у БД у цьому завданні.
- [ ] **Step 4:** Верифікація + коміт: `feat(schema): Drizzle-baseline з інтроспекції наявної БД (spec §9)`.

### Task 16: Скрипти `db:diff` / `db:migrate` + вивід `migrate.mjs`

**Files:**
- Modify: кореневий `package.json` (скрипти); Delete: `supabase/scripts/migrate.mjs`
- Modify: `.github/instructions/data-access.instructions.md` (розділ «Міграції» — новий флоу)

- [ ] **Step 1:** Скрипти:

```json
"db:diff": "drizzle-kit generate --config packages/simplycms/schema/drizzle.config.ts",
"db:migrate": "supabase db push",
"db:pull": "drizzle-kit pull --config packages/simplycms/schema/drizzle.config.ts"
```

(`supabase db push` застосовує невикочені файли з `supabase/migrations` — той самий контракт, що мав `migrate.mjs`; вимагає `supabase link` — задокументувати в data-access.instructions.)
- [ ] **Step 2:** E2e-перевірка конвеєра на копії: додати тестову колонку в `schema.ts` → `pnpm db:diff` → зʼявився SQL-файл у `supabase/migrations` з diff-ом → відкотити правку схеми, видалити згенерований файл (конвеєр працює; у БД нічого не їхало).
- [ ] **Step 3:** `git rm supabase/scripts/migrate.mjs`; інструкції оновити: «Міграції: схема — `@simplycms/schema` (Drizzle TS); зміна схеми = правка schema.ts → `pnpm db:diff` → людське ревʼю SQL → `pnpm db:migrate` → `pnpm db:generate-types`». Прибрати «Не створюй локальні файли міграцій — завжди через MCP» → замінити на новий флоу.
- [ ] **Step 4:** Верифікація + коміт: `feat(db): конвеєр db:diff/db:migrate на drizzle-kit + supabase CLI; migrate.mjs виведено`.

---

## Етап G — i18n-скелет

### Task 17: `@simplycms/i18n` + перші каталоги + лінт

**Files:**
- Create: `packages/simplycms/i18n/{package.json,src/{index.ts,catalogs/uk.ts,catalogs/en.ts}}`
- Modify: `eslint.config.mjs`; 2-3 канонічні сторінки (демонстраційна міграція рядків)
- Test: `packages/simplycms/i18n/src/__tests__/t.test.ts`

**Interfaces (Produces):**

```ts
export type MessageKey = keyof typeof import('./catalogs/uk').messages;
export function t(key: MessageKey, params?: Record<string, string | number>): string;
export function setLocale(locale: 'uk' | 'en'): void;
```

- [ ] **Step 1:** Тест: `t('cart.title')` → «Кошик» (uk дефолт); `setLocale('en')` → `Cart`; відсутній ключ у en → fallback на uk; параметри: `t('catalog.itemsCount', {count: 5})` підставляє число.
- [ ] **Step 2:** FAIL → реалізація: типізовані каталоги-обʼєкти (uk — базовий і повний; en — Partial з fallback), `t()` — синхронний, SSR-safe (module-level locale, задається на bootstrap; коментар про майбутню per-request локаль).
- [ ] **Step 3:** Перенести на `t()` рядки в `pages/Cart.tsx` і `StorefrontShell` (демонстрація патерну; масова міграція рядків — поза Фазою 0).
- [ ] **Step 4:** ESLint: `no-restricted-syntax` warn для JSXText з кирилицею, scoped на канонічні сторінки:

```js
{
  files: ['packages/simplycms/storefront-routes/**/*.tsx'],
  rules: { 'no-restricted-syntax': ['warn', {
    selector: 'JSXText[value=/[а-яіїєґА-ЯІЇЄҐ]/]',
    message: 'Хардкод-рядок у канонічній сторінці — використовуй t() з @simplycms/i18n',
  }] },
}
```

- [ ] **Step 5:** Верифікація + коміт: `feat(i18n): скелет каталогів uk/en + t() + лінт проти хардкодів (spec §12)`.

---

## Етап H — гігієна

### Task 18: Guest-token геть з URL після використання

**Files:**
- Modify: `packages/simplycms/storefront-routes/src/pages/OrderSuccess.tsx` (після Task 11 сторінка тут)
- Test: `packages/simplycms/storefront-routes/src/__tests__/order-success-token.test.tsx`

- [ ] **Step 1:** Тест (jsdom, mock router): після успішного завантаження замовлення з `?token=abc` викликається `navigate({ search: {}, replace: true })`; при помилці завантаження — токен НЕ чіпається (можливість повторити).
- [ ] **Step 2:** FAIL → реалізація: в effect після успішного fetch — `router.navigate({ to: '.', search: (s) => ({ ...s, token: undefined }), replace: true })`; контракт Edge Function не змінюється.
- [ ] **Step 3:** Верифікація + коміт: `fix(security): прибрати guest-token з URL після успішного завантаження замовлення`.

### Task 19: SSR-повнота списків товарів (перевірка + фікс за потреби)

**Files:**
- Create: `tests/ssr-catalog-smoke.md` НЕ створювати — перевірка ручна/скриптова, фікс залежить від результату; межі нижче.

- [ ] **Step 1:** `pnpm dev` + у сусідньому терміналі: `curl -s localhost:3000/catalog | grep -c "<назва відомого тестового товару>"` (взяти назву з БД: `catalog`-сторінка). Аналогічно `/catalog/<sectionSlug>`.
- [ ] **Step 2:** Якщо назви/ціни Є в HTML → зафіксувати результат у PR-описі, завдання завершене без коду.
- [ ] **Step 3 (лише якщо НЕМАЄ):** причина — клієнтський enrichment (див. видалений `ssr-product-list-enrichment.md`, git history). Фікс у межах: loader секції/каталогу віддає збагачені дані (ціна+зображення+назва) через наявні server-функції; сторінка рендерить список із loader-даних до гідрації; клієнтський React Query продовжує довантажувати stock/знижки. Без нових RPC. Тест: повторний curl → назви в HTML.
- [ ] **Step 4:** Коміт (якщо був фікс): `fix(ssr): списки товарів рендеряться в серверному HTML`.

---

## Етап I — фініш фази

### Task 20: Зачистка мертвого + синхронізація документації + DoD

**Files:**
- Delete: невикористані re-export шими в `packages/simplycms/core/src/` (кандидати: `lib/priceUtils`, `lib/discountEngine`, `hooks/useProductsWithStock`-шим, deep-path компонентні шими) — КОЖЕН після `grep`-перевірки використань
- Modify: `CLAUDE.md`, `AGENTS.md`, `.github/instructions/architecture-core.instructions.md` (структура: routes-пакети, supabase-пакет, schema, i18n; прибрати згадки старого контракту тем), `docs/tasks/platform-roadmap.md` (чекбокси Фази 0)

- [ ] **Step 1:** Для кожного шима-кандидата: `grep -rn "<шлях>" --include='*.ts*' src packages themes plugins | grep -v "сам файл"` → 0 → `git rm`. Не нуль → лишити, зафіксувати споживача в описі коміту.
- [ ] **Step 2:** Оновити документи під фактичний стан (структура `src/` = `__root.tsx`+`my/`; таблиця пакетів + `supabase`/`storefront-routes`/`admin-routes`/`i18n`; theme-контракт v2; міграційний флоу). Відмітити чекбокси Фази 0 в роадмапі.
- [ ] **Step 3:** Фінальний DoD Фази 0 (spec §16): `pnpm install && pnpm build && pnpm typecheck && pnpm lint && pnpm test` зелені; `pnpm dev` smoke по сторінках; регрес-тест physical() зелений; `grep -rn "@simplysoftua" .` = 0; `git status` чистий.
- [ ] **Step 4:** Коміт: `chore(phase0): зачистка шимів + синхронізація документації — Фаза 0 завершена`.

---

## Self-review (виконано при написанні)

- **Покриття spec §16 Фаза 0:** routes→Tasks 5-8; канонікалізація→10-13; плагін-wiring→14; supabase→4; Drizzle→15-16; LICENSE→1; i18n→17; гігієна→18-19; шими→20; subtree→3; rename scope→2; регрес-тест physical()→9. Прогалин немає.
- **Відомі ризики, закладені в кроки:** назва опції virtualRouteConfig (Task 6 Step 1 — перевірка типів перед використанням); сигнатура Generator API (Task 9 Step 2); покриття RLS у drizzle pull (Task 15 Step 2 — з fallback-рішенням).
- **Узгодженість імен між завданнями:** `@simplycms/*` (після Task 2 всюди), `bootstrapPlugins` (14), `applyTokens`/`ThemeModule` (10→11), `resolveSupabaseKeys` (4), `StorefrontShell` (11).
