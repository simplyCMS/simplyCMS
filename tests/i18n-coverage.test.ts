import { describe, it, expect } from 'vitest';
import { resolve } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { scanAll, sourceFiles } from './i18n-coverage/scan';
import { ALLOWLIST, PENDING_FILES } from './i18n-coverage/pending';

const REPO = resolve(__dirname, '..');

/** Чи стоїть рядок усередині виклику `console.*` (виклик може бути багаторядковим). */
function insideConsoleCall(file: string, line: number): boolean {
  const lines = readFileSync(resolve(REPO, file), 'utf8').split('\n');
  return lines
    .slice(Math.max(0, line - 3), line)
    .some((l) => l.includes('console.'));
}

/**
 * Незалежне доведення повноти i18n-міграції.
 *
 * ESLint-селектори покривають ~64 % роботи (лише `JSXText` і три атрибути), тож
 * зелений `pnpm lint` завершеності НЕ доводить. Доводить цей тест: він бачить
 * усі рядкові вузли — toast, Zod, тернарники, мапи ярликів, шаблонні літерали.
 */
describe('i18n: хардкоджені рядки інтерфейсу', () => {
  const pending = new Set(PENDING_FILES);
  const findings = scanAll(REPO);

  it('мігровані файли не містять кириличних рядків', () => {
    const regressions = findings
      .filter((f) => !pending.has(f.file) && !(f.file in ALLOWLIST))
      .map((f) => `${f.file}:${f.line} [${f.kind}] ${f.text}`);

    expect(
      regressions,
      `${regressions.length} хардкоджених рядків поза реєстром міграції`,
    ).toEqual([]);
  });

  it('реєстр PENDING_FILES не містить зайвих записів', () => {
    // Файл без кирилиці, що лишився в реєстрі, робить його списком-вигадкою:
    // тест звітував би про «незакритий борг», якого вже немає.
    const withStrings = new Set(findings.map((f) => f.file));
    const stale = PENDING_FILES.filter((f) => !withStrings.has(f));

    expect(stale, 'мігровані файли, забуті в PENDING_FILES').toEqual([]);
  });

  it('усі шляхи в реєстрі існують', () => {
    const missing = [...PENDING_FILES, ...Object.keys(ALLOWLIST)].filter(
      (f) => !existsSync(resolve(REPO, f)),
    );

    expect(missing, 'записи реєстру без файлу на диску').toEqual([]);
  });

  it('allowlist покриває лише логи розробника', () => {
    // Звужуємо виняток навмисно: allowlist існує для `console.*`, і будь-який
    // інший рядок у цих файлах має мігрувати, а не ховатись за записом.
    const nonLog = findings
      .filter((f) => f.file in ALLOWLIST)
      .filter((f) => !insideConsoleCall(f.file, f.line))
      .map((f) => `${f.file}:${f.line} ${f.text}`);

    expect(nonLog, 'рядки в allowlist-файлах поза console.*').toEqual([]);
  });

  it('скановано обидва пакети', () => {
    const files = sourceFiles(REPO);
    const admin = files.filter((f) => f.startsWith('packages/admin/'));
    const storefront = files.filter((f) =>
      f.startsWith('packages/storefront-routes/'),
    );

    // Страховка від мовчазного нуля: якби обхід зламався, решта перевірок
    // стала б тривіально зеленою на порожньому наборі.
    expect(admin.length).toBeGreaterThan(50);
    expect(storefront.length).toBeGreaterThan(20);
  });
});
