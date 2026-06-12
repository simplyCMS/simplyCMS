---
description: Perform comprehensive code review of implementation with architecture compliance, quality checks, and actionable recommendations
tools: ['read/readFile', 'read/problems', 'search', 'web', 'supabase/execute_sql', 'supabase/get_advisors', 'supabase/list_tables', 'supabase/list_migrations', 'supabase/search_docs', 'todo']
handoffs:
  - label: Update Documentation
    agent: doc-update
    prompt: Обнови документацію по результату виконання code review
  - label: Discuss Issues
    agent: discussion
    prompt: Детально обговори знайдені проблеми з code review вище. Поясни причини кожної проблеми та можливі підходи до вирішення.
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Outline

**GitHub Copilot coding agent виконав задачу. Перевір його реалізацію через аналіз кодової бази.**

### 1. Збір контексту

**ВАЖЛИВО:** Аналізуй код виключно через read_file, grep_search, semantic_search.

**ЗАБОРОНЕНО:**
- ❌ НЕ запускай команди: `typecheck`, `lint`, `lint:fix`, `build`, `test`, `pnpm`, `npm`, `git`
- ❌ НЕ використовуй git commands: `git diff`, `git log`, `git status`
- ❌ НЕ компілюй та не запускай скрипти

**Автоматичне визначення scope (DO NOT ask user):**

1. IF attached file exists in `docs/tasks/` → use as baseline requirements
2. IF `$ARGUMENTS` contains file paths → analyze those files
3. IF `$ARGUMENTS` describes changes → search workspace for matching files
4. IF no specific scope → analyze recent workspace changes via semantic_search

**CRITICAL: NEVER ask "Що було реалізовано?" — extract context from attachments and $ARGUMENTS automatically.**

**Завантаж релевантну документацію:**
- `BRD_SIMPLYCMS_NEXTJS.md` — якщо архітектурні зміни
- `.github/instructions/*.instructions.md` — правила для конкретної області коду

### 2. Архітектурна перевірка

#### 🏗️ Architecture & Design

**Перевір відповідність патернам:**

- **Package Structure:**
  - [ ] Код розміщено у правильному пакеті (@simplysoftua/core, admin, ui, plugins, themes)
  - [ ] Бізнес-логіка НЕ в темах (теми — лише візуалізація)
  - [ ] Відсутність circular dependencies між пакетами

- **Server/Client розділення:**
  - [ ] Server Components за замовчуванням
  - [ ] `'use client'` лише коли потрібно (стан, ефекти, події)
  - [ ] SSR для storefront-сторінок (SEO)
  - [ ] Client-side для адмін-панелі

- **Theme System:**
  - [ ] Storefront сторінки використовують компоненти з активної теми
  - [ ] ThemeModule контракт дотримано (layouts, pages, components)
  - [ ] Theme-specific компоненти лише в `themes/*/components/`

- **Plugin System:**
  - [ ] Плагіни використовують HookRegistry для інтеграції
  - [ ] Плагіни НЕ модифікують core-код напряму

- **Data Access Patterns:**
  - [ ] SSR: `createServerSupabase()` для server-side data fetching
  - [ ] Client: `supabase` client з `@simplysoftua/core` для адмін-панелі
  - [ ] TanStack Query для client-side caching (admin)
  - [ ] ISR revalidation після змін даних

- **Authentication:**
  - [ ] Cookie-based auth через `@supabase/ssr`
  - [ ] Auth guards в `proxy.ts` (admin → admin role, profile → auth)
  - [ ] Auth логіка НЕ за межами proxy та auth/ route

**MCP Integration Check:**
Перевір чи використовувалися MCP сервери для:
- [ ] shadcn/ui components — чи перевірялись через MCP registry
- [ ] Library APIs (Next.js, React Query, Zod) — чи звірялись з context7
- [ ] Supabase schema — чи генерувались types через MCP

### 3. Якість коду

#### 🔍 Code Quality

- **Читабельність:**
  - [ ] Зрозумілі назви змінних/функцій (camelCase для змінних, PascalCase для компонентів)
  - [ ] Функції < 150 рядків
  - [ ] Коментарі українською пояснюють **ЧОМУ**, не що

- **TypeScript:**
  - [ ] Відсутність `any` (використовувати `unknown` або конкретні типи)
  - [ ] `interface` для об'єктів, `type` для union/intersection
  - [ ] Експорт через `export type` / `export interface`

- **Форматування:**
  - [ ] 2 пробіли для відступів
  - [ ] Максимум 100 символів на рядок
  - [ ] Одинарні лапки для рядків
  - [ ] Trailing commas

- **Code Smells:**
  - [ ] Відсутність дублювання коду
  - [ ] Відсутність magic numbers
  - [ ] Відсутність глибокого nesting (> 3 рівні)

### 4. Продуктивність

#### ⚡ Performance

- **SSR Optimization:**
  - [ ] ISR revalidation для storefront сторінок
  - [ ] `next/image` для зображень
  - [ ] `generateMetadata` для SEO
  - [ ] Dynamic imports для важких компонентів (Tiptap, Recharts)

- **Client-side:**
  - [ ] Правильне використання `useMemo` / `useCallback`
  - [ ] TanStack Query з правильними `staleTime` налаштуваннями
  - [ ] Відсутність непотрібних ре-рендерів

- **Database:**
  - [ ] Відсутність N+1 queries
  - [ ] Правильна пагінація для великих списків
  - [ ] `.select()` з конкретними полями де можливо

### 5. Безпека

#### 🔒 Security

- **Authentication:**
  - [ ] Cookie-based sessions (не localStorage JWT)
  - [ ] Proxy guards для захищених маршрутів
  - [ ] Перевірка ролей для адмін-доступу

- **Validation:**
  - [ ] Zod schemas для вхідних даних
  - [ ] Server-side validation
  - [ ] Sanitization для user input

- **Supabase:**
  - [ ] RLS policies у Supabase
  - [ ] Не хардкодяться URL/ключі
  - [ ] Service role ключ НЕ використовується на клієнті

### 6. Функціональність

#### 🎯 Functionality

- **Error Handling:**
  - [ ] Try-catch блоки у critical sections
  - [ ] Error Boundaries (error.tsx)
  - [ ] Loading states (loading.tsx)
  - [ ] Empty states для списків

- **Migration Compliance:**
  - [ ] Якщо мігрується компонент з temp/ — поведінка збережена
  - [ ] Адаптація для Next.js (SSR, App Router) виконана коректно

## Структура звіту

**Формат output прямо у чаті (НЕ створюй окремий файл):**

```markdown
# Code Review Report

## 📊 Summary

- **Files Reviewed:** [число]
- **Overall Quality:** [🟢 Excellent / 🟡 Good / 🟠 Needs Work / 🔴 Critical Issues]
- **Architecture Compliance:** [Yes/No/Partial]

## ✅ Positive Aspects
- [Що добре зроблено]

## ⚠️ Issues and Suggestions

### 🏗️ Architecture
- [File path] - [Опис проблеми + рекомендація]

### 🔍 Code Quality
- [File path] - [Code smell + як виправити]

### ⚡ Performance
- [File path] - [Проблема + оптимізація]

### 🔒 Security
- [File path] - [Уразливість + захист]

## 🚨 Critical Issues (Must Fix)
1. **[Issue Title]** ([File path])
   - **Problem:** [Опис]
   - **Fix:** [Кроки виправлення]

## 💡 Recommendations
- [Покращення]

## 🎯 Next Steps
1. [ ] Fix critical issues
2. [ ] Address suggestions
```

## Workflow Summary

1. **Find files** — використай grep_search/semantic_search для знаходження змінених файлів
2. **Read code** — read_file для аналізу реалізації
3. **Check architecture** — відповідність patterns
4. **Review quality** — TypeScript, formatting, code smells
5. **Audit security** — auth, validation, RLS
6. **Generate report** — structured output прямо у чаті
7. **Suggest next steps** — що виправити, handoffs якщо потрібно

**ПРІОРИТЕТ:** Швидкий, корисний feedback без запуску команд.
