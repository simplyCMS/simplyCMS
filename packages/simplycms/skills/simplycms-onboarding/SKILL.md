---
name: simplycms-onboarding
description: Use when the user wants to create, set up or deploy a SimplyCMS store from scratch — "create a store", "deploy my store", "set up Dokploy", "bring the store live", "onboard me", "what is the next step" in a fresh or half-configured store — or the same in Ukrainian ("створи магазин", "розгорни магазин", "налаштуй Dokploy", "виведи магазин у прод", "що далі робити"). Walks from an empty folder to a live store with its own Postgres, S3 bucket, SMTP, migrations on start and a verified smoke; every mutation is preview, consent, apply.
---

# Онбординг магазину — від порожньої теки до живого магазину

Запускай агента з **кореня магазину** і не роби `cd` у підтеки перед викликом CLI:
скрипти скіла і `node_modules/.bin/simplycms` рахують шляхи від кореня.

## Старт: стан, а не здогадка

```bash
pnpm simplycms status --json
```

Читай `stage` (`not-created` | `not-configured` | `local` | `deployed`), `next.skill`, `checks`, `unknown`.
`not-configured` — магазин створено, але обов'язкових env-ключів ще немає: це вхідна точка
свіжого скаффолда (далі — «Прийом вимог»), а не поломка для діагностики.
`next.skill` іншого скіла — передай керування йому. Незрозумілий `unknown` — спершу
`pnpm simplycms doctor`. Продовження після перерви — зі стану: `.simplycms/deploy.json`
(читається лише через `pnpm simplycms deploy:record get`; код 3 = запису ще немає) і `status`.

## Ланцюжок етапів

1. **Прийом вимог** — `references/requirements.md`: назва, домен, сервер Dokploy і ключ API,
   DNS, SMTP, бакет S3; усе одним списком на згоду власника.
2. **Створення** — `pnpm create simplycms-store <тека>`, `git init`, перший коміт.
3. **Локальний запуск** — `references/local.md`: Postgres 17, `db:apply`, `pnpm owner:invite`,
   перевірка вітрини й адмінки.
4. **Dokploy** — `references/dokploy.md`: власний Postgres, застосунок, змінні, домен і TLS;
   бакет — `references/garage-bucket.md`; пошта — `references/smtp.md`; бекапи —
   `references/backups-restore.md`.
5. **Перший деплой і перевірка** — `pnpm simplycms doctor --online --production`, потім
   `pnpm simplycms smoke https://<домен>` (`/api/health` з `build`, ключові маршрути).
6. **Запрошення власника в проді** — лише ПІСЛЯ SMTP, `references/dokploy.md`.
7. **Тренувальне відновлення** бекапу БД і тому — `references/backups-restore.md`.
8. **Підсумок власнику** — `references/summary.md`.

## Правило кожної мутації: прев'ю → згода → застосувати

Правило діє на БУДЬ-ЯКУ мутацію, чим би вона не робилась: скриптом скіла, MCP Dokploy, UI
панелі чи командою на сервері. Скрипти скіла без `--confirm` нічого не змінюють: друкують
прев'ю (що буде створено чи змінено, лише імена ключів) і виходять з кодом 3. Для мутації
поза скриптами (збірка, autoDeploy, бекапи, деплой) прев'ю пишеш сам. Покажи прев'ю власнику,
дочекайся явного «так» і лише тоді застосовуй. Згода на один крок не діє на наступний.

## Скрипти (`.claude/skills/simplycms-onboarding/scripts/`)

| Скрипт | Що робить |
| --- | --- |
| `secrets-file.mjs init <шлях>` | файл секретів `0600` з порожніми ключами, шлях у `.gitignore` |
| `secrets-file.mjs gen <шлях> KEY` | випадкове значення в порожній ключ (напр. `BETTER_AUTH_SECRET`) |
| `dokploy.mjs provision --name N --domain D --bucket B --server ID` | проєкт, власний Postgres 17 (запущений), застосунок, домен на сервері застосунків; пише `deploy.json` |
| `dokploy-env.mjs set KEY --from-secrets <шлях> --confirm` | один ключ у env застосунку; значення читається з файлу секретів і не друкується |
| `dokploy-env.mjs keys` / `unset KEY` | імена змінних / видалення одного ключа |
| `prod-run.mjs --server ID скрипт.sh` | разовий скрипт на сервері без SSH; завдання видаляється завжди |

Облікові дані Dokploy (`DOKPLOY_URL`, `DOKPLOY_API_KEY`) — у файлі секретів
(`.simplycms/secrets.env` за замовчуванням, прапор `--secrets`), не в `~/.claude.json`.

## Секрети

- Значення секретів не друкуй, не проси в чаті, не клади аргументом команди й у коміт.
  Власник вносить їх сам у файл секретів; далі лише `dokploy-env set KEY --from-secrets`.
- Що потрапило у вивід або розмову — вважай скомпрометованим і ротуй.
- `application-saveEnvironment` через MCP не використовуй: він замінює весь блок і світить значення.

## Межі — чого скіл НЕ робить

- Не наповнює каталог: товари, категорії, банери — в адмінці `/admin`, власником.
- Не змінює DNS без згоди власника; Cloudflare — «DNS only», запис робить власник або з його явного дозволу.
- Не створює сервіси Dokploy без згоди (прев'ю → `--confirm`) і не створює БД магазину в чужому кластері.
- Не видаляє: сервіси, томи, бакети, бекапи — лише за прямою вимогою власника.
- Не пушить у чужі репозиторії й не публікує нічого без слова власника.
- Не ділить Postgres між магазинами: **кожен магазин — власний екземпляр Postgres**.

## Коли скіл не підходить

Оновити платформу — `simplycms-update`; щось зламалося — `simplycms-diagnose`;
редизайн — `simplycms-redesign`.
