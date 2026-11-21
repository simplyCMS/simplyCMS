# CLAUDE.md — SimplyCMS, Claude Code

@AGENTS.md

> Правила проєкту, інваріанти й архітектура — в `AGENTS.md`; рядок `@AGENTS.md` вище
> підвантажує його (Claude Code сам `AGENTS.md` не читає). Тут — лише специфічне для
> Claude Code. Цей файл — **лише правила**: поточний стан, етапи, лічильники й версії
> живуть у `docs/tasks/platform-roadmap.md` і `docs/tasks/v2-state-map.md`, не тут.

## Агентний тулінг

Процес розробки — плагін agent-kit (скіли `discuss`, `spec`, `plan`, `execute`, `landed-review`,
`research`, `track`; скрипти `orient`, `run-tests`, `pr-gate`, `sdd`). Налаштування проєкту для
нього — `.agents/kit.profile.json`; доменні критерії рев'ю — `.agents/review-criteria.md`.
🔴 Скіли, що їдуть у магазини (`simplycms-*`), живуть у `packages/simplycms/skills/<name>`, а
`.agents/skills/<name>` і `.claude/skills/<name>` — ПРЯМІ симлінки на нього (обидва в пакет, не
ланцюжком; стереже `tests/monorepo-skill-links.test.ts`): прав ОРИГІНАЛ у пакеті. Магазин отримує їх
симлінками на `node_modules/simplycms/skills/<name>` (скаффолдер після `installDeps`,
`simplycms update` доробляє відсутні й прибирає осиротілі, `doctor` №12 звітує розсинхрон).

| Шар | Що це |
|-----|-------|
| `packages/simplycms/skills/simplycms-*` | Скіли магазину: онбординг, діагностика, оновлення, редизайн (посібник — `docs/guides/simplycms-redesign.md`) |
| `.claude/commands/` | `/редизайн-за-референсом` (вхід до `simplycms-redesign`) |

## Робочий процес

- **Код-шар — `codebase-memory-mcp` лише через `orient`**: індекс прив'язаний до абсолютного шляху —
  worktree/другий клон індексуй окремо (`orient --doctor` скаже команду). Велика розвідка — скіл
  `research`; точкове «де лежить X» — `orient` сам.
- **Субагент або агент воркфлоу**, якому доручили конкретну задачу, виконує її напряму, без
  подальшого розкидання субагентів, якщо промпт не вимагає іншого: `CLAUDE.md` потрапляє і в
  контекст субагентів.
- **Скіли agent-kit** самі задають крок «орієнтація → гейт рішення → імплементація → верифікація»;
  не дублюй їхні процедури тут.
- **Git-worktree задач** створює лише `pr-gate start` у `.worktrees/` (git-ignored; vitest, ESLint і
  `.cbmignore` їх виключають); старі `.claude/worktrees/<run>` прибирає `pr-gate cleanup`. Не комітити
  їх і не покладатися на код у них як на основне дерево.

## Правила для цього файлу

- Правиш `AGENTS.md`, `CLAUDE.md` чи канон у `docs/architecture/` — зберігай ієрархію джерел
  (`AGENTS.md` → `docs/architecture/*` → скіли → код): рідкісне й довге — в `docs/` чи скіл,
  а не сюди; кожен файл, що вантажиться в КОЖНУ сесію, має лишатись коротким.
- Не додавай сюди етапи, прогрес, лічильники, версії й історію — це стан, його тримають
  `docs/tasks/*` та `CHANGELOG.md`.
- Агент-специфічні налаштування Claude Code (MCP, хуки, дозволи) — у `.claude/settings.json`.
