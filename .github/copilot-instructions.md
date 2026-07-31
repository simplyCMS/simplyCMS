# GitHub Copilot Instructions

> This file contains GitHub Copilot-specific configuration.
> For universal agent instructions, see `/AGENTS.md` in the repository root.

## 🤖 MCP SERVERS (Model Context Protocol)

**IMPORTANT:** Use MCP servers to verify library APIs, UI components, and database operations.

### context7 - Library Documentation
- Tools: `resolve-library-id`, `get-library-docs`
- Use for: TanStack Start/Router, React, TypeScript, TanStack Query, Zod, and other external libraries
- When: Working with external libraries, checking APIs, finding best practices
- MCP provides latest documentation that may differ from your training data

### shadcn - UI Components
- Tools: `search_items_in_registries`, `view_items_in_registries`, `get_item_examples_from_registries`, `get_add_command_for_items`, `get_audit_checklist`
- Primary: https://www.shadcn.io/ (core components)
- Secondary: https://ui.shadcn.com/ (additional components)
- Workflow:
  1. Search on shadcn.io first
  2. If not found, check ui.shadcn.com
  3. Always view examples via `get_item_examples_from_registries`
  4. After adding, run `get_audit_checklist`

### supabase - Database and Edge Functions
- Tools (inspection only): `execute_sql` (read-only), `list_tables`, `search_docs`, `get_advisors`, `deploy_edge_function`
- Use for: inspecting schema/RLS, read-only queries, advisors, Edge Functions
- 🔴 Schema changes go through the migration pipeline, NOT `apply_migration`:
  `packages/simplycms/schema/src/schema.ts` → `pnpm db:diff <name>` → SQL review → `pnpm db:migrate` (runs `db:generate-types`)

### github - Repository Management
- Tools: Issues, PRs, code search, file operations, releases
- Use for: Managing GitHub workflows, creating issues/PRs, searching repositories

### chrome - Browser Automation
- Tools: Navigation, form input, element interaction, screenshots, DevTools API
- Use for: E2E testing, browser automation, performance analysis

## 🎯 COPILOT-SPECIFIC RULES

### MCP Usage
- **Use MCP servers to verify library APIs and best practices** (context7, shadcn, supabase)
- Check shadcn/ui components via MCP before adding (search → examples → audit)
- Verify Supabase schema and types through MCP tools
- **Do not add shadcn/ui components without checking MCP registry first**
- **Do not assume library APIs — always verify through MCP context7**

### Code Quality Commands
- Використовуй `pnpm typecheck`, `pnpm lint` для перевірок.

## 🤖 AI AGENTS

<agents>
<agent>
<name>code-review</name>
<description>Perform comprehensive code review of implementation with architecture compliance, quality checks, and actionable recommendations</description>
</agent>
<agent>
<name>doc-update</name>
<description>Update project documentation based on code changes, ensuring architecture docs stay current and accurate</description>
</agent>
<agent>
<name>discussion</name>
<description>Discussion-only mode: explanations and architecture discussions without code generation</description>
</agent>
<agent>
<name>create-task</name>
<description>Prepare a task file for GitHub Copilot coding agent based on analysis</description>
</agent>
<agent>
<name>Plan</name>
<description>Researches and outlines multi-step plans</description>
<argumentHint>Outline the goal or problem to research</argumentHint>
</agent>
</agents>

<system>
ALWAYS escalate (ask expert via tools) IF uncertain, AMBIGUOUS, or CONFLICTING instructions, OR repeated failures, OR destructive edits, OR public API changes, OR architecture uncertainty, OR need to delete/refactor public API. Never guess silently. Never continue after 2 failed attempts without escalation.
ALWAYS WHEN YOU ARE UNSURE, ASK FOR HELP.
ALWAYS ESCALATE EARLY.
ALWAYS AT THE END OF YOUR WORK ASK EXPERT ABOUT WHAT YOU HAVE DONE AND FOLLOW HIS INSTRUCTIONS.
EACH TIME ADD CONSIDERATIONS WITH EXPERT IN ALL YOURS TODO LIST IN BEGINNING AND TO THE END OF YOURS TODO LIST.
SEND TO EXPER ONLY SIMPLE TEXT, EVEN IF YOU HAVE CODE, SEND IT AS SIMPLE TEXT.
NEVER TRY TO DEBUG APP. ALWAYS ASK EXPERT. NOT USER!!!
</system>
