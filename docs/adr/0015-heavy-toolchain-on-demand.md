# ADR-0015: Важкий тулчейн (jsdom, Playwright) — on-demand з інструкцією, не в шаблоні магазину

Status: accepted 2026-08-18
Decided by: owner
Spec: `docs/architecture/cli.md` § «theme:conformance»

## Context
Команда `theme:conformance` рендерить view у DOM і потребує `jsdom`. Скіл редизайну потребує Playwright і браузер. Обидва пакети важкі. Магазин потребує їх рідко, а ставить кожен новий магазин.

## Decision
Шаблон магазину не містить `jsdom` і `playwright`. Команда чи скрипт перевіряє, чи пакет резолвиться. Якщо ні, вона друкує точну команду встановлення й виходить з кодом 1. Для jsdom команда — `pnpm add -D jsdom`. Мовчазних обходів немає.

## Why
- Рішення власника 2026-08-18: `docs/architecture/cli.md`.
- Те саме для Playwright: «Playwright у шаблоні: НЕ додається» і команда `pnpm add -D playwright && pnpm exec playwright install chromium` (`docs/tasks/redesign-from-reference-skill.md` § «1.2 Вирішені відкриті питання ресерчу (§6) — дефолти цієї задачі»).
- Підказка в коді: `JSDOM_HINT = 'pnpm add -D jsdom'` (`packages/cli/src/theme-conformance-dom.mjs`).
- Шаблон не має залежності: `git grep jsdom` у `packages/create-simplycms-store` знаходить лише тести теми (`@vitest-environment jsdom`), не `package.json`.

## Rejected
- Важкий браузер у кожен магазин — у джерелі названо причину «важкий браузер у кожен магазин — ні» (`docs/tasks/redesign-from-reference-skill.md` § «1.2 Вирішені відкриті питання ресерчу (§6) — дефолти цієї задачі»).
- Мовчазний обхід без пакета — заборонено: команда виходить кодом 1 (`docs/architecture/cli.md`).

## Consequences
Свіжий магазин легкий. Перший запуск `theme:conformance` потребує одного ручного кроку. Не додавай `jsdom` чи Playwright у `devDependencies` шаблону для зручності. Нові важкі інструменти йдуть тим самим шляхом: перевірка, точна команда, код 1.
