# @simplycms/cli

CLI обслуговування розгорнутого магазину SimplyCMS — бінарник `simplycms`:
діагностика, встановлення плагінів/тем, оновлення ядра з доганянням host-файлів
і синхронізація core-міграцій.

Пакет ядра [SimplyCMS](https://github.com/simplyCMS/simplyCMS) — відкритої
e-commerce CMS на TanStack Start + Supabase. Свіжий магазин зі скаффолдера
`pnpm create simplycms-store` отримує CLI одразу (у `devDependencies`).

## Встановлення

```bash
pnpm add -D @simplycms/cli
pnpm simplycms doctor
```

## Команди

| Команда | Що робить |
| ------- | --------- |
| `simplycms doctor [--strict]` | Read-only діагностика магазину: версії ядра, pnpm-конфіг, env, host-файли, міграції, якорі конфігу; з env — ще й звірка активної теми/плагінів проти Supabase. Exit 1 при помилках; `--strict` — попередження теж валять |
| `simplycms add <pkg> (--plugin \| --theme) [--name <key>] [--copy] [--no-install] [--dry-run]` | `pnpm add <pkg>` + якірний запис у `simplycms.config.ts`. Тип обовʼязковий — автодетекції немає; `--copy` (лише з `--theme`) — copy-in: сирці теми лягають у `themes/<key>`, а пакет знімається |
| `simplycms create (plugin \| theme) <name> [--dry-run]` | Скаффолд плагіна або теми в самому магазині: тека `plugins/<name>` / `themes/<name>` із шаблону + якірний запис у `simplycms.config.ts` |
| `simplycms theme:conformance <name>` | Conformance-гейт контракту тем v3: рендерить заявлені темою `views` на фікстурах ядра й падає, якщо загублено комерційний реквізит. `<name>` — ключ теми в `simplycms.config.ts`; потребує `jsdom` у магазині (`pnpm add -D jsdom`) |
| `simplycms update [--check \| --write] [--to <version>] [--no-install]` | Оновлення всіх `@simplycms/*` до `--to` або latest із реєстру + доганяння host-файлів (канон — тека `host/` цього пакета). `--check` (дефолт) — exit 1 при дрейфі, придатне для CI |
| `simplycms db:diff [--write]` | Порівняння `supabase/migrations/` магазину з міграціями встановленого `@simplycms/schema`: нові міграції ядра `--write` докопіює (forward-only); змінений спільний файл — error без запису |

## Наскрізний сценарій: оновлення ядра

```bash
pnpm simplycms doctor            # стартова діагностика
pnpm simplycms update            # бамп @simplycms/* + звіт дрейфу host-файлів
pnpm simplycms update --write    # догнати host-файли (ревʼю: git diff)
pnpm simplycms db:diff --write   # донести нові core-міграції (ревʼю: git diff)
supabase db push                 # накатити міграції після ревʼю
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

Тека `host/` цього пакета — байт-копії 11 host-файлів каркаса (server-runner,
entry-файли, глю движка), синхронізовані з монорепо тим самим механізмом, що й
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
