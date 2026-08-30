# simplycms/schema

Схема БД ядра SimplyCMS у TypeScript: таблиці, енами, індекси й **RLS-політики**
описані на Drizzle ORM. Поруч — закомічений snapshot інтроспекції, що слугує
базою порівняння для наступного діфа міграцій.

> **Типи (B12, частина).** `types.ts` віддає рядки таблиць (`$inferSelect` /
> `$inferInsert`) — це джерело типів для **нового** серверного коду, тобто
> всього, що ходить у БД через `simplycms/db`. Старі джерела
> (`supabase/types.ts` магазину і `src/supabase/database.ts`) заморожені до
> контуру К1′б і обслуговують код, який ще ходить через `supabase-js`.
> Дублювання тут очікуване — не «оптимізуй» його передчасно.

> 🔴 **Контракт id (трек V2-К3, Е0).** 40 таблиць «Категорії A» **не мають**
> `DEFAULT gen_random_uuid()` — ключ передає викликач у кожному INSERT. Не
> повертай `.defaultRandom()` у схему «щоб не падало»: падіння `23502` — це
> й є fail-loud guard. DEFAULT лишається тільки в таблицях Better Auth
> (`users`/`sessions`/`accounts`/`verifications`) і в `orders`. Деталі —
> `.github/instructions/data-access.instructions.md`, розділ «Контракт id».

Шар ядра [SimplyCMS](https://github.com/simplyCMS/simplyCMS) — відкритої
e-commerce CMS на TanStack Start + Supabase. Окремим пакетом він більше не
постачається: усе ядро приходить одним npm-пакетом `simplycms`, а магазин
створюється скаффолдером `pnpm create simplycms-store`.

## Встановлення

```bash
pnpm add simplycms
```

Вхід цього шару — субшлях `simplycms/schema`.

Peer-залежність — `drizzle-orm@^0.45.0`, і з 2026-08-24 вона
**обовʼязкова**: рантайм магазину реально працює на Drizzle (`simplycms/db`
→ `withActor`, лоадери вітрини). Опційною вона була, поки drizzle потребував
лише тулінг схеми; шаблон магазину несе її явним рядком `dependencies`.
Peer, а не dependency ядра — щоб у дереві магазину була ОДНА копія
(`entityKind`-перевірки drizzle ламаються від двох).

## Що всередині

| Subpath                       | Що дає                                                           |
| ----------------------------- | ---------------------------------------------------------------- |
| `simplycms/schema`           | `pgTable`-описи таблиць ядра, `pgEnum`-и та `pgPolicy`-описи RLS |
| `simplycms/schema/relations` | `relations(...)` між таблицями — для реляційних запитів Drizzle  |

Енами: `appRole`, `discountType`, `discountTargetType`, `discountGroupOperator`,
`propertyType`, `stockStatus`, `shippingMethodType`, `shippingCalculationType`.

Ідентичність — таблиці Better Auth (`users`/`sessions`/`accounts`/`verifications`,
`src/schema/auth.ts`) у схемі `public` з uuid-PK; метадані медіа — `src/schema/media.ts`.
Обидва файли **реекспортуються** зі `schema.ts` — саме так drizzle-kit їх бачить
(він збирає сутності з експортів файлу, перелічених у `config.schema`).
Схеми GoTrue `auth.users` у моделі v2 немає: FK шести доменних таблиць дивляться
на `public.users`.

RLS — **ядро**, а не суцільне покриття: політики лише на user-scoped таблицях,
у initplan-формі `(select app.current_user_id())`; адмінські й «публічне читання»
політики не існують — їхню роботу роблять ролі БД і гранти. Причини й наслідки —
у шапці `schema.ts`.

## Приклад

RLS живе в самій схемі, тож політики читаються як дані — на цьому тримається
поведінковий гейт `test:schema` (`test-harness/pg/__tests__/`):

```ts
import { is } from 'drizzle-orm';
import { PgTable, getTableConfig } from 'drizzle-orm/pg-core';
import * as schema from 'simplycms/schema';

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

`drizzle/` — це **не** канон. Комітяться обидві теки: перша тримає журнал і
snapshot-и (база наступного діфа), друга — `../../migrations/` — застосовний
SQL. Нумерація в них своя в кожної: drizzle рахує власний журнал від нуля, а
канон починається з `0000_prelude.sql`, якого drizzle не породжував і не
бачить. Команди репозиторію: `db:pull` (інтроспекція) · `db:diff <name>`
(SQL міграції) · `test:schema` (накат канону на харнес + парність
політик і грантів + поведінкова матриця RLS).

- Між `db:diff` і накатом — **обовʼязкове людське ревʼю SQL**: drizzle-kit не
  розпізнає перейменувань (видасть `DROP COLUMN` + `ADD COLUMN`) і не діфить
  ролі, гранти та функції.
- 🔴 `db:migrate` виведено з експлуатації (B2/B13): Supabase CLI виходить із
  тулчейна, а числові префікси канону він не приймає.
- `drizzle-kit` запускається з cwd = тека цього пакета, а `schema`/`out` у конфізі
  мусять лишатися **відносними**: 0.31 у `generate` склеює `./${out}` і на
  абсолютному шляху падає з `ENOENT`.
- `DATABASE_URL` — **session pooler**; прямий `db.<ref>.supabase.co` резолвиться
  лише в IPv6 і на CI недоступний.
- 🔴 `db:pull` після B13 — інструмент розвідки, а не джерело правди: жива БД
  живе на СТАРОМУ стеку, а `schema.ts` уже описує модель v2. Накат `pull`
  поверх схеми затер би реекспорти `./auth`/`./media`, RLS-ядро й B7-поля.
- `drizzle-orm@1.0.0-beta` свідомо відхилено: у ній змінені layout теки міграцій і
  семантика `pull --init`.

У репозиторії поруч лежить `seed-migrations/` — SQL початкового насіву схеми для
підняття БД з нуля (у npm-tarball не потрапляє).

Tarball пакета везе теку `migrations/` — **канон** застосовного SQL ядра
(baseline `0000_prelude` → `0003_seed` плюс усе, що додав `db:diff`). Це
джерело для `simplycms db:diff` у магазині: команда порівнює
`supabase/migrations/` магазину з `node_modules/simplycms/migrations/` і
докопіює нові міграції ядра. Копію для скаффолдера тримає `pnpm
template:sync` під parity-тестом. Деталі — [`../../migrations/README.md`](../../migrations/README.md).

## Ліцензія

MIT
