# @simplycms/schema

Схема БД ядра SimplyCMS у TypeScript: таблиці, енами, індекси й **RLS-політики**
описані на Drizzle ORM. Поруч — закомічений snapshot інтроспекції, що слугує
базою порівняння для наступного діфа міграцій.

Пакет ядра [SimplyCMS](https://github.com/simplyCMS/simplyCMS) — відкритої
e-commerce CMS на TanStack Start + Supabase. Окремо ставити зазвичай не треба:
магазин створюється скаффолдером `pnpm create simplycms-store`, який приводить
усе ядро разом.

## Встановлення

```bash
pnpm add @simplycms/schema
```

Peer-залежність — `drizzle-orm@^0.45.0`.

## Що всередині

| Subpath                       | Що дає                                                           |
| ----------------------------- | ---------------------------------------------------------------- |
| `@simplycms/schema`           | `pgTable`-описи таблиць ядра, `pgEnum`-и та `pgPolicy`-описи RLS |
| `@simplycms/schema/relations` | `relations(...)` між таблицями — для реляційних запитів Drizzle  |

Енами: `appRole`, `discountType`, `discountTargetType`, `discountGroupOperator`,
`propertyType`, `stockStatus`, `shippingMethodType`, `shippingCalculationType`.

`auth.users` описана окремо (`src/auth-users.ts`) і **навмисно не реекспортується**
зі `schema.ts`: інакше drizzle-kit вважатиме її «своєю» і згенерує
`CREATE TABLE "auth"."users"`. Як імпорт вона лишається валідною ціллю `foreignKey(...)`.

## Приклад

RLS живе в самій схемі, тож політики читаються як дані — на цьому тримається
parity-гейт `src/__tests__/rls-parity.test.ts`:

```ts
import { is } from 'drizzle-orm';
import { PgTable, getTableConfig } from 'drizzle-orm/pg-core';
import * as schema from '@simplycms/schema';

for (const value of Object.values(schema)) {
  if (!is(value, PgTable)) continue;
  const config = getTableConfig(value);
  console.log(
    config.name,
    config.policies.map((policy) => policy.name),
  );
}
```

## 🔴 Робочий процес міграцій

`drizzle/` — це **не** `supabase/migrations/`. Комітяться обидві теки: перша тримає
журнал і snapshot-и (база наступного діфа), друга — застосовний SQL для
`supabase db push`. Команди репозиторію: `db:pull` (інтроспекція) · `db:diff <name>`
(SQL міграції) · `db:migrate` (push + типи) · `db:dump-rls` (фікстура політик).

- Між `db:diff` і `db:migrate` — **обовʼязкове людське ревʼю SQL**: drizzle-kit не
  розпізнає перейменувань (видасть `DROP COLUMN` + `ADD COLUMN`) і не діфить
  RLS-політики та тригери.
- `drizzle-kit` запускається з cwd = тека цього пакета, а `schema`/`out` у конфізі
  мусять лишатися **відносними**: 0.31 у `generate` склеює `./${out}` і на
  абсолютному шляху падає з `ENOENT`.
- `DATABASE_URL` — **session pooler**; прямий `db.<ref>.supabase.co` резолвиться
  лише в IPv6 і на CI недоступний.
- Після кожного `pull` треба відтворити ручні правки поверх багів drizzle-kit 0.31
  (RLS-вирази з фікстури `pg_policies`, `auth.users`, вираз `idx_product_prices_unique`) —
  інакше падає parity-гейт, який звіряє політики з живою БД повнопольово й в обидва боки.
- `drizzle-orm@1.0.0-beta` свідомо відхилено: у ній змінені layout теки міграцій і
  семантика `pull --init`.

У репозиторії поруч лежить `seed-migrations/` — SQL початкового насіву схеми для
підняття БД з нуля (у npm-tarball не потрапляє).

Tarball пакета везе теку `migrations/` — байт-копію кореневих
`supabase/migrations/` монорепо, синхронізовану `pnpm template:sync` і
закріплену parity-тестом. Це джерело для `simplycms db:diff` у магазині:
команда порівнює `supabase/migrations/` магазину з
`node_modules/@simplycms/schema/migrations/` і докопіює нові міграції ядра.

## Ліцензія

MIT
