# ADR-0025: Скіли магазину — у пакеті ядра, прямі симлінки; окремого репо скілів немає

Status: accepted 2026-08-20
Decided by: owner
Spec: `docs/architecture/cli.md` §3.3

## Context
Агентні скіли (онбординг, діагностика, оновлення, редизайн) їдуть у кожен магазин. Їм потрібна версія, що збігається з версією ядра. Окремий канал доставки створив би друге джерело правди.

## Decision
Скіли живуть у пакеті `simplycms`: `packages/simplycms/skills/<name>/`. Магазин отримує їх прямими симлінками `.agents/skills/<name>` і `.claude/skills/<name>` на `node_modules/simplycms/skills/<name>`. Копій і ланцюжка симлінків немає. Окремий репо `simplyCMS/agent-skills` не створюється. Канал skills.sh не використовується. Монорепо дотримується того самого правила.

## Why
- Рішення ПК8–ПК10: спека «package-consolidation-design», розділ «2. Рішення (ПК1–ПК12» (знесено 2026-11-21, текст — `git show 6daa49bc`).
- Причина відхилення каналу: друге джерело правди, розсинхрон версії скіла з ядром, третій канал доставки поза П1–П5: спека «package-consolidation-design», розділ «Додаток A. Довідка: жива проба skills.sh (2026-08-19» (знесено 2026-11-21, текст — `git show 6daa49bc`).
- Монорепо: `.agents/skills/*` і `.claude/skills/*` — симлінки на `../../packages/simplycms/skills/<name>`.
- Тест стереже форму: `tests/monorepo-skill-links.test.ts` (коміт f293b292).
- Канон: `docs/architecture/repository-layout.md` § «Структура репозиторію».

## Rejected
- Окремий репо `simplyCMS/agent-skills` і канал skills.sh — друге джерело правди й розсинхрон версій (ПК10, `:207-211`).
- Ланцюг .claude/skills → .agents/skills → пакет або копія — застаріють мовчки (`tests/monorepo-skill-links.test.ts`).

## Consequences
Оновлення скіла — це `pnpm update simplycms`, без дрейфу. Правиш оригінал у пакеті, не симлінк. Не додавай копії скілів у `.agents/skills`. Власна зміна скіла в магазині — це eject: заміна симлінка копією, без підтримки.
