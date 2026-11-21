# ADR-0029: Адмінка — client-side SPA на колекціях TanStack DB з реєстром винятків

Status: accepted 2026-08-29
Decided by: owner
Spec: `docs/architecture/rendering-and-routing.md` §1; `docs/architecture/data-layer.md` §3

## Context
Адмінці потрібні оптимістичні мутації і живі запити. Колекції TanStack DB працюють лише на клієнті. Вітрина рендериться на сервері (SSR). Тому один дескриптор даних для адмінки й вітрини неможливий.

## Decision
- Адмінка лишається client-side SPA: роут має `ssr: false` (К3-1).
- Дефолт: сутність читає `useLiveQuery` з колекції, пише `collection.insert/update/delete` (К3-2).
- Сутності, що свідомо лишаються server-first, заносяться в закомічений реєстр винятків. Виняток без запису в реєстрі — дефект (К3-2).
- Спільного дескриптора даних для адмінки й вітрини немає (К3-4).

## Why
- Джерело бібліотеки: «TanStack DB collections are client-side only. SSR is not implemented» (спека «v2-k3-admin-server-layer-design», розділ «2. Рішення (К3-1 … К3-12»; знесено 2026-11-21, текст — `git show a967ab1e`).
- Тому колекції неможливі на вітрині, а спільний дескриптор для К2 і К3 не робиться (спека «v2-k3-admin-server-layer-design», розділ «2. Рішення (К3-1 … К3-12»; знесено 2026-11-21, текст — `git show a967ab1e`).
- Реєстр не дає мовчазних відхилень від колекцій (спека «v2-k3-admin-server-layer-design», розділ «2. Рішення (К3-1 … К3-12»; знесено 2026-11-21, текст — `git show a967ab1e`).
- Стан у коді: `ssr: false` у `packages/simplycms/routes/admin/admin.tsx`; колекції в `packages/simplycms/src/admin-data/collections`.

## Rejected
- Адмінка на SSR — колекції TanStack DB її не підтримують.
- Спільний дескриптор даних для адмінки й вітрини — вітрина SSR, колекції клієнтські.
- Повний перехід без винятків — кандидати на виняток: `PriceValidator` (обчислення), `Dashboard` (агрегати), `system_settings` (один рядок).

## Consequences
- Колекції можна додавати лише в зону адмінки. Вітрина читає через лоадери.
- Новий виняток з колекцій — запис у реєстрі, а не мовчазне відхилення.
- Не «вирівнюй» вітрину під колекції: вона SSR свідомо.
