# Зміни

Формат — [Keep a Changelog](https://keepachangelog.com/uk/1.1.0/).

🔴 **Версія у SimplyCMS синхронна:** усі 22 публіковані пакети (21
`@simplycms/*` + unscoped `create-simplycms-store`) завжди мають один номер.
Отже підняття версії **не** означає, що змінився кожен пакет — розділи нижче
називають, що саме змінилось і в кому. Процес випуску —
[`docs/architecture/release-process.md`](docs/architecture/release-process.md).

Дати — це дати **публікації в реєстрі npm**, а не коміту.

---

## [0.2.2] — 2026-08-08

### Виправлено

- **`create-simplycms-store`: code-splitting магазину під pnpm.**
  `template/routes.ts` тепер розгортає симлінк (`realpathSync`) перед тим, як
  віддати шлях до `routes/` пакета ядра в `physical()`.
  🔴 **Це фікс live-дефекту:** pnpm розкладає залежності ізольовано
  (`node_modules/@simplycms/<pkg>` → симлінк на `.pnpm/…`), Vite симлінки
  резолвить, і code-splitter TanStack Router не знаходив роут у
  `TSR_ROUTES_BY_ID_MAP`, бо генератор заповнив мапу шляхами через симлінк.
  Відмова була **мовчазна**: збірка успішна, гейти зелені, просто весь
  застосунок їхав одним initial-чанком. Заміряно на скретч-магазині: **3 чанки
  замість 207**, уся адмінка (98 модулів) і `@tiptap/*` (22) в initial. Після
  фікса — 207 чанків, initial 19/303, адмінка й tiptap в initial 0.
  **Стосується наявних магазинів — див. «Міграція» нижче.**
- **`@simplycms/admin`: перемикання теми не оновлювало сторінку.** Інвалідація
  зачіпала лише серверний кеш, тож клієнтський кеш роутера показував стару
  тему до ручного перезавантаження. Додано
  `packages/admin/src/lib/revalidateTheme.ts`, задіяно в `Themes` і
  `ThemeSettings`.
- **Обхід `minimumReleaseAge`, описаний у `0.2.1`, не працював.** Радили
  `pnpm install --minimum-release-age=0` — такого прапорця в pnpm 11 немає
  (`Unknown option`), а робочий `--config.minimumReleaseAge=0` задачі не
  розв'язує: `pnpm build` через `runDepsStatusCheck` сам перезапускає install
  уже без прапорця і впирається знову. Єдиний спосіб, що працює наскрізь, —
  тимчасовий `minimumReleaseAge: 0` у `pnpm-workspace.yaml` магазину; саме він
  тепер і описаний у шаблоні.

### Змінено

- **Пілот пакування ставить скретч-магазин через `pnpm`, а не `npm`**
  (`scripts/pilot-pack/build.mjs`). Тим самим менеджером, який декларує
  магазин, — отже політики pnpm 11 (`allowBuilds`, ізольована розкладка
  `node_modules`) уперше опинились **усередині** гейта. Саме цей перехід і
  виявив дефект code-splitting вище.
- **Гард провенансу tarball-ів** (`scripts/pilot-pack/provenance.mjs`): після
  install пілот читає lockfile скретча й падає, якщо хоч один пакет ядра
  приїхав не з `file:`. Потрібен тому, що механізм примусу локальних пакетів
  (`overrides` у `pnpm-workspace.yaml`) під pnpm ламається **мовчки**, а в
  реєстрі лежить та сама версія — тобто пілот міг би зелено перевіряти вже
  опубліковані пакети замість тих, що йдуть на публікацію.

### Документація

- `README.md` для всіх 22 пакетів — це картка пакета на npmjs.
- Актуалізовано `docs/tasks/platform-roadmap.md`,
  `docs/architecture/test-contours.md`,
  `docs/architecture/release-process.md`, `CLAUDE.md`.
- Заведено цей файл.

### 🔴 Міграція наявних магазинів

Фікс `routes.ts` живе в **шаблоні** скаффолдера, а шаблон розгортається один
раз — у момент `pnpm create simplycms-store`. Отже магазин, створений із
`0.2.0` або `0.2.1`, **не отримає цей фікс з оновленням пакетів**: файл
належить магазину, а не ядру.

**Чи вас це стосується.** У теці магазину:

```bash
pnpm build
ls dist/client/assets/*.js | wc -l
```

Одиниці (2–5) — стосується. Близько 200 — ні (магазин ставили не через pnpm).

**Що зробити.** Замінити вміст `routes.ts` у корені магазину на:

```ts
import { realpathSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { physical, rootRoute } from '@tanstack/virtual-file-routes';

const STORE_ROOT = dirname(fileURLToPath(import.meta.url));
const ROUTES_DIR = resolve(STORE_ROOT, 'src/routes');

const coreRoutes = (name: string) =>
  relative(
    ROUTES_DIR,
    realpathSync(resolve(STORE_ROOT, 'node_modules', name, 'routes')),
  );

export const routes = rootRoute('__root.tsx', [
  physical('', coreRoutes('@simplycms/storefront-routes')),
  physical('', coreRoutes('@simplycms/admin-routes')),
  // Кастомні роути цього магазину.
  physical('', 'my'),
]);
```

Якщо ви додавали власні `physical()`-записи — збережіть їх, змінюється лише
спосіб отримання шляхів до пакетів ядра.

Далі `pnpm build` і та сама перевірка: має бути ~200 чанків. Правка безпечна й
під npm — там `realpathSync` тотожність.

---

## [0.2.1] — 2026-08-04

### Виправлено

- Шаблон `create-simplycms-store` приведено до pnpm 11: конфігурація pnpm
  переїхала в `pnpm-workspace.yaml` (поле `pnpm` у `package.json` pnpm 11 більше
  не читає), додано `allowBuilds` — без нього install обривається
  `ERR_PNPM_IGNORED_BUILDS`. Тоді ж у доки шаблону потрапив опис обходу
  `minimumReleaseAge` — **хибний**, виправлено в `0.2.2`.

### Змінено

- Тулчейн: pnpm 10.26 → 11.20; мажорні оновлення залежностей (ESLint 10,
  lucide 1, `@supabase/ssr` 0.12, react-day-picker 10).

### Документація

- `docs/architecture/test-contours.md` — межі тестування: що доводить кожен
  гейт пілота і які зони лишаються сліпими.

---

## [0.2.0] — 2026-08-04

### Додано

- **`create-simplycms-store`** — CLI-скаффолдер магазину з вбудованим шаблоном
  (`pnpm create simplycms-store my-shop`). Це 22-й публікований пакет і єдиний
  unscoped.
- **Bootstrap власника** — `owner:invite` через `service_role` +  роути
  `/auth/confirm` (`verifyOtp`) і `/auth/set-password` для invite-флоу.
- **Gate E** у пілоті — e2e owner-флоу проти локального стеку Supabase.

### Змінено

- Сплощення `packages/simplycms/*` → `packages/*`: проміжна тека була точкою
  subtree-дзеркала окремого core-репо, а дзеркало вивели з експлуатації ще у
  Фазі 0. Тулінг тепер відрізняє ядро від скаффолдера за **іменем**
  (`@simplycms/`), а не за шляхом.

### Виправлено

- 302-редіректи в auth віддають cookies (замість `Response.redirect`).
- Invite-лист веде на реальну адресу магазину, а не на дефолтний
  `http://localhost:3000`.

---

## [0.1.0] — 2026-08-03

Перша публікація ядра на npmjs: 21 пакет `@simplycms/*`. Підсумок Фаз 0 і 1 —
роути й канонічні сторінки переїхали в пакети, host стиснуто до `__root.tsx` +
`src/routes/my/`, теми переведено на контракт v2 (`manifest + tokens +
components`), схема БД — Drizzle-baseline, заведено пілот пакування і
`pnpm release`.

🔴 Тег `v0.1.0` у репозиторії **не позначає цей реліз**: він указує на коміт
`dd822d6` часів scope `@simplysoftua`, тобто до перейменування і до публікації
на npmjs. Теги релізів у SimplyCMS наразі не ведуться — борг описано в
[`docs/architecture/release-process.md`](docs/architecture/release-process.md).

Посилання ведуть на npmjs, а не на теги GitHub: теги релізів наразі не
створюються (борг, див. `release-process.md`).

[0.2.2]: https://www.npmjs.com/package/@simplycms/objects/v/0.2.2
[0.2.1]: https://www.npmjs.com/package/@simplycms/objects/v/0.2.1
[0.2.0]: https://www.npmjs.com/package/@simplycms/objects/v/0.2.0
[0.1.0]: https://www.npmjs.com/package/@simplycms/objects/v/0.1.0
