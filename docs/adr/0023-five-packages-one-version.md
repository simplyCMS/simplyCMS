# ADR-0023: Пакети 26 → 5: unscoped `simplycms` і чотири сателіти; тіри — теки під лінт-зонами; одна версія

Status: accepted 2026-08-20
Decided by: owner
Spec: `docs/architecture/repository-layout.md`

## Context
V1 мала 26 пакетів. Вони постійно змінювались разом і множили churn у тих самих файлах. Попередній план V2 без консолідації ще збільшив би кількість пакетів (db, auth, data-pg).

## Decision
- ПК1: у ядро (`simplycms`) вливаються 22 пакети. Окремо лишаються `@simplycms/cli`, `create-simplycms-store`, `@simplycms/theme-solarstore`, `@simplycms/plugin-faq`.
- ПК2: флагман — unscoped `simplycms`, сателіти — під scope `@simplycms/*`.
- ПК3: тір-модель T0–T5 лишається структурою тек `packages/simplycms/src/*`. Напрям імпортів стереже ESLint з негативним контролем.
- ПК11: усі пакети мають одну версію.

## Why
- Рішення ПК1–ПК3 і ПК11: `docs/superpowers/specs/2026-08-20-package-consolidation-design.md` § «2. Рішення (ПК1–ПК12».
- Сателіти лишаються окремими, бо їхня роль і є «бути пакетом»: модель третьої сторони (ПК1, там же `:62`).
- У реєстрі рівно 5 пакетів і одна версія: `AGENTS.md` § «Напрям і пакети» і `AGENTS.md` § «Архітектурні інваріанти».
- Дерево: `packages/` містить `cli`, `create-simplycms-store`, `simplycms`, `simplycms-plugin-faq`, `simplycms-theme-solarstore`.

## Rejected
- Лишити 26 пакетів і додати db, auth, data-pg — збільшило б їх число (контекст у `docs/superpowers/specs/2026-08-20-package-consolidation-design.md` § «1. Мотивація — виміряно кодом, не припущено»).

## Consequences
Специфікатор ядра — субшлях `simplycms/<тека>`, не `simplycms` з кореня зсередини пакета (`AGENTS.md` § «Напрям і пакети»). Не вводь нові публіковані пакети без нового ADR. Не бампай версії пакетів окремо. Кожен реліз збирає всі 5.
