---
applyTo: '**/*'
description: 'Команди, форматування, тестування та середовище розробки'
---

# Tooling Rules

## Package Manager
- **pnpm** (v10.x) — єдиний пакетний менеджер.
- Workspace: `packages/simplycms/*`, `themes/*`, `plugins/*`.
- Не використовуй `npm` або `yarn`.

## Основні команди

```powershell
# Розробка
pnpm dev                    # Next.js dev server (Turbopack)
pnpm build                  # Production build
pnpm start                  # Production server
pnpm typecheck              # TypeScript type check
pnpm lint                   # ESLint
pnpm lint:fix               # ESLint (auto-fix)

# Тестування
pnpm test                   # Vitest run
pnpm test:watch             # Vitest watch mode

# Git Subtree (ядро CMS)
pnpm cms:pull               # Підтягнути оновлення ядра
pnpm cms:push               # Відправити зміни ядра
pnpm cms:push:branch <br>   # Push в окрему гілку
pnpm cms:diff               # Побачити зміни в ядрі

# База даних (використовує SUPABASE_PROJECT_ID + SUPABASE_ACCESS_TOKEN з .env.local)
pnpm db:generate-types      # Згенерувати TypeScript типи з Supabase
pnpm db:migrate             # Застосувати міграції (supabase link + db push)
```

## Конфігурація

### TypeScript
- Strict mode увімкнено.
- Path aliases:
  - `@simplysoftua/db-types` → `supabase/types.ts`
  - `@simplysoftua/core` → `packages/simplycms/core/src`
  - `@simplysoftua/admin` → `packages/simplycms/admin/src`
  - `@simplysoftua/ui` → `packages/simplycms/ui/src`
  - `@simplysoftua/plugins` → `packages/simplycms/plugin-system/src`
  - `@simplysoftua/themes` → `packages/simplycms/theme-system/src`
  - `@/*` → `app/*`
  - `@themes/*` → `themes/*`
  - `@plugins/*` → `plugins/*`
- `temp/` виключено з компіляції.

### ESLint
- `eslint-config-next` як базова конфігурація.
- Flat config (`eslint.config.mjs`).

### Tailwind v4
- Конфігурація в `tailwind.config.ts`.
- PostCSS через `@tailwindcss/postcss`.
- Typography plugin: `@tailwindcss/typography`.

### Next.js
- Turbopack для development.
- `transpilePackages` для workspace packages.
- `serverExternalPackages` для Tiptap.
- Image optimization з Supabase remote patterns.

## Тестування
- **Vitest** для unit та integration тестів.
- **Testing Library** (@testing-library/react) для компонентів.
- Тести поруч з кодом або в `__tests__/` директоріях.

## Git Subtree Workflow

### Повсякденна розробка
1. Працюй в будь-яких файлах як звичайно.
2. Коміть і пуш в `main`.

### Публікація змін ядра
1. Переконайся що зміни в `packages/simplycms/` закомічені.
2. Виконай `pnpm cms:push` для відправки в core-репозиторій.

### Оновлення ядра
1. Виконай `pnpm cms:pull` для підтягування змін з core-репозиторію.
2. Розвʼяжи merge conflicts якщо є.

## Змінні оточення

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
SUPABASE_PROJECT_ID=your-project-ref
SUPABASE_ACCESS_TOKEN=sbp_xxxx
```

- Завжди використовуй `.env.local` для локальних значень.
- `NEXT_PUBLIC_` prefix для клієнтських змінних.
- `SUPABASE_PROJECT_ID` + `SUPABASE_ACCESS_TOKEN` — для CLI (міграції, генерація типів через Management API).
- Не комітьте `.env.local` — він в `.gitignore`.
