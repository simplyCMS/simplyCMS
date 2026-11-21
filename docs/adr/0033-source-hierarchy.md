# ADR-0033: Ієрархія джерел AGENTS.md → канон → скіли → код; Copilot-артефакти видалено

Status: accepted 2026-10-04
Decided by: owner
Spec: `AGENTS.md`

## Context
У репо було 8 файлів `.github/instructions/*` (~950 рядків) на `applyTo:`-глобах. Це механізм Copilot. Claude Code їх автоматично не вантажить. Зміст розійшовся з каноном. Copilot у роботі не використовується.

## Decision
- Порядок джерел: `AGENTS.md` (межі й інваріанти) → `docs/architecture/*` (канон підсистеми) → `.agents/skills/*` (процедура) → код-шар, `orient` і сам код.
- Суперечність між рівнями — дефект: канон править код, або код править канон.
- `CLAUDE.md` = `@AGENTS.md` + лише специфічне для Claude Code.
- Усі Copilot-артефакти видалено: `.github/instructions/*`, інструкції, агенти й промпти Copilot у теці .github.
- `.github/workflows/` і `.github/ISSUE_TEMPLATE/` лишаються.

## Why
- Модель MetaHub дала ту саму ієрархію і прибрала застарілі копії (спека «deps-security-tooling-design», розділ «Тема 8а · Правила й Copilot-артефакти за моделлю MetaHub ✅»; знесено 2026-11-21, текст — `git show 6daa49bc`).
- Рідкісне й довге йде в `docs/` і скіли, щоб файли, що вантажаться в кожну сесію, лишались короткими (спека «deps-security-tooling-design», розділ «Тема 8а · Правила й Copilot-артефакти за моделлю MetaHub ✅»; знесено 2026-11-21, текст — `git show 6daa49bc`).
- Стан у коді: правило записано в `AGENTS.md` § «SimplyCMS»; у `.github` лишились лише `ISSUE_TEMPLATE` і `workflows`.

## Rejected
- Лишити `.github/instructions/*` — Claude Code їх не читає, а зміст застарів.
- Переносити застаріле зі змістом — «не переносити, а видалити».

## Consequences
- Правиш `AGENTS.md`, `CLAUDE.md` чи канон — зберігай ієрархію.
- Поточний стан, прогрес і лічильники в ці файли не потрапляють (`CLAUDE.md`).
- Не відновлюй Copilot-інструкції.
