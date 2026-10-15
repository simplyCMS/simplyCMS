---
name: simplycms-diagnose
description: Use when something in a SimplyCMS store does not work — "the store is down", "deploy failed", "container does not start", "images return 503", "emails are not sent", "migration error", "why is it broken", "diagnose" — or the same in Ukrainian ("магазин не працює", "деплой впав", "контейнер не стартує", "картинки не вантажаться", "листи не йдуть", "помилка міграції", "чому не працює", "знайди причину"). Reads status and doctor, then Dokploy logs, matches the symptom against the pitfalls register and fixes it with consent; also holds the restore-from-backup procedure.
---

# Діагностика — від симптому до причини

Запускай агента з **кореня магазину** і не роби `cd` у підтеки перед CLI. Спершу читай,
потім мутуй: діагностика за замовчуванням read-only.

## Старт: стан, а не здогадка

```bash
pnpm simplycms status --json
pnpm simplycms doctor --online --production
```

`status` дає `stage`, `checks` з `error`/`warn`/`unknown` і `next.skill`. `doctor --online`
додає стан БД (журнал міграцій, власник, профіль, недоставлені листи) з `DATABASE_URL`. Код
виходу: `0` гаразд, `3` є що робити, `1` помилка. Живий магазин — ще й
`pnpm simplycms smoke https://<домен>` (`/api/health` з `build`, маршрути, редирект `/admin`).

## Ланцюжок етапів

1. **Стан** — `status` і `doctor --online --production`; запиши, які саме перевірки червоні.
2. **Симптом → пастка** — `references/pitfalls.md`: знайди точне повідомлення помилки;
   збіг дає причину й дію. Нема збігу — крок 3.
3. **Логи Dokploy** — `references/logs.md`: логи застосунку й журнал збірки; читай, нічого не змінюючи.
4. **Гіпотеза й доказ** — назви причину та покажи рядок логу чи вивід команди, що її доводить.
5. **Виправлення** — лише після прев'ю й згоди. Правка коду — звичайний цикл
   «коміт → autoDeploy → `smoke`»; інфраструктура — `simplycms-onboarding` (`simplycms-onboarding/references/dokploy.md`).
6. **Перевірка** — `status`, `doctor --online --production`, `smoke`; зафіксуй, що було, що зроблено, що перевірено.

Відновлення з бекапу (втрачені чи пошкоджені дані) — `references/restore.md`.

## Правило кожної мутації: прев'ю → згода → застосувати

Правило діє на БУДЬ-ЯКУ мутацію, чим би вона не робилась: командою CLI, скриптом, MCP Dokploy
(`application-redeploy`, `settings-reloadTraefik`), UI панелі чи командою на сервері. Покажи
власнику, що саме зміниться і що це зачепить (простій, дані), дочекайся явного «так» і лише
тоді застосовуй. Згода на один крок не діє на наступний. Читання логів і статусу — не мутація.

## Секрети

Значення секретів не друкуй, не проси в чаті й не клади аргументом команди. У логах і виводі
шукай імена ключів, не значення; що потрапило у вивід — вважай скомпрометованим і ротуй.
Змінні Dokploy міняй лише скриптами `simplycms-onboarding` (`dokploy-env set KEY --from-secrets <файл>`).

## Межі — чого скіл НЕ робить

- Не змінює дані магазину: не править рядки БД руками й не «лагодить» накочену міграцію.
- Не видаляє томи, бази, бакети й бекапи; відновлення — лише на тимчасову базу, поверх живої не пише.
- Не змінює DNS і не перезапускає прод без згоди власника.
- Не вигадує причину: без доказу з логу чи виводу команди це гіпотеза, і так її й називай.
- Не оновлює платформу — це `simplycms-update`; не будує інфраструктуру з нуля — `simplycms-onboarding`.
