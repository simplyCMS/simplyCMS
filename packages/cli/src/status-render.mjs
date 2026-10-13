// Вивід `simplycms status`: стан для хука сесії (≤25 рядків) і людський звіт.
// Окремо від збирання (status.mjs): тут лише форматування готового звіту.
import {
  begin,
  finish,
  formatCheck,
  reportChecks,
  say,
  summarizeChecks,
} from './ui.mjs';

/** Стеля стану в `--hook`: агент читає його на початку кожної сесії. */
const HOOK_STATE_MAX_LINES = 25;

const moreLine = (count) => `… ще ${count} рядків — pnpm simplycms status`;

/**
 * Стан для `--hook`: шапка, проблеми (error перед warn), `unknown`. Перевищення стелі
 * зрізає ПРОБЛЕМИ: рядок «не вдалося перевірити» — єдиний знак, що стан неповний, тож
 * він не зрізається, доки вміщується шапка.
 * @param {{ stage: string, checks: import('./ui.mjs').Check[], next: { skill: string, reason: string } | null, unknown: string[] }} report
 * @param {boolean} introMissing ядро без `agent/intro.md`
 */
export function renderHookState(report, introMissing) {
  const { stage, checks, next, unknown } = report;
  const head = [
    `simplycms status — етап: ${stage}`,
    next === null
      ? 'Наступний скіл: не потрібен'
      : `Наступний скіл: ${next.skill} — ${next.reason}`,
    `Перевірки: ${summarizeChecks(checks)}`,
  ];
  if (introMissing)
    head.push(
      'УВАГА: node_modules/simplycms/agent/intro.md немає — pnpm install',
    );
  const order = { error: 0, warn: 1 };
  const problems = checks
    .filter((check) => check.status in order)
    .sort((a, b) => order[a.status] - order[b.status])
    .flatMap((check) => formatCheck(check).split('\n'));
  const tail = unknown.map((item) => `? не вдалося перевірити: ${item}`);
  if (head.length + problems.length + tail.length <= HOOK_STATE_MAX_LINES)
    return [...head, ...problems, ...tail];
  const room = HOOK_STATE_MAX_LINES - head.length - tail.length - 1;
  if (room >= 0) {
    const kept = problems.slice(0, room);
    return [...head, ...kept, ...tail, moreLine(problems.length - kept.length)];
  }
  // Навіть шапка з unknown не вміщується (зайве лише за патологічної кількості збоїв).
  const keptTail = tail.slice(0, HOOK_STATE_MAX_LINES - head.length - 1);
  return [
    ...head,
    ...keptTail,
    moreLine(problems.length + tail.length - keptTail.length),
  ];
}

/** Людський звіт (без прапорців). */
export function printHuman(report) {
  begin('simplycms status');
  say.info(`Етап: ${report.stage}`);
  reportChecks(report.checks);
  for (const item of report.unknown) say.warn(`Не вдалося перевірити: ${item}`);
  if (report.next)
    say.step(`Наступний скіл: ${report.next.skill} — ${report.next.reason}`);
  finish(summarizeChecks(report.checks));
}
