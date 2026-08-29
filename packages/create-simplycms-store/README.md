# create-simplycms-store

Скаффолдер магазину: створює новий git-репозиторій зі справжніх опублікованих
пакета `simplycms` та сателітів — SSR-вітрина з каталогом, кошиком і checkout, адмінка,
профілі, `sitemap.xml`/`robots.txt` і теми приходять версіонованими npm-пакетами,
без форку репозиторію.

CLI проєкту [SimplyCMS](https://github.com/simplyCMS/simplyCMS) — відкритої
e-commerce CMS на TanStack Start + Postgres. Це єдиний пакет, який ставиться
окремо: він приводить усе ядро разом.

## Встановлення

```bash
pnpm create simplycms-store my-shop
```

Позиційний аргумент — **тека призначення** (може бути шляхом, напр.
`../shops/my-shop`); імʼя npm-пакета магазину — її `basename`. Версія
ядра в згенерованому маніфесті = версія самого скаффолдера. Node ≥ 20.

| Прапорець        | Значення                                                 |
| ---------------- | -------------------------------------------------------- |
| `--yes`, `-y`    | Без промптів (також вмикається при `CI=true` і в не-TTY) |
| `--database-url` | DSN Postgres → у `.env.local`                            |
| `--no-install`   | Не встановлювати залежності                              |
| `--no-git`       | Не робити `git init` + перший коміт                      |

`.env.local` пишеться лише коли заданий `--database-url`: разом із ним туди
йдуть згенерований `BETTER_AUTH_SECRET` і `VITE_SITE_URL=http://localhost:3000`
— увесь контракт магазину. Без `--database-url` файл не створюється: магазин
дістає `.env.example` і власник заповнює його сам.

## 🔴 Оновлення магазину, створеного з 0.2.0 / 0.2.1

Скаффолдер розгортає шаблон **один раз**, тож файли магазину не оновлюються
разом із пакетами ядра. У `0.2.2` виправлено дефект у `routes.ts`, через який
магазин, поставлений під pnpm, збирався одним initial-чанком замість ~200 —
мовчки, з успішною збіркою.

Перевірка в теці магазину:

```bash
pnpm build
ls dist/client/assets/*.js | wc -l   # одиниці → вас стосується; ~200 → ні
```

Що змінити в `routes.ts` — у
[CHANGELOG, розділ «Міграція наявних магазинів»](https://github.com/simplyCMS/simplyCMS/blob/main/CHANGELOG.md).

## Що всередині

| Файл               | Призначення                                             |
| ------------------ | ------------------------------------------------------- |
| `src/index.mjs`    | Вхід CLI: оркестрація й валідація імені магазину        |
| `src/args.mjs`     | `resolveOptions(argv, env, isTTY)` — розбір прапорців   |
| `src/scaffold.mjs` | `scaffold()` / `renderTemplate()` — розгортання шаблону |
| `src/steps.mjs`    | Промпти, `git init`, встановлення, наступні кроки       |
| `template/`        | Шаблон магазину (генерат — `pnpm template:sync`)        |

## Приклад

Шлях від порожньої теки до запущеного магазину — те саме, що CLI друкує
в «Наступні кроки»:

```bash
pnpm create simplycms-store my-shop \
  --database-url postgresql://app_runtime:пароль@localhost:5432/postgres --yes
cd my-shop
for f in supabase/migrations/*.sql; do psql "postgresql://<owner>:<pass>@<host>:5432/<db>" -v ON_ERROR_STOP=1 -f "$f"; done
OWNER_EMAIL=you@example.com pnpm run owner:invite
pnpm run dev
```

## 🔴 Застереження

- Магазин налаштований **лише під pnpm 11+**: `pnpm-workspace.yaml` шаблону везе
  `allowBuilds`, без якого install обривається, а `packageManager` прибиває версію.
  npm/yarn ці механізми ігнорують і зберуть магазин у неперевіреній конфігурації.
  У перші 24 години після виходу нової версії ядра install упреться в
  `minimumReleaseAge` — обхід описаний у README згенерованого магазину.
- Auth-налаштувань у Dashboard магазин більше не потребує: вхід і запрошення
  власника працюють на Better Auth поверх самого Postgres, а не на GoTrue.
  Натомість обовʼязкові серверні ключі `.env.local` — `DATABASE_URL` і
  `BETTER_AUTH_SECRET`; без них сервер падає гучно, а не пускає всіх.
- Листів магазин не шле: `owner:invite` друкує одноразове посилання на
  `/auth/invite` у консоль — SMTP налаштовує вже власник.

Дизайн — [спека bootstrap-у власника](https://github.com/simplyCMS/simplyCMS/blob/main/docs/superpowers/specs/2026-08-03-create-store-owner-bootstrap-design.md).

## Ліцензія

MIT
