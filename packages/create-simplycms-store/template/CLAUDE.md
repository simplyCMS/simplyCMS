@AGENTS.md

## Специфіка Claude Code

- **Хук старту сесії.** `.claude/settings.json` запускає `node .claude/hooks/session-start.mjs`
  на `startup|clear|compact`: хук додає в контекст вступ і поточний стан магазину. Свій запис
  хука доглядає `pnpm simplycms update`; решта ключів файлу — ваша.
- **Дозволи: читання вільно, зміни через підтвердження.** Рекомендований набір показує
  `pnpm simplycms doctor` (перевірка `agent-files`). `update` дозволи не зливає — перенесіть
  їх у `.claude/settings.json` → `permissions` самі.
