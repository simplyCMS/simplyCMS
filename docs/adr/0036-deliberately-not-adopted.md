# ADR-0036: Не беремо React Compiler, changesets, syncpack, t3-env та ін.; Renovate замість Dependabot

Status: accepted 2026-10-05
Decided by: owner
Spec: `AGENTS.md` § «Архітектурні інваріанти»

## Context
Трек «стандарти індустрії» оцінив інструменти й практики. Частина не дає виграшу для платформи. Частина дублює наш власний механізм. Версії шаблону магазину живуть у `package.json.tpl`, який Dependabot не бачить.

## Decision
- Не беремо: React Compiler, changesets, syncpack, `nuqs`, `dinero.js`, `@total-typescript/ts-reset`, `vitest-axe`, окреме стиснення, Storybook, Rust-порт React Compiler, `t3-env`.
- Оновлення залежностей веде Renovate, а не Dependabot.
- Renovate: regex-менеджер для `.tpl` і пілотного оверлею; групи; точні піни лишаються; автомержу немає.
- Умова перегляду React Compiler: довгі списки (200+ рядків), спершу віртуалізація.

## Why
- Замір React Compiler: кількість комітів не змінилась у жодному сценарії. Поріг ≥30 % у двох сценаріях не досягнуто. Ціна: +13,3 % gzip клієнтського JS (`docs/superpowers/specs/2026-10-05-industry-standards-design.md` § «Тема 7 · React Compiler ❌ не беремо (замір, 2026-10-05»).
- Dependabot не бачить `.tpl`, і кожен його PR червонів би через `tests/template-version-parity.test.ts` (`docs/superpowers/specs/2026-10-05-industry-standards-design.md` § «Тема 2 · Renovate + аудит у CI ✅»).
- `pnpm release` з гейтами й синхронною версією 5 пакетів кращий за changesets. Syncpack не читає `.tpl`. Контракт env уже стережеться `simplycms/env` (`docs/superpowers/specs/2026-10-05-industry-standards-design.md` § «Свідомо НЕ беремо (з обґрунтуванням»).
- Стан у коді: конфігу Dependabot немає; `@changesets`, `syncpack`, `t3-env` у `package.json` немає.

## Rejected
- Dependabot — не бачить `.tpl`.
- Усі перелічені в Decision інструменти — причини в Why.

## Consequences
- Реліз лишається рішенням людини: автомержу немає (`AGENTS.md`, розділ «Пакети й реліз»).
- Пакети із записами в `docs/architecture/upstream-workarounds.md` отримують мітку «перевір записи реєстру».
- Стан на 2026-11-21: файла конфігурації Renovate в репо немає (`git ls-files` не показує `renovate.json`). Спека також вимагала від власника встановити GitHub-app.
