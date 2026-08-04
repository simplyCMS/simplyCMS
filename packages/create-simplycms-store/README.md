# create-simplycms-store

Скаффолдер магазину SimplyCMS: створює новий git-репозиторій магазину зі
справжніх опублікованих пакетів `@simplycms/*`.

```bash
pnpm create simplycms-store my-shop
```

Позиційний аргумент — **тека призначення** (може бути шляхом, напр.
`../shops/my-shop`); імʼя npm-пакета магазину — її `basename`.

## Прапорці

| Прапорець         | Значення                                                     |
| ----------------- | ------------------------------------------------------------ |
| `--yes`, `-y`     | Без промптів (також вмикається при `CI=true` і в не-TTY)      |
| `--supabase-url`  | URL проєкту Supabase → у `.env.local`                         |
| `--supabase-key`  | Publishable-ключ Supabase → у `.env.local`                    |
| `--no-install`    | Не встановлювати залежності                                   |
| `--no-git`        | Не робити `git init` + перший коміт                           |

`.env.local` пишеться лише коли задані **обидва** значення Supabase.
🔴 `service_role`-ключ у файли не потрапляє ніколи — він потрібен лише як
змінна середовища для `pnpm owner:invite` у згенерованому магазині.

## Що всередині

| Файл              | Призначення                                              |
| ----------------- | -------------------------------------------------------- |
| `src/args.mjs`    | `resolveOptions(argv, env, isTTY)` — розбір прапорців     |
| `src/scaffold.mjs`| `scaffold()` / `renderTemplate()` — розгортання шаблону   |
| `src/steps.mjs`   | Промпти, `git init`, встановлення, наступні кроки         |
| `src/index.mjs`   | Оркестрація й валідація імені магазину                    |
| `template/`       | Шаблон магазину (генерат — `pnpm template:sync`)          |

Дизайн — [`docs/superpowers/specs/2026-08-03-create-store-owner-bootstrap-design.md`](../../docs/superpowers/specs/2026-08-03-create-store-owner-bootstrap-design.md).
