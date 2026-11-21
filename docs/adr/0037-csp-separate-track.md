# ADR-0037: CSP — окремим треком разом з механізмом пікселів і аналітики

Status: accepted 2026-10-05
Decided by: owner
Spec: `docs/superpowers/specs/2026-10-05-industry-standards-design.md` § «Тема 4»

## Context
Базові заголовки безпеки вже є: `buildSecurityHeaders` у ядрі. Повноцінного CSP немає. Для суворого CSP магазин потребує каналу для сторонніх скриптів, а такого механізму в платформі немає. Інлайн-скрипт у `__root.tsx` теж заважає. Router вміє nonce, але зв'язки middleware → `getRouter()` Start не дає.

## Decision
- CSP винесено в окремий трек разом з механізмом інтеграції типових пікселів і аналітики.
- Передумови: санітизація HTML (ADR-0035), прибрати інлайн-скрипт у `src/routes/__root.tsx`, продуктове рішення про канал для сторонніх скриптів.
- Порядок для треку: nonce через `ssr.nonce` і спайк зв'язки; спершу Report-Only з ендпоінтом `/api/csp-report`; суворий режим — за вибором магазину.
- До цього діють лише базові заголовки.

## Why
- Без каналу для сторонніх скриптів суворий CSP зламає піксели й аналітику магазину (`docs/superpowers/specs/2026-10-05-industry-standards-design.md` § «Заголовки безпеки»).
- У dev CSP вимкнено через HMR; кеш HTML на CDN знецінює nonce (`docs/superpowers/specs/2026-10-05-industry-standards-design.md` § «Заголовки безпеки»).
- Запис у дорожній карті: `docs/tasks/platform-roadmap.md` § «🔴 Відкриті борги (консолідовано; що не тут — закрито або поглинуто треками».

## Rejected
- У джерелі не записано

## Consequences
- Не додавай ad-hoc `Content-Security-Policy` до закінчення цього треку. Єдиний CSP у коді — `frame-ancestors` (`packages/simplycms/src/server-guard/security-headers.ts`).
- Ендпоінт `/api/csp-report` стане свідомим винятком у CSRF. Вебхуки платіжних систем теж.
- Стан на 2026-11-21: у коді ще немає (повного CSP і `ssr.nonce` у `packages/simplycms/src` не знайдено; інлайн-скрипт лишається в `src/routes/__root.tsx`).
