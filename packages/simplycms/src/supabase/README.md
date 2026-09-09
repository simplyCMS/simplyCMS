# simplycms/supabase

Supabase-клієнти ядра SimplyCMS (browser / server / anon), DI-провайдер
`SupabaseProvider`, резолв env-ключів і **baseline типів БД** core-схеми.

> 🔴 **Статус у треку V2 (0.4.1): шар ЖИВИЙ і заморожений до контуру К3.**
> Вітрина (SSR-лоадери, воронка, auth) повністю перевела дані на
> `simplycms/db` (`withActor` над Drizzle) і `simplycms/auth` (Better Auth,
> К1′б — GoTrue знесено). Цей шар лишається живим **лише для адмінки**
> (`packages/simplycms/src/admin/**`), яку переписує трек К3. Дуальність
> типів (`database.ts` тут + `simplycms/schema/types` із Drizzle для НОВОГО
> коду) — **свідома, а не борг до прибирання**: генерат магазину
> `supabase/types.ts` уже знесений (0.4.1) разом із `db:generate-types`;
> `database.ts` тут зникне разом з останнім `useSupabaseClient()`. Рішення
> B12 — спека бекенд-контракту v2, амендмент 2026-08-23.

Шар ядра [SimplyCMS](https://github.com/simplyCMS/simplyCMS) — відкритої
e-commerce CMS на TanStack Start + Supabase. Окремим пакетом він більше не
постачається: усе ядро приходить одним npm-пакетом `simplycms`, а магазин
створюється скаффолдером `pnpm create simplycms-store`.

## Встановлення

```bash
pnpm add simplycms
```

Вхід цього шару — субшлях `simplycms/supabase`.

## Що всередині

| Subpath              | Вміст |
|----------------------|-------|
| `.`                  | типи БД (`Database`, `Json`, `Tables`, `TablesInsert`, `TablesUpdate`, `Enums`, `CompositeTypes`), `Constants`, `resolveSupabaseKeys` |
| `./keys`             | `resolveSupabaseKeys` + типи `SupabaseEnv` / `SupabaseKeys` (publishable-ключ, anon — legacy-fallback) |
| `./browser-client`   | `createBrowserSupabase`, `getSupabaseBrowserClient`, тип `SupabaseClient` |
| `./server-client`    | `createServerSupabase` — cookies через TanStack Start |
| `./anon-client`      | `createAnonSupabaseClient` — публічні кешовані запити |
| `./SupabaseProvider` | `SupabaseProvider`, `useSupabaseClient` |

Фабрики й хук параметризовані типом БД (generic лишився для сумісності):
дефолт і єдине джерело типів тепер — baseline core-схеми з цього пакета,
власного generat-`Database` магазину більше немає (0.4.1).

## Приклад

```ts
// адмін-сторінка ядра — серверний контекст: читаються request-cookies
import { createServerSupabase } from 'simplycms/supabase/server-client';

const client = createServerSupabase(cookieHeader);
await client.from('products').select('*');

// у React-дереві клієнт беруть з DI-контексту, а не з глобального singleton:
const supabase = useSupabaseClient();
```

🔴 Магазин більше НЕ звужує клієнти generic-параметром до власного
`Database` — типа `StoreDatabase` (host `engine.shared.ts`) не існує з
0.4.1: клієнти типізуються дефолтним baseline-ом цього пакета
(`Database` нижче).

## 🔴 Кореневий барель свідомо не віддає клієнти

`server-client` тягне `@tanstack/react-start/server`, тож його попадання в барель
затягувало б серверний код у клієнтський бандл. Клієнти імпортуються **лише**
підшляхами (`simplycms/supabase/browser-client` тощо).

## 🔴 Генератор і `supabase/types.ts` магазину видалені (0.4.1)

`src/supabase/database.ts` — **baseline** core-схеми: закомічений снапшот,
проти якого типізується адмінка ядра. Таблиці плагінів у baseline не входять
ніколи. `pnpm db:generate-types`/`pnpm types:baseline` та генерат магазину
`supabase/types.ts` знесені разом із Supabase-контуром вітрини; після
core-міграції `database.ts` більше НЕ регенерується автоматично — файл
заморожений до треку К3. Руками не редагується (він у `.prettierignore`).

## Ліцензія

MIT
