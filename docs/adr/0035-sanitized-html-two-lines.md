# ADR-0035: HTML-контент — рядок, санітизований двома рубежами; у DOM лише `<RichHtml>`

Status: accepted 2026-10-05
Decided by: owner
Spec: `docs/architecture/data-layer.md` §9; `docs/architecture/ui.md` §3

## Context
Відгук покупця записувався без очищення і виводився сирим HTML у вітрині й адмінці. Будь-хто, хто викликав серверну функцію напряму, міг зберегти довільний HTML. Це збережений XSS проти відвідувачів і проти власника в адмінці. Санітизатора в репо не було.

## Decision
- Контент зберігається як HTML-рядок, не як Tiptap JSON.
- Server-only модуль `sanitizeRichHtml(html, profile)` на `sanitize-html` (без DOM) має профілі `review` і `content`. Білі списки збігаються з виводом редакторів.
- Рубіж 1 — запис: відправлення відгуку і поля з розміткою в `defineAdminResource`.
- Рубіж 2 — віддача: лоадери вітрини й операції читання `admin-server` чистять ці поля перед клієнтом.
- `sanitizeRichHtml` повертає брендований `SanitizedHtml`. У DOM розмітку вставляє лише `<RichHtml html={…}/>`.
- ESLint-правило забороняє `dangerouslySetInnerHTML` поза `RichHtml` і явним списком винятків із причиною.

## Why
- Один рубіж не покриває старі дані, сід і легасі-адмінку; другий рубіж чистить їх на віддачі (спека «deps-security-tooling-design», розділ «Тема 9 · Санітизація HTML ✅ (2026-10-05»; знесено 2026-11-21, текст — `git show a967ab1e`).
- Брендований тип не дає темі відрендерити неочищене (спека «deps-security-tooling-design», розділ «Тема 9 · Санітизація HTML ✅ (2026-10-05»; знесено 2026-11-21, текст — `git show a967ab1e`).
- Тест `tests/rich-html-roundtrip.test.ts` вимагає, щоб HTML справжніх редакторів проходив санітизацію без змін (`docs/architecture/ui.md` § «3. Rich text (Tiptap v3»).
- Стан у коді: `packages/simplycms/src/ui/rich-html.tsx`, `packages/simplycms/src/contracts/sanitized-html.ts`, `eslint-rules/no-dangerously-set-inner-html.mjs`.

## Rejected
- Тільки очищення на записі — не чистить старі дані й сід.
- Tiptap JSON замість HTML-рядка — канон каже «не як Tiptap JSON», причини в джерелі не записано (`docs/architecture/ui.md` § «3. Rich text (Tiptap v3»).

## Consequences
- Нова можливість редактора (тег, атрибут, клас) = правка набору розширень і профілю в `simplycms/sanitize`. Без другого форматування зникає на вітрині.
- Виняток для `dangerouslySetInnerHTML` потребує запису в `eslint.config.mjs` з причиною.
