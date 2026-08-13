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
```

## Команди

| Команда | Що робить |
| ------- | --------- |
| `simplycms doctor [--strict]` | Read-only діагностика магазину: версії ядра, pnpm-конфіг, env, host-файли, міграції, якорі конфігу; з env — ще й перевірки проти Supabase. Exit 1 при помилках; `--strict` — попередження теж валять |
| `simplycms add <pkg> (--plugin \| --theme) [--name <key>] [--no-install] [--dry-run]` | `pnpm add <pkg>` + якірний запис у `simplycms.config.ts`. Тип обовʼязковий — автодетекції немає |
| `simplycms update [--check \| --write] [--to <version>] [--no-install]` | Оновлення всіх `@simplycms/*` + доганяння host-файлів (канон — тека `host/` цього пакета) |
| `simplycms db:diff [--write]` | Порівняння `supabase/migrations/` магазину з міграціями встановленого `@simplycms/schema` |

## Приклади

```bash
pnpm simplycms doctor
pnpm simplycms doctor --strict
pnpm simplycms add @acme/simplycms-plugin-wishlist --plugin
pnpm simplycms add @acme/simplycms-theme-solar --theme --name solar --dry-run
```

## Принцип помилок

Жодних мовчазних запасних варіантів: команда або робить рівно те, що заявила,
або падає з ненульовим кодом і діагностикою, що зробити руками. `doctor` —
виняток за визначенням (його продукт — звіт про проблеми), але перевірка, яку
неможливо виконати, звітується окремим станом «не вдалося перевірити», а не
пропускається тихо.

## Ліцензія

MIT
