# @simplycms/cli

CLI обслуговування розгорнутого магазину SimplyCMS — бінарник `simplycms`:
діагностика, встановлення плагінів/тем, оновлення ядра з доганянням host-файлів
і синхронізація core-міграцій.

Пакет ядра [SimplyCMS](https://github.com/simplyCMS/simplyCMS) — відкритої
e-commerce CMS на TanStack Start + чистий PostgreSQL. Свіжий магазин зі скаффолдера
`pnpm create simplycms-store` отримує CLI одразу (у `devDependencies`).

## Встановлення

```bash
pnpm add -D @simplycms/cli
pnpm simplycms doctor
```

## Команди

| Команда | Що робить |
| ------- | --------- |
| `simplycms doctor [--strict] [--online] [--production]` | Read-only діагностика магазину: версії ядра, pnpm-конфіг, env, host-файли, міграції, якорі конфігу, лінки агентних скілів, драйвери `pg`/`nodemailer`, пошта. `--online` — ще й стан БД (доступність, журнал міграцій, з `DATABASE_URL`); без нього у звіті явний skip. `--production` — перевіряти як прод (log-драйвер пошти — error, а не warn; те саме при `NODE_ENV=production`); перший рядок звіту називає режим. Exit 1 при помилках; `--strict` — попередження теж валять |
| `simplycms status [--json \| --hook] [--production]` | Етап магазину (`not-created` … `deployed`), стан перевірок і наступний скіл; ті самі перевірки, що в `doctor`, плюс онлайн-частина з таймаутом. `--json` — машинний вивід, `--hook` — короткий вступ для хука сесії агента. Exit `0` — гаразд, `3` — є що робити, інакше стан невідомий |
| `simplycms smoke <url>` | Швидкий живий смоук розгорнутого магазину: health, ключові сторінки, редирект адмінки, robots, стиснення br, відмова 413 на завеликому тілі. Exit 0/1 |
| `simplycms deploy:record get \| set` | Єдиний шлях до `.simplycms/deploy.json` (запис розгортання): `get` друкує його, `set` читає JSON зі stdin. Exit `0`; `3` — запису ще немає (`get`); `1` — помилка |
| `simplycms add <pkg> (--plugin \| --theme) [--name <key>] [--copy] [--no-install] [--dry-run]` | `pnpm add <pkg>` + якірний запис у `simplycms.config.ts`. Тип обовʼязковий — автодетекції немає; `--copy` (лише з `--theme`) — copy-in: сирці теми лягають у `themes/<key>`, а пакет знімається |
| `simplycms create (plugin \| theme) <name> [--dry-run]` | Скаффолд плагіна або теми в самому магазині: тека `plugins/<name>` / `themes/<name>` із шаблону + якірний запис у `simplycms.config.ts` |
| `simplycms theme:conformance <name>` | Conformance-гейт контракту тем v3: рендерить заявлені темою `views` на фікстурах ядра й падає, якщо загублено комерційний реквізит. `<name>` — ключ теми в `simplycms.config.ts`; потребує `jsdom` у магазині (`pnpm add -D jsdom`) |
| `simplycms update [--check \| --write] [--to <version>] [--no-install]` | Оновлення пакетів ядра (`simplycms` + сателіти `@simplycms/*`) до `--to` або latest із реєстру, лагодження лінків агентних скілів і файлів агента + доганяння host-файлів (канон — тека `host/` цього пакета). Без прапорців — **з мережею**: питає реєстр, ставить пакети (`pnpm add`), передає звірку новому CLI; дрейф host-файлів без `--write` — exit 1. `--write` — те саме, але ще й перезаписує host-файли. `--check` — **без мережі й install**, нічого не пише, придатне для CI: exit `0` — збігається, `3` — є розбіжності, `1` — помилка. Межу сумісності (мінорна для 0.x, мажорна з 1.0) без `--to` не перетинає: exit 3 і посилання на BREAKING у CHANGELOG |
| `simplycms db:diff [--write]` | Порівняння `db/migrations/` магазину з міграціями встановленого ядра (`node_modules/simplycms/migrations`): нові міграції ядра `--write` докопіює (forward-only); змінений спільний файл — error без запису |
| `simplycms db:apply [--dry-run \| --check]` | Накат `db/migrations` магазину через ядро (`simplycms/migrate`): журнал із контрольними сумами, advisory-лок, транзакція на файл. Потребує `MIGRATION_DATABASE_URL` (власник схеми, не `app_runtime`). Exit `0` — гаразд, `3` — `--check` і є ненакочені, `1` — помилка |

## Наскрізний сценарій: оновлення ядра

```bash
pnpm simplycms doctor            # стартова діагностика
pnpm simplycms update            # бамп пакетів ядра + звіт дрейфу host-файлів
pnpm simplycms update --write    # догнати host-файли (ревʼю: git diff)
pnpm simplycms db:diff --write   # донести нові core-міграції (ревʼю: git diff)
pnpm simplycms db:apply          # накатити після ревʼю (MIGRATION_DATABASE_URL — власник схеми, не app_runtime)
pnpm build && pnpm start         # rebuild
```

Встановлення плагіна/теми:

```bash
pnpm simplycms add @acme/simplycms-plugin-wishlist --plugin
pnpm simplycms add @acme/simplycms-theme-solar --theme --name solar --dry-run
pnpm build   # активація й налаштування — далі з адмінки, без перезбірки
```

Власна тема з нуля (і гейт, якщо вона заявляє `views`):

```bash
pnpm simplycms create theme solar        # скаффолд themes/solar + запис у конфіг
pnpm simplycms theme:conformance solar   # гейт views (потребує jsdom)
```

## Як влаштовано доганяння host-файлів

Тека `host/` цього пакета — байт-копії всіх host-файлів каркаса (server-runner,
entry-файли, глю движка, шим хука сесії агента) — тобто всі файли `packages/cli/host/`, синхронізовані з монорепо тим самим механізмом, що й
шаблон скаффолдера, і закріплені parity-тестами. `simplycms update --write`
перезаписує ними локальні копії магазину; файли, якими магазин володіє
(`routes.ts`, `vite.config.ts`, `simplycms.config.ts`, `tailwind.config.ts`),
CLI не чіпає ніколи.

## Принцип помилок

Жодних мовчазних запасних варіантів: команда або робить рівно те, що заявила,
або падає з ненульовим кодом і діагностикою, що зробити руками. Зокрема
`add` при нестандартній формі конфігу (якір не знайдено, однорядковий
непорожній блок) нічого не змінює і друкує точний рядок для ручної вставки.
`doctor` — виняток за визначенням (його продукт — звіт про проблеми), але
перевірка, яку неможливо виконати, звітується окремим станом «не вдалося
перевірити», а не пропускається тихо.

## Документація

- Повна робоча інструкція механізму:
  [`docs/architecture/cli.md`](https://github.com/simplyCMS/simplyCMS/blob/main/docs/architecture/cli.md)
- Дизайн-рішення і межі скоупу v1:
  [спека 2026-08-13](https://github.com/simplyCMS/simplyCMS/blob/main/docs/superpowers/specs/2026-08-13-cli-v1-design.md)

## Ліцензія

MIT
