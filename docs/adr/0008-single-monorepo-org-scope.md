# ADR-0008: Один монорепо; GitHub-організація `simplyCMS`, npm-scope `@simplycms`

Status: accepted 2026-07-31
Decided by: owner
Spec: `docs/superpowers/specs/2026-07-30-platform-architecture-design.md` §4.1

## Context
Раніше ядро мало окремий репозиторій із git-subtree-дзеркалом.
Дзеркало існувало, бо репозиторій-застосунок був водночас шаблоном магазину.
Пакети публікувались під scope `@simplysoftua` через вимогу GitHub Packages «scope = власник».
З переходом на npmjs ця вимога зникла.

## Decision
Платформа живе в одному монорепо в організації GitHub `simplyCMS`.
Пакети публікуються на npmjs під scope `@simplycms` (ядро — unscoped `simplycms`).
Окремого core-репозиторію й subtree-синхронізації немає.

## Why
- Магазини не форкають наш репозиторій, тож дві копії ядра не потрібні (`docs/superpowers/specs/2026-07-30-platform-architecture-design.md` § «4.1. Репозиторії, організація, неймінг (доповнення 2026-07-31»).
- Продуктовий неймінг кращий за корпоративний `simplySOFTua` (vendure-ecommerce, medusajs, payloadcms) (`docs/superpowers/specs/2026-07-30-platform-architecture-design.md` § «4.1. Репозиторії, організація, неймінг (доповнення 2026-07-31»).
- Перейменування — механічний codemod, виконаний 2026-07-31 на 384 файли, поки споживачів нуль (`docs/superpowers/specs/2026-07-30-platform-architecture-design.md` § «4.1. Репозиторії, організація, неймінг (доповнення 2026-07-31»).
- Код: `git remote` — `github.com/simplyCMS/simplyCMS`; `packages/simplycms/package.json`.
- Згадки `@simplysoftua` лишились лише в історії: `CHANGELOG.md` § «Прибрано».

## Rejected
- Окремий core-репозиторій із git-subtree — виведено з експлуатації; причина — він потрібен був лише поки застосунок був шаблоном (`docs/superpowers/specs/2026-07-30-platform-architecture-design.md` § «4.1. Репозиторії, організація, неймінг (доповнення 2026-07-31»).
- Scope `@simplysoftua` — корпоративний неймінг гірший за продуктовий.

## Consequences
Усі пакети й тікети — в одному репозиторії.
Назви пакетів у реєстрі: `simplycms`, `@simplycms/cli`, `@simplycms/theme-solarstore`, `@simplycms/plugin-faq`, `create-simplycms-store` (ADR-0023).
Не можна повертати scope `@simplysoftua` чи окремий репозиторій ядра.
Спека називає apps/dev-store референс-магазином; у репо роль хоста виконує корінь, а `apps/www` — лендінг.
