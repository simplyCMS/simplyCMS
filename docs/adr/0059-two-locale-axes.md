# ADR-0059: Дві осі мови — `ContentLocale` і `UiLocale`; міст `resolveUiLocale`; власний i18n

Status: accepted 2026-11-04
Decided by: owner
Spec: `docs/superpowers/specs/2026-10-14-multilingual-wave-design.md` §19.2

## Context
Після М1 один тип `Locale = string` описував і мову даних, і мову рядків інтерфейсу. Хук `useLocale()` близько 20 разів подавав мову в ключі кешу даних. Магазин з мовою без пакета інтерфейсу завантажив би дані основною мовою. Це дефект. Також треба було вирішити: власний механізм i18n чи бібліотека.

## Decision
- Дві осі. `ContentLocale` — яку мову даних читати. `UiLocale` — рядки інтерфейсу, формат чисел, дат, цін і множина.
- Типи різні й брендовані. Міст між ними — лише `resolveUiLocale`.
- Ключі кешу й читачі даних беруть лише `ContentLocale`.
- «i18n» означає лише вісь інтерфейсу. Вісь контенту називається «переклади».
- `simplycms/i18n` — власний механізм, а не i18next чи інша бібліотека.

## Why
- Рішення власника: `docs/superpowers/specs/2026-10-14-multilingual-wave-design.md` § «19.1 Навіщо». Вади одного типу — `docs/superpowers/specs/2026-10-14-multilingual-wave-design.md` § «19.1 Навіщо».
- Таблиця двох осей і джерел: `docs/superpowers/specs/2026-10-14-multilingual-wave-design.md` § «19.2 Терміни (канон для коду й документації».
- Критерій заміни зафіксовано наперед (5 пунктів, `docs/superpowers/specs/2026-10-14-multilingual-wave-design.md` § «19.2 Терміни (канон для коду й документації»). Спайки Lingui 6.12.0 і use-intl 4.14.9 не пройшли пункти (3) і (5) (`docs/superpowers/specs/2026-10-14-multilingual-wave-design.md` § «19.2 Терміни (канон для коду й документації»). Paraglide й i18next відпали за документацією.
- Код: `ContentLocale` — `packages/simplycms/src/contracts/content-locale.ts`; міст — `packages/simplycms/src/i18n/ui-locale.ts`.

## Rejected
- Lingui 6.12.0 — не проходить (3) типи трьох рівнів і (5) код: +~60 рядків адаптерів.
- use-intl 4.14.9 — не проходить (3) і (5); `.` у ключі тихо губить 54 ключі-префікси.
- Paraglide 3.1 — глобальна локаль й набір мов у збірці.
- i18next 26.7 — одне глобальне augmentation типів.

## Consequences
- На вітрині `UiLocale` збігається з `ContentLocale` за побудовою. В адмінці й листах — ні.
- Не приводити `as UiLocale` чи `as ContentLocale` поза конструкторами.
- Повертатися до бібліотеки — лише за нової вимоги, наприклад інструментарій PO/XLIFF (`docs/superpowers/specs/2026-10-14-multilingual-wave-design.md` § «19.2 Терміни (канон для коду й документації»).
- Субшлях `simplycms/i18n` не перейменовано: двозначність закривають імена типів і хуків.
