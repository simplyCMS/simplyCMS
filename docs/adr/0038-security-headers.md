# ADR-0038: Захисні заголовки HTTP має одне джерело `buildSecurityHeaders` у ядрі

Status: proposed
Decided by: owner
Spec: `docs/superpowers/specs/2026-10-05-industry-standards-design.md` § «Тема 4»

## Context
На 2026-10-05 захисні заголовки були лише на роздачі медіа (`storage/serve.ts`). SSR-сторінки віддавались без них.
Статика `/assets` іде через sirv у `server.mjs` повз Start. Тому middleware Start не покриває всі відповіді.
Пізніше Р27 (2026-10-12) додав базовий фіксований перелік без конфігу магазину
(спека «pilot-readiness-design», розділ «Рішення після аудиту 2026-10-12 (Р15–Р32»; знесено 2026-11-21, текст — `git show 6daa49bc`).
Це ADR описує налаштовуваний варіант зі спеки industry-standards.

## Decision
Функція ядра `buildSecurityHeaders(config, { isHttps, pathname })` у `simplycms/runtime` — єдине джерело
заголовків. Її викликають request middleware у `start.ts` і `setHeaders` sirv.
HSTS ставиться лише за довіреного `x-forwarded-proto=https`, `max-age=15552000`, без `includeSubDomains` і `preload`.
Магазин налаштовує заголовки полем `security` у `simplycms.config.ts`.

## Why
- SSR-сторінки й статика зараз без заголовків (`docs/superpowers/specs/2026-10-05-industry-standards-design.md` § «Заголовки безпеки»).
- Одне джерело для двох шляхів відповіді — middleware і sirv (`docs/superpowers/specs/2026-10-05-industry-standards-design.md` § «Заголовки безпеки»).
- HSTS незворотний на строк дії, тому без `includeSubDomains`/`preload` (`docs/superpowers/specs/2026-10-05-industry-standards-design.md` § «Заголовки безпеки»).

## Rejected
- CSP разом із заголовками — CSP іде окремим треком разом із каналом пікселів і аналітики
  (`docs/superpowers/specs/2026-10-05-industry-standards-design.md` § «Заголовки безпеки»).

## Consequences
- Стан на 2026-11-21: `buildSecurityHeaders` і поля `security` у коді немає (`git grep buildSecurityHeaders` — 0 збігів).
  Є базовий перелік Р27 без конфігу: `SECURITY_HEADERS` і `HSTS_HEADER` з `max-age=31536000`
  (`packages/simplycms/src/server-guard/security-headers.ts`), копія для sirv — `packages/cli/host/server-headers.mjs`.
  Прийняти це ADR — замінити фіксований перелік налаштовуваним і змінити `max-age` HSTS.
- Статус `proposed`: власник затвердив напрям у спеці, але рішення ще не стало треком.
- `X-Frame-Options: DENY` для `/admin*` і `/auth*`, `SAMEORIGIN` для вітрини; `payment` у
  `Permissions-Policy` не чіпати — Google Pay (`docs/superpowers/specs/2026-10-05-industry-standards-design.md` § «Заголовки безпеки»).
