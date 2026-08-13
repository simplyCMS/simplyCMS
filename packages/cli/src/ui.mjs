// Вивід CLI: обгортки @clack/prompts + форматований звіт перевірок doctor.
import { intro, log, note, outro } from '@clack/prompts';

/** Початок роботи команди. */
export function begin(title) {
  intro(title);
}

/** Фінальний підпис команди. */
export function finish(message) {
  outro(message);
}

/** Рівні повідомлень — єдина точка виводу для всіх команд. */
export const say = {
  info: (message) => log.info(message),
  success: (message) => log.success(message),
  warn: (message) => log.warn(message),
  error: (message) => log.error(message),
  step: (message) => log.step(message),
};

/** Блок «наступні кроки» — той самий формат, що в скаффолдера. */
export function showSteps(lines, title = 'Наступні кроки') {
  note(lines.join('\n'), title);
}

/**
 * Результат однієї перевірки doctor. `skip` — окремий стан «не вдалося
 * перевірити» (§3 спеки): перевірка не пропущена тихо, а чесно звітована.
 * @typedef {'ok' | 'warn' | 'error' | 'skip'} CheckStatus
 * @typedef {{ id: string; title: string; status: CheckStatus; details?: string }} Check
 */

const STATUS_MARKS = { ok: '✓', warn: '!', error: '✗', skip: '?' };

/**
 * Один рядок звіту: маркер + назва, деталі — з нового рядка з відступом.
 * @param {Check} check
 */
export function formatCheck(check) {
  const head = `${STATUS_MARKS[check.status]} ${check.title}`;
  if (!check.details) return head;
  return `${head}\n  ${check.details.replaceAll('\n', '\n  ')}`;
}

/**
 * Друк звіту перевірок відповідними рівнями log.
 * @param {Check[]} checks
 */
export function reportChecks(checks) {
  for (const check of checks) {
    const line = formatCheck(check);
    if (check.status === 'error') log.error(line);
    else if (check.status === 'warn') log.warn(line);
    else if (check.status === 'skip') log.info(line);
    else log.success(line);
  }
}

/**
 * Підсумковий рядок для outro: скільки ok/попереджень/помилок/непереверненого.
 * @param {Check[]} checks
 */
export function summarizeChecks(checks) {
  const count = (status) => checks.filter((c) => c.status === status).length;
  const parts = [`ok: ${count('ok')}`];
  if (count('warn') > 0) parts.push(`попереджень: ${count('warn')}`);
  if (count('error') > 0) parts.push(`помилок: ${count('error')}`);
  if (count('skip') > 0) parts.push(`не вдалося перевірити: ${count('skip')}`);
  return parts.join(', ');
}
