@AGENTS.md

## Специфіка Claude Code

- **Хук старту сесії.** `.claude/settings.json` запускає `.claude/hooks/session-start.mjs`
  (`node` з абсолютним шляхом через `${CLAUDE_PROJECT_DIR}`, тож `cd` агента хуку не шкодить) на
  `startup|clear|compact`: хук додає в контекст вступ і поточний стан магазину. Потрібен Claude Code
  ≥ 2.1.139. Свій запис хука доглядає `pnpm simplycms update`; решта ключів файлу — ваша.
- **Дозволи: читання вільно, зміни через підтвердження.** Рекомендований набір показує
  `pnpm simplycms doctor` (перевірка `agent-files`). `update` дозволи не зливає — перенесіть
  їх у `.claude/settings.json` → `permissions` самі.
