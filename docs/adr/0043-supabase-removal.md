# ADR-0043: Повний знос Supabase; ратчет `no-supabase-import` проти повернення

Status: accepted 2026-10-11
Decided by: owner
Spec: `AGENTS.md` § «Архітектурні інваріанти»

## Context
Після переходу на V2 шар src/supabase/ лишився мертвим кодом: його імпортують лише власні тести. `LegacySupabaseBoundary` ловить помилку, яку ніхто не кидає. Єдиний живий клієнт `supabase-js` у репо — `tools/content-loader-mcp`, нефункціональний без PostgREST. К3-Е7 — знос мертвого шару, а не портування.

## Decision
1. Тека магазину `supabase/` стає `db/`: `supabase/migrations` → `db/migrations`. `config.toml` і `templates/invite.html` видаляються (В1).
2. `tools/content-loader-mcp` знесено разом із записом MCP у `.claude/settings.json` і виключенням у `tsconfig.json` (В2).
3. Стек у лендінгу й кореневому README: «TanStack Start, React and PostgreSQL» + Better Auth. Логотип Supabase замінено на PostgreSQL (В3).
4. `@supabase/*` у репо заборонено лінтом: правило `no-supabase-import`.

## Why
- Рішення власника В1–В3: `docs/superpowers/specs/2026-10-11-v2-k3-e7-supabase-removal-design.md` § «Рішення власника».
- Факти про мертвий шар: `docs/superpowers/specs/2026-10-11-v2-k3-e7-supabase-removal-design.md` § «Факти інвентаризації (2026-10-11».
- Ратчет на ВСЕ репо, власне імʼя плагіна: `eslint.config.mjs`.
- Правило названо в каноні: `AGENTS.md` § «Архітектурні інваріанти».
- Стан: теки packages/simplycms/src/supabase/ немає; теки `tools/` немає.

## Rejected
- Портування src/supabase/ на V2 — знос дешевший, шар мертвий (`docs/superpowers/specs/2026-10-11-v2-k3-e7-supabase-removal-design.md` § «Факти інвентаризації (2026-10-11»).
- Інші варіанти — у джерелі не записано.

## Consequences
- Магазин не залежить від Supabase: ні в коді, ні в шаблоні, ні в залежностях.
- `@supabase/*` не повертай навіть у тест чи утиліту. Лінт валить такий імпорт.
- Supabase MCP лишається лише для інспекції, не для міграцій (`AGENTS.md`, розділ про схему БД).
- Міграцій наявних магазинів немає, бо магазинів не було.
