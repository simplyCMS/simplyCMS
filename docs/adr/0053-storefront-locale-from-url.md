# ADR-0053: Мова вітрини — лише з першого сегмента URL

Status: accepted 2026-10-14
Decided by: owner
Spec: `docs/superpowers/specs/2026-10-14-content-multilingual-design.md` §7

## Context
Одна адреса мусить віддавати одну мову. Інакше кеш і індекс пошукача змішують мови. OpenCart 3 бере мову з сесії, cookie й `Accept-Language`. Через це там кілька шляхів до однієї сутності.

## Decision
- Мову вітрини визначає лише перший сегмент шляху, через `resolveRequestLocale`.
- Cookie, сесія, `localStorage` і `Accept-Language` мову вітрини не вибирають.
- Заголовок `Vary: Accept-Language` не ставиться.
- Мова адмінки й листів береться з профілю, а не з URL.

## Why
- Рішення власника: `docs/superpowers/specs/2026-10-14-content-multilingual-design.md` § «7. Уточнення власника 2026-10-14 (друга сесія». Вади OpenCart 3 описано в `docs/superpowers/specs/2026-10-14-content-multilingual-design.md` § «Після верифікації Opus».
- Функція не приймає заголовків за типом: `packages/simplycms/src/domain/request-locale.ts`.
- Лінт забороняє літерал `accept-language` у зоні вітрини: `eslint.config.mjs`.
- Нема `Vary`: `docs/superpowers/specs/2026-10-14-content-multilingual-design.md` § «5. Технічні рішення архітектора (2026-10-14; власник бачить їх списком і може переглянути».

## Rejected
- Вибір мови через cookie чи `localStorage` — прямо виключений (`docs/superpowers/specs/2026-10-14-content-multilingual-design.md` § «7. Уточнення власника 2026-10-14 (друга сесія»).
- Мова з `Accept-Language` (поведінка OpenCart 3) — вада, описана в `docs/superpowers/specs/2026-10-14-content-multilingual-design.md` § «Після верифікації Opus».

## Consequences
- Адресу вітрини кешують без розрізнення за заголовками.
- Перемикач мови на вітрині — це посилання на іншу адресу, не збережений вибір.
- Не додавати автовизначення мови за браузером: це свідомо заборонено лінтом.
- Інтерсептор нормалізації й клієнт використовують ту саму `resolveRequestLocale`. Другого парсера немає.
