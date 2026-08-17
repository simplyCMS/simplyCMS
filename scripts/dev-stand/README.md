# Demo-датасет діагностичного стенда

Канонічні сторінки вітрини (насамперед картка товару) мають що рендерити:
фото, описи, властивості, кілька секцій. Сід пілота цього дати не може —
він навмисно мінімальний (Gate B асертить точні назви), тож demo-датасет
живе окремо і накочується **поверх** нього.

## Що це за файли

| Файл | Роль |
|------|------|
| `table-specs.mjs` | 🔴 Allowlist таблиць і колонок — єдине джерело правди про те, що взагалі може потрапити у вивід |
| `sql-literal.mjs` | Екранування літералів (рядки, NULL, числа, boolean, jsonb, дати) — чистий модуль |
| `generate-seed.mjs` | Чиста функція `{ tableName: rows[] } → SQL` — саме вона під тестом `tests/dev-stand-seed.test.ts` |
| `dump-demo-data.mjs` | Тонкий IO-шар: `pg` → allowlist → `seed-demo.sql` |
| `seed-demo.sql` | **Gitignored** артефакт: чужі каталожні дані не комітяться в OSS-репо |

Множина таблиць — лише каталог: `sections`, `section_properties`,
`property_options`, `section_property_assignments`, `products`,
`product_modifications`, `product_property_values`, `product_prices`.
Зображення окремої таблиці не мають — вони в jsonb `products.images`
(публічні URL-и Storage; локальне дзеркалення — опція, не вимога).
Персональних даних немає за побудовою: `profiles`, `orders`, `order_items`,
`user_*`, `service_requests` в allowlist-і відсутні, і додавати їх туди не
можна. `created_at`/`updated_at` теж поза allowlist-ом — на стенді доречніші
дефолти БД.

## Крок 1 — зняти дамп (дія власника)

Потрібен рядок підключення до живої БД:
**Supabase → Project Settings → Database → Connection string → Session
pooler** (саме session, не transaction: скрипт тримає одне зʼєднання й читає
кілька таблиць поспіль). Не забудь `?sslmode=require`.

```bash
# .env.local у корені репо
DATABASE_URL=postgresql://postgres.<ref>:<pass>@<host>:6543/postgres?sslmode=require

node scripts/dev-stand/dump-demo-data.mjs
# → scripts/dev-stand/seed-demo.sql
```

Без `DATABASE_URL` скрипт падає з інструкцією і кодом 1 — це і є чесна
деградація: скрипт, формат і тест готові, реальний дамп робить власник.
Читання — тільки `select`, жодних записів у джерело.

## Крок 2 — накотити на локальний стек

```bash
supabase start                       # локальний стек накатує міграції + supabase/seed.sql
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
  -f scripts/dev-stand/seed-demo.sql
```

Сід ідемпотентний: кожен блок — `insert … on conflict (<унікальний ключ>) do
update set …`, тож повторний накат не дублює рядків і не падає. `price_type_id`
береться підзапитом із **локального** `price_types` — id з клауд-БД у стеку не
існує.

🔴 Розрахунок на **чистий** локальний стек після сіду пілота: слаги пілота
(`pilot-seed-*`) з каталогом не перетинаються. Якщо в стеку вже є рядок з тим
самим слагом, але іншим `id`, `do update` залишить старий `id` — дочірні
рядки (ціни, властивості) впадуть на FK. Лікується `supabase db reset`.

## Межі

- `supabase/seed.sql` і `scripts/pilot-pack/**` **не чіпаються** — це контракт
  гейтів пілота (Gate B асертить точні назви товарів із сіду). Demo-датасет
  живе повністю окремим файлом і окремою командою.
- Стенд до клауд-БД напряму **не підключається**: `bootstrapThemes` і адмінка
  писали б у живий магазин. Єдиний канал — односторонній дамп на читання.
- Окремої `package.json`-команди немає свідомо: зняття дампу — разова дія
  власника з реальними креденшелами, а не крок штатного воркфлоу.
