# Packaging audit findings (pre-rename)

> **[АРХІВ 2026-07-30]** Аудит виконано; результати враховані у rename scope @simplysoftua та CI publish (2026-06-12).

> Створено 2026-06-12 у межах задачі
> [`metahub-hub-products-adoption.md`](./metahub-hub-products-adoption.md), розділ 1.
> Аудит виконано **до** перейменування scope `@simplycms` → `@simplysoftua`
> (старий scope тут згадано без слеша навмисно, щоб не порушувати DoD —
> grep старого scope по репо має давати 0), на гілці
> `claude/simplycms-modular-metahub-4tj7y7`.

## Команди

- `pnpm install` — OK (pnpm 10.26.1, без помилок).
- `pnpm build:packages` — OK, усі 6 публікованих пакетів зібралися
  (tsup ESM + DTS).

## Публіковані пакети (`private: false`)

`objects`, `domain`, `data-supabase`, `react-query`, `runtime`,
`storefront`.

Решта (`core`, `admin`, `ui`, `plugin-system` (pkg `…/plugins`),
`theme-system` (pkg `…/themes`), `cart-ui`, `catalog-ui`,
`checkout-ui`, `profile-ui`, `reviews-ui`) — `private: true`, не
публікуються.

## Звірка exports dev ↔ publish (1:1)

Скрипт пройшовся по `exports` (dev-умова, `src`) і
`publishConfig.exports` (publish-умова, `dist`) кожного пакета,
порівняв набір ключів та перевірив наявність кожного target-файлу в
`dist` після build:

| Пакет | dev/publish ключі | 1:1 | Биті шляхи в dist |
|-------|-------------------|-----|-------------------|
| `objects` | `.`, `./objects`, `./ports` | ✅ | немає |
| `domain` | `.`, `./pricing`, `./discounts`, `./inventory`, `./shipping` | ✅ | немає |
| `data-supabase` | `.` | ✅ | немає |
| `react-query` | `.`, `./queries` | ✅ | немає |
| `runtime` | `.` | ✅ | немає |
| `storefront` | `.`, `./loaders`, `./seo` | ✅ | немає |

**Висновок:** розбіжностей dev/publish exports і битих шляхів у dist
**не виявлено** — нічого виправляти в exports у межах кроку 4.

## `npm pack --dry-run`

Для кожного пакета tarball містить очікуване: `dist/**` (js + d.ts +
.map) і `src/**` (через `files: ["dist", "src"]`, src залишено навмисно
для dev-умови внутрішнього workspace-споживання) + `package.json`.
Жоден subpath з publish-`exports` не відсутній у `dist`.

Примітка: `.map`-файли потрапляють у tarball (наслідок `files: ["dist"]`).
Це не блокер для публікації; за бажанням можна відсікти пізніше.

## git tags

`git tag --list` — порожньо. Тегів немає; перший реліз (`v0.1.0`)
робиться **окремим кроком після ревью** (поза цією задачею).

## `.github/workflows/publish-packages.yml` (стан до правок)

- Тригер: `push: tags: ['v*']` + `workflow_dispatch`. Build:packages
  гониться **тільки** в межах publish-джоби (на PR не ганяється).
- `permissions: contents: read, packages: write` — вже є.
- Реєстр: `vars.NPM_REGISTRY || 'https://registry.npmjs.org'` (за
  замовч. npmjs, **не** GitHub Packages).
- Авторизація: `NODE_AUTH_TOKEN: secrets.NODE_AUTH_TOKEN` (не
  `GITHUB_TOKEN`).
- Filter-и публікації використовували старий scope `@simplycms` (без
  слеша тут навмисно).
- Коментар у файлі вже фіксує: для GitHub Packages scope має збігатися
  з власником → перейменувати на `@simplysoftua`.

**Потрібні правки (крок 4):** зафіксувати registry на
`https://npm.pkg.github.com`, авторизація через `GITHUB_TOKEN`,
додати окрему job/крок `build:packages` на PR (без publish),
оновити scope у filter-ах.

## Обсяг rename старого scope → `@simplysoftua/`

`grep -rl` старого scope (поза `node_modules`/`.git`): **392 файли**.
Розподіл: `packages` 236, `src` 73, `themes` 43, `docs` 15, `.github`
16, `supabase` 1, кореневі конфіги (`vite.config.ts`,
`vitest.config.ts`, `tsconfig.json`, `simplycms.config.ts`,
`package.json`). `plugins/` — 0.

Phantom-alias `db-types` (→ `supabase/types.ts`, нове ім'я
`@simplysoftua/db-types`) у `tsconfig.json` paths і `vite.config.ts`
alias — перейменовано разом.

Особливий випадок: dir `plugin-system` має package name
`@simplysoftua/plugins`, dir `theme-system` → `@simplysoftua/themes`.
Префіксна заміна scope покриває їх однаково.
