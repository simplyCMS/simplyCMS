# ADR-0062: Публікація npm — Trusted Publishing (OIDC), без токена

Status: accepted 2026-11-05
Decided by: owner
Spec: `docs/architecture/release-process.md` § «Передумови»

## Context
До 0.15.0 CI публікував довгоживучим токеном npm із «Bypass 2FA». Крадіжка такого токена дає публікацію від імені платформи. Реліз 0.16.0 показав, що npm згортає цю модель: PUT давав `404 Not Found`.

## Decision
- CI публікує без токена. pnpm обмінює OIDC-токен GitHub Actions на короткоживуче право публікації пакета й додає provenance.
- Для кожного з 5 пакетів налаштований trusted publisher на `publish-packages.yml`.
- Секрету `NPM_TOKEN` у репо й воркфлоу немає.
- Першу версію нового пакета публікує власник локально; trusted publisher налаштовується лише для пакета, що вже є в реєстрі.

## Why
- Рішення й причини: `docs/architecture/release-process.md` § «Авторизація: npm Trusted Publishing (з 2026-11-05»; кроки налаштування — `:377-385`.
- Воркфлоу має `id-token: write`: `.github/workflows/publish-packages.yml`. Без нього `npm` повертає 404 (`:41-45`).
- `NPM_TOKEN` і `NODE_AUTH_TOKEN` у `.github` відсутні (`git grep NPM_TOKEN .github` дає 0).
- Страховку тримає `tests/release-prerelease.test.ts` (describe «Trusted Publishing»): `id-token: write`, умова `main`, жодного токена.

## Rejected
- Довгоживучий токен з «Bypass 2FA» — найслабша ланка ланцюга постачання; npm його згортає.

## Consequences
- Токена для крадіжки немає. Provenance підтверджує, що пакет зібрано з цього репо.
- Новий пакет не опублікувати з CI: перша версія — вручну власником (`release-process.md:386-392`).
- Не повертати `NPM_TOKEN`: це свідомо знято.
- Спостереження: `docs/architecture/cli.md` § «1. Роль і межі» ще згадує «чинний NPM_TOKEN» — застаріла фраза.
