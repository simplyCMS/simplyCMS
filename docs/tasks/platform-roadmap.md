# Роадмап платформи SimplyCMS

> Джерела правди (спеки; тут — лише стратегічний напрям):
> [`2026-07-30-platform-architecture-design.md`](../superpowers/specs/2026-07-30-platform-architecture-design.md)
> (база; читати з ревізіями D3′/D4′ і D7′) ·
> [`2026-08-19-backend-contract-v2-design.md`](../superpowers/specs/2026-08-19-backend-contract-v2-design.md)
> (бекенд v2, ревізія D7) ·
> [`2026-08-18-marketplace-platform-design.md`](../superpowers/specs/2026-08-18-marketplace-platform-design.md)
> (маркетплейс) ·
> [`2026-08-19-cloud-platform-design.md`](../superpowers/specs/2026-08-19-cloud-platform-design.md)
> (хмара) ·
> [`2026-08-17-theme-contract-v3-views-design.md`](../superpowers/specs/2026-08-17-theme-contract-v3-views-design.md)
> (theme views — виконано) ·
> [`2026-08-20-package-consolidation-design.md`](../superpowers/specs/2026-08-20-package-consolidation-design.md)
> (консолідація пакетів 26→5 + доставка скілів — трек К0) ·
> [`2026-08-25-storefront-search-design.md`](../superpowers/specs/2026-08-25-storefront-search-design.md)
> (пошук вітрини й адмінки; доказова база —
> [дослідження](../superpowers/research/2026-08-25-storefront-search-engine.md)).
> Детальний імплементаційний план кожного треку пишеться перед стартом і посилається
> з його issue. Стану (прогресу, черги, боргів, історії виконаного) цей файл не тримає —
> див. «Де стан» нижче; історія — у git цього файлу.

---

## Де стан

Стан проєкту живе в GitHub, а не в документах:

- **Віхи = релізи** — [усі віхи](https://github.com/simplyCMS/simplyCMS/milestones): що входить у
  наступний реліз і що вже виконано в закритих.
- **Дефекти** — [issues з міткою `bug`](https://github.com/simplyCMS/simplyCMS/issues?q=is%3Aissue+is%3Aopen+label%3Abug).
- **Поліпшення поза віхою** — [issues з міткою `idea`](https://github.com/simplyCMS/simplyCMS/issues?q=is%3Aissue+is%3Aopen+label%3Aidea).
- **Відкриті хвости треків К2/К4/К5/К6** — issues без віхи з префіксом `К<N>:` у назві.
- Що змінилось у кожному релізі — [`CHANGELOG.md`](../../CHANGELOG.md).

Статус одним запитом — скіл `track` agent-kit («який статус?», «що блокує?»).
Уроки, які коштували найдорожче, — [`docs/development/lessons.md`](../development/lessons.md).

---

## Напрям

### 🎯 Стратегічний напрям (затверджено власником 2026-08-19)

🔴 **У проєкту немає клієнтів і реальних магазинів — зворотна сумісність
не підтримується, різати по живому безпечно і правильно** (розширення D5
на весь стек). Затверджена звʼязка з трьох треків, у цьому порядку
залежностей:

1. **Бекенд-контракт v2** (ревізія D7): сервер-first дані (браузер не
   ходить у БД; PostgREST/GoTrue/supabase-js зникають), Better Auth,
   storage-порт, чистий Postgres як контракт (Supabase — один із
   підтримуваних провайдерів), «стек швидкості» вітрини (full-page кеш +
   CDN + фасети) і agent-readiness (JSON-LD скрізь, AI-robots) — усе одна
   реструктуризація. Іде ПЕРЕД відкриттям подач маркетплейсу (заморозка
   контрактів портів першим стороннім пакетом). Трек A (theme views)
   встиг завершитись ДО V2 — його контракту V2 не чіпає: переписуються
   контейнери/лоадери (шар даних), view-model-и і view-и лишаються.
2. **Маркетплейс**: модель поставки ухвалена (П1–П5: платформа і
   безкоштовні пакети — npmjs; платні — власний сервер доставки, лише
   scoped); реєстр `simplycms/marketplace` + вітрина на simplycms.dev.
3. **Хмара** (`simplycms/platform`, окремий приватний репо): Dokploy,
   1 магазин = контейнер застосунку + Postgres; кабінет
   Account→Organization→Store; код тенанта — «без git за замовчуванням +
   Підключити GitHub»; хмара ПЕРЕД платним тіром маркетплейсу.
