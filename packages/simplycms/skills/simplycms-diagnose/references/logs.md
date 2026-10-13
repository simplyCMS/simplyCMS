# Логи Dokploy

Облікові дані Dokploy (`DOKPLOY_URL`, `DOKPLOY_API_KEY`) лежать у файлі секретів магазину
(`.simplycms/secrets.env`); ідентифікатори ресурсів — `pnpm simplycms deploy:record get`
(`dokploy.applicationId`, `dokploy.postgresId`, `domain`; код `3` — запису ще немає). Читання логів —
не мутація, але вміст логу може містити дані: показуй власнику лише рядки, що доводять причину.

## Інструменти (MCP Dokploy, лише читання)

| Що дивитись | Інструмент |
| --- | --- |
| Лог роботи застосунку (старт, `console.error`, міграції) | `application-readLogs` (`applicationId`) |
| Журнали збірок і деплоїв застосунку | `deployment-all` → `deployment-readLogs` |
| Стан контейнерів | `docker-getContainersByAppNameMatch` |
| Лог Postgres магазину | `postgres-readLogs` (`postgresId`) |
| Змінні застосунку — лише імена | `node .claude/skills/simplycms-onboarding/scripts/dokploy-env.mjs keys` |

Без MCP — той самий лог у UI Dokploy (застосунок → Logs / Deployments). Скрипти для логів у
скіл не додано свідомо: MCP вже вміє це без копій логіки.

## Що шукати

- Старт: рядок помилки `[simplycms/env]` чи `[simplycms/migrate]` (напр. `[simplycms/migrate] Змінено вже накочені…`);
  імені класу помилки в логу немає, шукай за текстом повідомлення.
  Це перша частина `references/pitfalls.md`.
- `media driver open failed` / `media lookup failed` — сховище недоступне (503 / 500 на `/media`).
- Збірка: де зупинилась (`Installing railpack`, `pnpm install`, `vite build`).
- Версія живого: `GET https://<домен>/api/health` → поле `build`; розбіжність з очікуваним
  комітом означає, що деплой не дійшов.

Секрет у логу — інцидент: скажи власнику, не цитуй значення, запропонуй ротацію.
