# ADR-0030: Ключ `id` генерує викликач (Категорія A); код іде перед DDL

Status: accepted 2026-08-29
Decided by: owner
Spec: `docs/architecture/data-layer.md` §5

## Context
Адмінка додає рядки оптимістично. Оптимістичний рядок лягає в клієнтську колекцію під ключем, відомим до відповіді сервера. Якщо сервер поверне інший `id`, колекція матиме два різні рядки замість одного. Це не розсинхрон полів, а дубль у мапі.

## Decision
- У таблицях «Категорії A» немає `DEFAULT gen_random_uuid()`. Кожна вставка передає `id` явно.
- Критерій категорії: чи клієнт (або серверний шлях вітрини) створює рядок. Для `UPDATE` і `DELETE` клієнтський `id` не потрібен.
- Категорія B лишає DEFAULT: чотири таблиці Better Auth (`users`, `sessions`, `accounts`, `verifications`).
- `orders` переведено в Категорію A.
- Порядок робіт: спершу код передає `id`, потім `ALTER COLUMN id DROP DEFAULT`.
- `NOT NULL` лишається: забутий `id` падає `23502`.

## Why
- Серверна генерація структурно несумісна з оптимізмом (`docs/superpowers/specs/2026-08-29-v2-k3-admin-server-layer-design.md` § «2. Рішення (К3-1 … К3-12»).
- Better Auth делегує генерацію `id` базі, тож зняття DEFAULT зламало б signUp і OAuth (`docs/superpowers/specs/2026-08-29-v2-k3-admin-server-layer-design.md` § «2. Рішення (К3-1 … К3-12»).
- `orders` став пасткою fail-silent після того, як адмінка отримала його в керування (`docs/superpowers/specs/2026-08-29-v2-k3-admin-server-layer-design.md` § «2. Рішення (К3-1 … К3-12»).
- Контракт у каноні: `docs/architecture/data-layer.md` § «5. Контракт id: ключ генерує ВИКЛИКАЧ, не БД».
- Стан у коді: `defaultRandom()` лишився лише в `packages/simplycms/src/schema/auth.ts`; поза auth-схемою його немає.

## Rejected
- Серверний DEFAULT `gen_random_uuid()` — дає два різні рядки в одній колекції.
- Пакет `uuid` — обгортка заради обгортки; замість неї `crypto.randomUUID()` з fail-loud перевіркою secure context.

## Consequences
- Кожен новий шлях вставки передає `id`. Вставка без `id` у `packages/simplycms/src/**` червонить гейт.
- Адмінка на `http://` не-localhost не працює: `crypto.randomUUID()` потребує secure context.
- Не повертай `.defaultRandom()` у схему «щоб не падало» (`packages/simplycms/src/schema/README.md` § «simplycms/schema»). Падіння `23502` — це свідомий fail-loud.
