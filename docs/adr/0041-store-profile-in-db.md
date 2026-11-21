# ADR-0041: Профіль магазину — у БД без перезбірки; `seo` прибрано з конфігу; теми й плагіни вшиті в збірку

Status: accepted 2026-10-06
Decided by: owner
Spec: `docs/superpowers/specs/2026-10-06-store-profile-system-design.md` § «Частина A»

## Context
Назва магазину була зашита літералом у `head` роутів вітрини. Поля `seo.*` з `simplycms.config.ts` потрапляли в `ConfigProvider`, але вітрина їх не читала. Власник пілотного магазину мав редагувати назву, контакти, логотип і соцмережі без перезбірки. Теми й плагіни вже вшиваються в збірку, а адмінка лише вмикає їх.

## Decision
1. Назва, SEO, контакти, логотип і соцмережі редагуються в адмінці й живуть у `system_settings['store_profile']` (С-1).
2. Мова й валюта лишаються в коді магазину, у `simplycms.config.ts` (С-2).
3. Поля `seo.{siteName,defaultTitle,titleTemplate,defaultDescription}` видалено з контракту `defineConfig`. Профіль — єдине джерело правди.
4. Кнопки «Видалити плагін» немає. Вимкнути — перемикачем. Прибрати зовсім — конфігом магазину й перезбіркою, як теми (С-3).

## Why
- Рішення власника С-1 і С-3: `docs/superpowers/specs/2026-10-06-store-profile-system-design.md` § «Рішення власника».
- Теми й плагіни вшиваються в збірку; `bootstrapThemes`/`bootstrapPlugins` відновлюють видалений рядок плагіна: `docs/superpowers/specs/2026-10-06-store-profile-system-design.md` § «Факти, з яких виходить дизайн (розвідка 2026-10-06,».
- Ключ `store_profile` і правило видалення полів `seo`: `docs/superpowers/specs/2026-10-06-store-profile-system-design.md` § «Дані».
- У коді ключ `STORE_PROFILE_KEY = 'store_profile'`: `packages/simplycms/src/contracts/store-profile.ts`. Сід: `packages/simplycms/src/migrate/bootstrap.ts`.
- Конфіг не має поля `seo`: `packages/simplycms/src/runtime/config.ts`.

## Rejected
- Мова й валюта в БД — залишено в коді (С-2).
- Поділ К3-Е6б на дві частини — власник вирішив виконати К3-Е6б цілим (С-4, `docs/superpowers/specs/2026-10-06-store-profile-system-design.md` § «Рішення власника»).
- Інші варіанти — у джерелі не записано.

## Consequences
- Власник змінює профіль без деплою. Вітрина читає його з кешем на процес.
- Кеш діє на один процес. Багатоінстанс-магазин — поза межами цього рішення (там само, рядок 80).
- Видалити плагін або тему можна лише конфігом і перезбіркою. Не додавай кнопку видалення в адмінку.
- Не повертай `seo.*` у конфіг: це друге джерело правди.
