# ADR-0013: Тема перевизначає лише презентацію п'яти сторінок (`views`); conformance — жорсткий гейт без рантайм-fallback

Status: accepted 2026-08-17
Supersedes: ADR-0004
Decided by: owner
Spec: `docs/architecture/themes.md` §2.1

## Context
Магазин має виглядати інакше, ніж ядро. Повне володіння сторінкою робить магазин форком ядра. Тоді SEO, дані й оновлення платформи ламаються. Попереднє рішення ADR-0004 забороняло темі перевизначати сторінки взагалі.

## Decision
Тема може постачати опційні `views` для п'яти сторінок вітрини: `Home`, `Catalog`, `CatalogSection`, `ProductDetail`, `Cart`. Роути, лоадери, server fns, SEO й URL лишаються в ядрі. Canonical view ядра є завжди. Checkout, auth і profile тема не перевизначає. Conformance перевіряє обов'язкові реквізити машинно. Провал дає червоні тести; маркетплейс-індекс такої теми не публікує. Рантайм-fallback на canonical view при невалідному view не робиться.

## Why
- Рішення V1–V3 записані власником 2026-08-17: спека «theme-contract-v3-views-design», розділ «2. Зафіксовані рішення власника (2026-08-17» (знесено 2026-11-21, текст — `git show 6daa49bc`).
- Звужені платформні рішення D3′ і D4′: спека «theme-contract-v3-views-design», розділ «2. Зафіксовані рішення власника (2026-08-17» (знесено 2026-11-21, текст — `git show 6daa49bc`).
- Рантайм-fallback маскував би дефект теми (V3, там же `:38`).
- Тема без `views` валідна цілком: `docs/architecture/themes.md` § «перевизначення view-шару (контракт v3».
- Гейт у коді: команда `simplycms theme:conformance` (`docs/architecture/themes.md` § «1. Роль і межі», `packages/cli/README.md` § «Команди»).

## Rejected
- Повне володіння сторінкою (модель Shopify) — це відкат до форк-моделі (V1).
- Рантайм-fallback на canonical view — маскує дефект теми (V3).
- Checkout, auth, profile у `views` — найвищий ризик конверсії, найменша потреба в диференціації (V2).

## Consequences
Свобода теми обмежена презентацією, і це свідомо. Не додавай темі право на роути, дані чи SEO. Не додавай мовчазний fallback у рантайм. Checkout, auth і profile можуть увійти у `views` лише новим ADR. Заявка `views` без кейса в kit не перевіряється, тому звіт друкує лише прогнані сторінки (`docs/architecture/cli.md`).
