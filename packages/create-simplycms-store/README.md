# create-simplycms-store

Скаффолдер магазину: створює новий git-репозиторій зі справжніх опублікованих
пакета `simplycms` та сателітів — SSR-вітрина з каталогом, кошиком і checkout, адмінка,
профілі, `sitemap.xml`/`robots.txt` і теми приходять версіонованими npm-пакетами,
без форку репозиторію.

CLI проєкту [SimplyCMS](https://github.com/simplyCMS/simplyCMS) — відкритої
e-commerce CMS на TanStack Start + Supabase. Це єдиний пакет, який ставиться
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
| `--supabase-url` | URL проєкту Supabase → у `.env.local`                    |
| `--supabase-key` | Publishable-ключ Supabase → у `.env.local`               |
| `--no-install`   | Не встановлювати залежності                              |
| `--no-git`       | Не робити `git init` + перший коміт                      |

`.env.local` пишеться лише коли задані **обидва** значення Supabase.
🔴 `service_role`-ключ у файли не потрапляє ніколи — він потрібен лише як змінна
середовища для `owner:invite`.

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
  --supabase-url https://<ref>.supabase.co \
  --supabase-key sb_publishable_… --yes
cd my-shop
supabase link --project-ref <ref> && supabase db push
OWNER_EMAIL=you@example.com SUPABASE_SERVICE_ROLE_KEY=<key> pnpm run owner:invite
pnpm run dev
```

## 🔴 Застереження

- Магазин налаштований **лише під pnpm 11+**: `pnpm-workspace.yaml` шаблону везе
  `allowBuilds`, без якого install обривається, а `packageManager` прибиває версію.
  npm/yarn ці механізми ігнорують і зберуть магазин у неперевіреній конфігурації.
  У перші 24 години після виходу нової версії ядра install упреться в
  `minimumReleaseAge` — обхід описаний у README згенерованого магазину.
- `supabase db push` накочує **лише міграції**: секція `[auth]` з
  `supabase/config.toml` на хмару не потрапляє. У Dashboard треба продублювати
  шаблон листа «Invite user» (стандартний не передає `token_hash`, і `/auth/confirm`
  його не побачить) і виставити Site URL — інакше лінк будується з дефолтного
  `http://localhost:3000`.

Дизайн — [спека bootstrap-у власника](https://github.com/simplyCMS/simplyCMS/blob/main/docs/superpowers/specs/2026-08-03-create-store-owner-bootstrap-design.md).

## Ліцензія

MIT
