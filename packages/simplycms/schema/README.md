# `@simplycms/schema`

Пакет тримає дві **різні** сутності:

| Тека | Що це |
|------|-------|
| `src/` + `drizzle/` | **Drizzle-baseline** — схема БД (таблиці, енами, індекси, RLS) у TypeScript + snapshot інтроспекції |
| `seed-migrations/` | Історична референсна копія SQL для початкового насіву (див. нижче) |

---

## Drizzle-baseline (spec §9)

### Версії — pinned exact

`drizzle-orm@0.45.2`, `drizzle-kit@0.31.10`, `pg@8.22.0` (кореневий `package.json`).

🔴 **v1-beta (`1.0.0-beta.*`) свідомо відхилено для Фази 0**: у ній змінені layout
теки міграцій і семантика `pull --init`. Перехід — окремим завданням.

### Розкладка

```
packages/simplycms/schema/
├── drizzle.config.ts               # dialect/schema/out, schemaFilter: ['public']
├── src/
│   ├── schema.ts                   # ЗГЕНЕРОВАНИЙ pull-ом + ручні правки (нижче)
│   ├── relations.ts                # ЗГЕНЕРОВАНИЙ pull-ом
│   ├── auth-users.ts               # ручний: ціль FK на auth.users
│   └── __tests__/
│       ├── rls-parity.test.ts      # blocking-gate RLS (spec D6)
│       └── fixtures/rls-policies.json
├── drizzle/                        # ← `out`: МЕТА + snapshots + staging SQL Drizzle
│   ├── 0000_familiar_devos.sql     # reference-SQL інтроспекції (закоментований)
│   └── meta/{_journal.json,0000_snapshot.json}
└── scripts/dump-rls.mjs            # оновлення фікстури RLS
```

🔴 `drizzle/` — це **не** `supabase/migrations/`. Подвійна бухгалтерія навмисна:
Drizzle тримає свій журнал і snapshot тут, а застосовний SQL у форматі Supabase CLI
(`<YYYYMMDDHHmmss>_<slug>.sql`) кладеться в `supabase/migrations/` адаптером
`pnpm db:diff` (Task 13).

### Команди

```bash
pnpm db:pull        # інтроспекція живої БД → drizzle/ (schema.ts, relations.ts, snapshot)
pnpm db:dump-rls    # оновити фікстуру RLS (лише select із pg_policies)
```

🔴 `drizzle-kit` запускається з **cwd = тека цього пакета** (root-скрипти роблять це
через `pnpm --filter @simplycms/schema`). Шляхи `schema`/`out` у конфізі мусять
лишатися відносними: `generate` у drizzle-kit 0.31 склеює `./${out}` і на
абсолютному шляху падає з `ENOENT`.

🔴 `.env.local` конфіг вантажить сам (drizzle-kit читає лише `.env`). `DATABASE_URL` —
**session pooler** (`aws-1-…pooler.supabase.com:5432`); прямий `db.<ref>.supabase.co`
резолвиться тільки в IPv6 і на CI/деві недоступний.

### Крок після `pull` (обов'язковий)

`drizzle-kit pull` пише `schema.ts`/`relations.ts` у **`out`** (тобто в `drizzle/`).
Їх треба перенести в `src/`, snapshot і reference-SQL лишаються в `drizzle/`:

```bash
pnpm db:pull
mv packages/simplycms/schema/drizzle/{schema.ts,relations.ts} packages/simplycms/schema/src/
```

### Ручні правки поверх `pull` (баги drizzle-kit 0.31)

Після кожного `pull` їх треба відтворити — інакше впаде parity-тест або нуль-diff:

1. **RLS-вирази.** Інтроспекція лишає `using`/`withCheck` лише в першої політики
   таблиці. Постраждали **53 із 93** політик — і в `schema.ts`, і в
   `drizzle/meta/0000_snapshot.json`, і в reference-SQL. Відновлюються з фікстури
   `src/__tests__/fixtures/rls-policies.json` (джерело правди — `pg_policies`).
2. **`auth.users`.** Поза `schemaFilter: ['public']`, тому не емітиться, а FK на неї
   лишаються «висячими». Опис — у `src/auth-users.ts`, **без реекспорту** зі
   `schema.ts` (інакше kit згенерує `CREATE TABLE "auth"."users"`).
3. **`idx_product_prices_unique`.** Вираз індексу з `COALESCE(a, b)` інтроспекція
   ріже по комі й обриває рядковий літерал. Виправлено на
   `COALESCE(modification_id, '00000000-…-000000000000'::uuid)`; у snapshot запис
   індексу нормалізовано під серіалізацію Drizzle (opclass `uuid_ops` — дефолтний
   для `uuid`, тому нічого семантично не втрачено).

### RLS parity — blocking gate

`src/__tests__/rls-parity.test.ts` звіряє **93 кортежі**
`(table, policyname, cmd, permissive, roles, qual, with_check)` **в обидва боки**:
фікстура ↔ `schema.ts` (читається через `getTableConfig`, SQL-вирази серіалізуються
`PgDialect`). Нормалізація виразів — lowercase + колапс пробілів, тому зміна
предиката політики тест **не** пройде. Плюс звіряється множина RLS-enabled таблиць
(**40**).

Оновлення фікстури після навмисної зміни політик у БД:

```bash
pnpm db:dump-rls   # → src/__tests__/fixtures/rls-policies.json
```

### Нуль-diff інваріант

`pnpm --filter @simplycms/schema run db:generate` на незміненій схемі мусить давати
`No schema changes, nothing to migrate` і **не** створювати файлів. Якщо створив —
baseline розійшовся з БД, і це треба лагодити, а не комітити.

### Виняток щодо розміру файлів

`src/schema.ts` (~1000 рядків) і `src/relations.ts` (~420) — машинно згенеровані;
ліміт 150 рядків на них не поширюється.

---

## `seed-migrations/` (історична референсна копія)

SQL початкового насіву схеми. Використовується, коли новий сайт піднімає БД з нуля.

```bash
cp packages/simplycms/schema/seed-migrations/*.sql supabase/migrations/
pnpm db:migrate
pnpm db:generate-types
```

- Файли **read-only** для сайту — не редагуйте їх напряму
- Власні міграції сайт кладе в `supabase/migrations/` поруч
- Після зміни схеми завжди запускайте `pnpm db:generate-types`
