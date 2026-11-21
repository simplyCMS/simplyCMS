# ADR-0024: Сумісність екосистеми — лише `engines.simplycms`; окремого semver SDK немає

Status: accepted 2026-08-20
Decided by: owner
Spec: `docs/architecture/release-process.md` § «Версії: semver і пререлізи»

## Context
Плагіни й теми залежать від ядра. Можна ввести окремий версійований SDK. Тоді з'явиться друга вісь сумісності. Маркетплейс уже спроєктований на строгий `satisfies()` проти версії ядра.

## Decision
Єдиний контракт сумісності — поле `engines.simplycms` у маніфесті плагіна чи теми (peer на `simplycms`). Окремого semver SDK немає. Версія платформи і є контрактом. Діапазон пише `coreRangeFor(version)`.

## Why
- Рішення ПК6 і причина: друга вісь створила б матрицю «sdk↔ядро»: спека «package-consolidation-design», розділ «2. Рішення (ПК1–ПК12» (знесено 2026-11-21, текст — `git show 6daa49bc`).
- Модель WordPress і OpenCart (там же).
- Діапазон рахує `coreRangeFor`: `packages/simplycms/src/contracts/semver/core-range.ts` і копія `packages/cli/src/core-range.mjs`; правила — `AGENTS.md` § «Архітектурні інваріанти».
- Перевірка в `doctor`: `engines.simplycms` проти ядра, `packages/cli/src/doctor-engines.mjs`.
- Канон: `docs/architecture/release-process.md` § «Версії: semver і пререлізи».

## Rejected
- Окремий semver SDK — друга вісь сумісності з власною матрицею «sdk↔ядро» (ПК6).

## Consequences
Автор плагіна чи теми задає лише `engines.simplycms`. Не вводь окремий номер версії SDK. Зміна, що ламає плагіни, піднімає мажорну версію ядра. Діапазон не пишуть руками: його переписує крок бампу `pnpm release`.
