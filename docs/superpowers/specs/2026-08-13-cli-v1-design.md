# @simplycms/cli v1 (doctor / add / update / db:diff) + контракт серверного env

> Статус: затверджується цим PR. Джерело правди скоупу v1 для `@simplycms/cli`
> (роадмап Фази 2: «окрема спека після скаффолдера») і для закриття боргу №7
> роадмапу («серверний env запікається в білд»). Створено 2026-08-13.
> Батьківська спека — [`2026-07-30-platform-architecture-design.md`](2026-07-30-platform-architecture-design.md)
> (§3, §7–§9, §15–§17); трекінг — [`platform-roadmap.md`](../../tasks/platform-roadmap.md).

---

## 1. Рішення, що закривають задокументовані суперечності

Аудит доків (2026-08-13) знайшов чотири розбіжності. Фіксуємо рішення:

1. **Ім'я пакета: `@simplycms/cli` (scoped), ім'я бінарника: `simplycms`.**
   Батьківська спека §4 (таблиця пакетів) і §16 (Фаза 2) кажуть `@simplycms/cli`;
   `release-process.md` двічі згадує «unscoped `simplycms` CLI (Фаза 3)». Це не
   суперечність, якщо розділити пакет і бінарник: пакет живе під scope (покритий
   чинним NPM_TOKEN і конвеєром), а команда користувача — `pnpm simplycms …`
   (bin-ім'я не зобов'язане збігатися зі scope). Unscoped npm-ім'я `simplycms`
   (перевірено 2026-08-13 — досі вільне, 404) лишається дією власника: якщо
   колись знадобиться `pnpm dlx simplycms` — це буде тонкий пакет-аліас поверх
   `@simplycms/cli`, окремим рішенням.
2. **Фаза: 2.** Чекбокс роадмапу Фази 2 — джерело правди трекінгу; згадки
   «Фаза 3» у release-process.md стосуються саме гіпотетичного unscoped-аліаса.
3. **«~6 файлів» `simplycms update` := множина `SYNCED_FILES`** зі
   `scripts/sync-create-store-template.mjs` (11 файлів host-глю, які магазин не
   редагує). Число «~6» у батьківській спеці — оцінка до Фази 2; фактичну
   множину визначає механізм синку, а не число. `src/engine.shared.ts` свідомо
   НЕ входить (template-варіант навмисно відрізняється від кореневого).
4. **Іменування гейтів.** «Gate CLI» лишається за смоуком скаффолдера
   (`create-pkg-smoke.mjs`). Смоук упакованого `@simplycms/cli` називається
   **Gate TOOL** — і в пілоті, і в `test-contours.md`.

## 2. Форма пакета

За прецедентом `create-simplycms-store`: **чистий ESM `.mjs` без build-кроку**.
CLI виконується в магазині користувача, де немає гарантій тулчейна — нуль
транспіляції означає нуль способів зламатися при публікації.

```jsonc
// packages/cli/package.json — ключові поля
{
  "name": "@simplycms/cli",
  "version": "0.3.0",            // синхронна з рештою; bump.mjs підхопить сам
  "private": false,               // буквально false — інакше pack-inspect не бачить
  "type": "module",
  "bin": { "simplycms": "src/index.mjs" },
  "main": "./src/index.mjs",
  "exports": { ".": "./src/index.mjs" },
  "files": ["src", "host"],
  "engines": { "node": ">=20" },
  "publishConfig": {
    "access": "public",
    "registry": "https://registry.npmjs.org",
    "main": "./src/index.mjs",
    "exports": { ".": "./src/index.mjs" }
    // без dist-переписування — публікуємо сирці, як admin-routes
  },
  "dependencies": { "@clack/prompts": "^1.7.0" }
}
```

- Аліасів tsconfig/vite пакет **не отримує** (прецедент schema/admin-routes:
  bin-інструмент ніхто не імпортує як код).
- `pnpm build:packages` пропускає його мовчки (немає скрипту `build`) — як
  admin-routes.
- Tarball-parity, bump, publish підхоплюють автоматично (`private: false` +
  scope + `publishConfig`).
- UX-мова — українська, як у скаффолдера. Ліміт 150 рядків/файл — команди
  розбиті на модулі.

Структура:

```
packages/cli/
├── package.json · README.md
├── host/                    # канонічні host-файли (закомічена копія, див. §5)
└── src/
    ├── index.mjs            # dispatch: doctor|add|update|db:diff, --help/--version
    ├── context.mjs          # корінь магазину, читання manifest/env-файлів
    ├── ui.mjs               # обгортки @clack/prompts
    ├── doctor.mjs           # + doctor-checks.mjs (розбивка під ліміт рядків)
    ├── add.mjs · config-edit.mjs
    ├── update.mjs · host-drift.mjs
    └── db-diff.mjs
```

## 3. Принцип помилок (наскрізний)

**Жодних мовчазних запасних варіантів.** Команда або робить рівно те, що
заявила, або падає з ненульовим кодом і діагностикою, що робити руками.
Ідемпотентність — не fallback: повторний запуск, якому нема чого робити, — це
успіх із повідомленням «вже зроблено». `doctor` — виняток за визначенням: його
продукт — саме звіт про проблеми; але перевірка, яку неможливо виконати
(нема мережі, нечитабельний конфіг), звітується окремим станом «не вдалося
перевірити», а не пропускається тихо.

## 4. Команди v1

### 4.1 `simplycms doctor`

Read-only діагностика магазину. Оффлайн-перевірки (завжди):

| # | Перевірка | Рівень |
|---|-----------|--------|
| 1 | корінь магазину знайдено (`package.json` із залежностями `@simplycms/*`) | error |
| 2 | усі `@simplycms/*`-залежності — одна версія; версія CLI збігається | error / warn |
| 3 | `packageManager` — pnpm 11 | warn |
| 4 | `pnpm-workspace.yaml` містить `allowBuilds` | error |
| 5 | env: `VITE_SUPABASE_URL` + publishable/anon-ключ у `process.env` або `.env.local`/`.env` | error |
| 6 | host-файли: дрейф проти канону (механізм §4.3) | warn + підказка `update --write` |
| 7 | міграції: відставання від `@simplycms/schema/migrations` (механізм §4.4) | warn + підказка `db:diff --write`; змінений спільний файл — error |
| 8 | `routes.ts`: `realpathSync` + монтування обох route-пакетів | error |
| 9 | `tailwind.config.ts`: `content` покриває `node_modules/@simplycms/*` | error |
| 10 | `simplycms.config.ts` існує і містить якорі `themes:`/`plugins:` | error |

Онлайн-перевірки (лише коли env із п.5 присутній): доступність Supabase REST;
активна тема з БД (`themes.is_active`) присутня серед ключів `themes` конфігу;
активні плагіни з БД — серед зареєстрованих у конфізі (деградація зі спеки §8).
Через голий `fetch`, без клієнтських бібліотек. Мережева помилка → стан
«не вдалося перевірити» (позначається у звіті, на exit-код не впливає).

Exit-код: `1` якщо є хоч один error; самі warn → `0`. `--strict`: warn теж валить.

### 4.2 `simplycms add <pkg> (--plugin | --theme) [--name <key>] [--no-install] [--dry-run]`

Build-time-встановлення зі спеки §7: `pnpm add <pkg>` → запис у
`simplycms.config.ts` → нагадування про rebuild. Тип (`--plugin`/`--theme`)
обов'язковий і взаємовиключний — автодетекції у v1 немає (екосистемних пакетів
ще не існує; вгадування було б мовчазним запасним варіантом).

- Редагування конфігу — якірне: вставка в `plugins: [` масив запису
  `{ name: '<key>', module: () => import('<pkg>') }`, у `themes: {` — запису
  `'<key>': () => import('<pkg>')`. `<key>` — з `--name` або похідний від імені
  пакета (без scope і префіксів `simplycms-plugin-`/`simplycms-theme-`).
- Якір не знайдено (конфіг переписаний нестандартно) → **нічого не змінюємо**,
  exit 1, друкуємо точний рядок для ручної вставки.
- Ідемпотентність: `import('<pkg>')` уже в конфізі → успішний no-op.
- `--dry-run` показує майбутній diff конфігу без запису.
- Пост-кроки друком: rebuild; для плагіна — нагадування про міграції
  (конвеєр по-справжньому запрацює з Plugin SDK, Фаза 3).

Монтаж `adminRoutes` плагінів і copy-in тем — свідомо поза v1 (Фаза 3/4).

### 4.3 `simplycms update [--check | --write] [--to <version>] [--no-install]`

Сценарій 2 батьківської спеки: оновлення ядра + доганяння host-файлів.

1. **Версії.** Шаблон пінить точні версії, тож `pnpm update` без діапазонів —
   no-op. Команда бере цільову версію з `--to`, а без нього питає реєстр
   (`pnpm view @simplycms/cli version`); реєстр недоступний → exit 1 із
   підказкою `--to`. Далі `pnpm add` для **всіх** `@simplycms/*` із
   `package.json` магазину (dependencies + devDependencies, включно з самим CLI)
   на цільову версію. `--no-install` пропускає цей крок (лише host-файли).
2. **Host-файли.** Канон — тека `host/` пакета CLI: байт-копії `SYNCED_FILES`,
   синхронізовані тим самим `pnpm template:sync` і закріплені parity-тестом
   (`host/` сам є маніфестом — рекурсивний обхід теки, без дубльованого списку).
   `--check` (дефолт): перелік файлів, що розійшлися, exit 1 при дрейфі
   (придатне для CI магазину). `--write`: перезапис файлів канонічними
   версіями; магазин — git-репозиторій, ревʼю дрейфу = `git diff`.

### 4.4 `simplycms db:diff [--write]`

Закриває реальну діру сценарію 2: після оновлення ядра магазин сьогодні **не
має шляху** отримати нові core-міграції (tarball `@simplycms/schema` їх не
везе, а копія в магазині зафіксована на момент скаффолда).

1. `@simplycms/schema` починає везти `migrations/` у tarball — байт-копія
   кореневих `supabase/migrations/`, той самий механізм sync + parity (§5).
2. `db:diff` порівнює `supabase/migrations/` магазину з
   `node_modules/@simplycms/schema/migrations/`:
   - відсутні в магазині → список «нові міграції ядра»; `--write` копіює їх
     (тільки додавання, forward-fix-only зі спеки §9);
   - наявні лише в магазині → інформаційний список «власні міграції»;
   - спільне ім'я з різним вмістом → **error, нічого не пишемо** (міграції
     immutable; розходження — привід для ручного розбору).
3. Далі друком: ревʼю `git diff` → `supabase db push` (як у README шаблону).

Drizzle-композиція з плагінними фрагментами (спека §9) — Фаза 3, коли з'явиться
Plugin SDK зі схемами; семантика команди сумісна (це той самий «дифф проти
встановленого ядра», що розшириться композицією).

## 5. Канонічні артефакти: розширення template:sync

`scripts/sync-create-store-template.mjs` отримує дві додаткові цілі (та сама
команда `pnpm template:sync`, той самий принцип «закомічена копія +
парність-тест»):

| Джерело (корінь) | Ціль | Споживач |
|---|---|---|
| `SYNCED_FILES` (11 host-файлів) | `packages/cli/host/**` | `simplycms update` |
| `supabase/migrations/` | `packages/schema/migrations/` | `simplycms db:diff` |

`tests/create-store-template-parity.test.ts` розширюється дзеркальними
асертами байт-ідентичності обох цілей. `packages/schema/package.json`:
`files` += `"migrations"`.

## 6. Інтеграція в шаблон магазину і пілот

- `template/package.json.tpl`: `@simplycms/cli: "__SIMPLYCMS_VERSION__"` у
  `devDependencies` — свіжий магазин отримує CLI одразу; парний запис у
  пілот-фікстурі `tests/pilot/store-template/package.json` (стереже наявний
  parity-тест deps).
- Пілот: `writeManifest` мусить підміняти `@simplycms/*` на `file:`-tarball-и і
  в `devDependencies` (інакше install скретча піде в реєстр за пакетом, якого
  там ще немає).
- **Gate TOOL** (новий, за зразком Gate CLI): `pnpm pack` пакета `@simplycms/cli`
  → розпакування → `node src/index.mjs --help` і `doctor` на скретч-магазині →
  перевірка, що `host/` доїхав у tarball. Живе як packaging-тест
  (`tests/cli-pack.test.ts`, виключений із дефолтного прогону — як
  `create-store-pack.test.ts`) і кроком пілота.
- `printNextSteps` скаффолдера згадує `pnpm simplycms doctor` як перший крок
  діагностики.

## 7. Суміжний трек: контракт серверного env (борг №7 роадмапу)

Рішення власника (2026-08-13): **один контур — одне джерело, без дуального
резолву; відсутнє значення — гучне падіння.**

| Контур | Єдине джерело | Як наповнюється |
|---|---|---|
| Сервер (SSR, server fns, middleware, SEO) | `process.env`, читається лише в рантаймі (усередині фабрик/хендлерів, не на модуль-рівні) | dev: `vite.config.ts` вантажить `.env`/`.env.local` у `process.env` (реальний env процесу має пріоритет); prod: `server.mjs` робить те саме перед стартом |
| Клієнт (браузерний бандл) | `import.meta.env` (запечений `vite build`) | як і досі; publishable-ключ — публічний за контрактом |

Конкретно:

- `packages/supabase/src/server-client.ts` і `anon-client.ts` →
  `resolveSupabaseKeys(process.env)`. Помилка відсутніх ключів — наявна, гучна.
- `src/start.ts` (`isSupabaseEnvReady`) → `process.env`; файл синкається у
  шаблон (`template:sync`).
- `packages/storefront-routes/src/seo/robots.ts`, `sitemap.ts`: модульна
  константа `BASE_URL` → лінива функція від `process.env.VITE_SITE_URL`
  (дефолт `https://example.com` — чинна задокументована семантика, не новий
  fallback). `routes/api/health.tsx` → `process.env`.
- `browser-client.ts` — без змін. Ізоморфний код (роут товару,
  `simplycms.config.ts`) лишається на `import.meta.env` — це клієнтський
  контур; там значення потрібне в бандлі.
- Gate C розширюється: `anon-client` додається в `SERVER_PAYLOAD` — витік у
  клієнтський бандл ловиться машиною, а не падінням у користувача.
- Наслідок: ротація Supabase-ключів = перезапуск процесу (`pnpm start`), без
  перезбірки. `.env`-файли в prod — опційна зручність; джерело правди — env
  процесу, він завжди виграє у файлів; `.env.local` виграє у `.env`.

## 8. Поза скоупом v1 (свідомо)

- `simplycms create plugin` / `plugin:dev` (авторський цикл) — Фаза 3, разом із
  Plugin SDK.
- Монтаж `adminRoutes` плагінів у `routes.ts` — Фаза 3 (механізму монтування ще
  немає).
- Drizzle-композиція плагінних схем у `db:diff` — Фаза 3.
- Copy-in режим тем (`add --copy`) — Фаза 4.
- Semver-перевірка `engines.simplycms` (реальна, а не наявність поля) — окремий
  пункт Фази 2 (реліз-потяг v1.0), не блокується цим CLI.
- Unscoped npm-пакет `simplycms` — дія власника, окремим рішенням.
- AST-редагування конфігу через TypeScript API — усвідомлене спрощення v1
  (якірна вставка з чесним падінням); переглянути, коли конфіг ускладниться.

## 9. Верифікація

- Юніт-тести чистих функцій — у кореневій `tests/` (прецедент
  `create-store-cli.test.ts`): контекст/дрейф/дифф міграцій/якірна вставка —
  на скаффолді шаблону у tmp, без мережі й БД.
- Parity-тести §5. Gate TOOL §6. Повний конвеєр гейтів + `pnpm pilot:pack` —
  обов'язкові перед мержем; `pnpm pilot:e2e` (Docker) — на машині власника, як
  для всіх змін пакування.
- Публікація: мерж цього PR у `main` **опублікує новий пакет** `@simplycms/cli`
  — за чинним правилом «введення нового пакета є релізним рішенням у момент
  мержу» (release-process.md).
