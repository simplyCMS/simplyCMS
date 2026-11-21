# ADR-0002: MetaHub-adoption скасовано; SimplyCMS — самостійна OpenCart-подібна платформа

Status: accepted 2026-07-30
Decided by: owner
Spec: `docs/superpowers/specs/2026-07-30-platform-architecture-design.md` §1, §2

## Context
MetaHub — споріднений проєкт власника на тому самому стеку.
Розглядали варіант прийняти SimplyCMS як частину MetaHub.
Власник вирішив інакше: SimplyCMS розвивається як окрема платформа.
Спека напрямку описує її як e-commerce платформу за моделлю OpenCart.

## Decision
SimplyCMS не входить до MetaHub і не залежить від нього.
Платформа має власний монорепо, власні пакети й власну дорожню карту.
З MetaHub беремо лише досвід і патерни, а не код чи структуру проєкту.

## Why
- Рішення D9: «MetaHub-adoption скасовано; SimplyCMS — самостійна платформа» (`docs/superpowers/specs/2026-07-30-platform-architecture-design.md` § «2. Зафіксовані рішення власника»).
- Мета: «e-commerce платформа, подібна за моделлю до OpenCart» (`docs/superpowers/specs/2026-07-30-platform-architecture-design.md` § «1. Мета»).
- Досвід MetaHub зібрано як запозичені уроки, а не як залежність (`docs/superpowers/specs/2026-08-19-backend-contract-v2-design.md` § «8. Запозичений досвід MetaHub (2026-08-20»).
- Причину скасування adoption у спеці не записано.

## Rejected
- Adoption у MetaHub — скасовано власником; причину в джерелі не записано.

## Consequences
Усі рішення платформи приймаються в цьому репо за його спеками.
Патерн із MetaHub можна взяти, але кожен такий патерн проходить через спеку цього репо.
Не можна додавати залежність від коду MetaHub чи посилатися на його доки як на джерело правди.
