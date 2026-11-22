# ADR-0022: Порти екосистеми бекенд-нейтральні; теми отримують порти через `simplycms/theme-sdk`

Status: accepted 2026-08-19
Decided by: owner
Spec: `docs/superpowers/specs/2026-08-19-backend-contract-v2-design.md` §2

## Context
Бекенд-контракт V2 прибирає PostgREST і Supabase. Порт плагіна `usePluginTable` мав PostgREST-форму.
Тема тоді законно імпортувала клієнт БД `@simplycms/supabase` (Р10). Маркетплейс через це маркував картку
теми як «прямий доступ до даних». Контракт портів заморожує перший сторонній пакет маркетплейсу.

## Decision
Порти плагінів і тем не залежать від бекенду. Порт плагіна працює через serverFn і колекції.
Тема отримує порти через фасад-субшлях `simplycms/theme-sdk`, а не клієнт БД.

## Why
- «Це остання можливість змінити контракти дешево — до першого стороннього пакета»
  (`docs/superpowers/specs/2026-08-19-backend-contract-v2-design.md` § «2. Зафіксовані рішення (B1–B12»).
- Порти для тем приземлюються як `simplycms/theme-sdk` — амендмент 2026-08-20, ПК5
  (спека «package-consolidation-design», розділ «2. Рішення (ПК1–ПК12»; знесено 2026-11-21, текст — `git show a967ab1e`).
- Без порту тема мала легальний прямий доступ до БД; B9 цей доступ знімає
  (`docs/superpowers/specs/2026-08-18-marketplace-platform-design.md` § «8.2. Чесність щодо тем (найгостріше місце»).

## Rejected
- Лишити `usePluginTable` у PostgREST-формі — PostgREST зникає разом із Supabase (B1).
- Лишити темам прямий імпорт клієнта БД — маркетплейс не зміг би чесно описати межу теми.

## Consequences
- Порт плагіна вже бекенд-нейтральний: `PluginTablePort` у `packages/simplycms/src/plugin-sdk/usePluginTable.ts`.
- Клієнта БД тема вже не має: `@supabase/*` заборонено ратчетом (`docs/architecture/themes.md` § «1. Роль і межі»).
- Стан на 2026-11-21: `simplycms/theme-sdk` у коді ще немає (`packages/simplycms/src/` без теки `theme-sdk`).
  Його створює К5 (спека «package-consolidation-design», розділ «3. Цільова структура»; знесено 2026-11-21, текст — `git show a967ab1e`).
- Межа довіри теми (eslint-зона, як у плагіна) — окреме рішення разом із `theme-sdk`, не недогляд
  (`docs/architecture/themes.md` § «8. Чого свідомо немає (v1»).
