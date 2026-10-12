import { describe, it, expect } from 'vitest';
import { resolve } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { SCANNED_ROOTS, scanAll, sourceFiles } from './i18n-coverage/scan';
import {
  ALLOWLIST,
  PENDING_FILES,
  type DevKind,
} from './i18n-coverage/pending';

const REPO = resolve(__dirname, '..');

/**
 * Чи стоїть рядок усередині діагностики розробника — `console.*` або
 * `throw new Error(...)`. Виклик може бути багаторядковим, тому дивимось вікно
 * попередніх рядків.
 *
 * 🔴 `throw` тут не послаблення, а необхідність: `validateThemeModule` віддає
 * помилки АВТОРОВІ теми саме киданням, а не логом. Ризик «кинута помилка
 * долетить до покупця через error boundary» знімається не цим предикатом, а
 * тим, що виняток діє лише для файлів, явно перелічених в `ALLOWLIST`, — а
 * там немає жодного JSX.
 */
const KIND_PATTERNS: Record<DevKind, (line: string) => boolean> = {
  console: (l) => l.includes('console.'),
  throw: (l) => /throw new \w*Error\(/.test(l),
  // Конструктор підкласу Error: те саме повідомлення, що й `throw new Error`.
  super: (l) => /\bsuper\(/.test(l),
  // Ін'єкційний лог-синк драйвера пошти (`log(...)`): рядок читає оператор.
  'log-sink': (l) => /\blog\(/.test(l),
};

const kindsOf = (file: string, entries = ALLOWLIST): DevKind[] => {
  const raw = entries[file]!.kind;
  return Array.isArray(raw) ? raw : [raw];
};

/** Чи збігається вікно рядків навколо `line` із видом `kind`. */
function matchesKind(file: string, line: number, kind: DevKind): boolean {
  const lines = readFileSync(resolve(REPO, file), 'utf8').split('\n');
  return lines
    .slice(Math.max(0, line - 3), line)
    .some((l) => KIND_PATTERNS[kind](l));
}

function insideDevDiagnostic(file: string, line: number): boolean {
  return kindsOf(file).some((kind) => matchesKind(file, line, kind));
}

/**
 * Записи allowlist без жодного кириличного рядка заявленого виду у файлі:
 * `[файл, вид]`. Виняток без предмета — вигадка, що ховає майбутній регрес.
 */
export function staleAllowlistKinds(
  entries: Record<string, { kind: DevKind | DevKind[] }>,
  findings: readonly { file: string; line: number }[],
): string[] {
  const stale: string[] = [];
  for (const file of Object.keys(entries)) {
    for (const kind of kindsOf(file, entries as typeof ALLOWLIST)) {
      const used = findings.some(
        (f) => f.file === file && matchesKind(file, f.line, kind),
      );
      if (!used) stale.push(`${file} [${kind}]`);
    }
  }
  return stale;
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

  it('реєстр ALLOWLIST не містить записів без збігу заявленого виду', () => {
    expect(
      staleAllowlistKinds(ALLOWLIST, findings),
      'allowlist-запис без жодного збігу виду у файлі',
    ).toEqual([]);
  });

  it('негативний контроль: фіктивний запис allowlist червоніє', () => {
    const fake = {
      ...ALLOWLIST,
      'packages/simplycms/src/plugin-sdk/usePluginTable.ts': {
        kind: 'throw' as const,
        reason: 'фіктивний',
      },
    };
    expect(staleAllowlistKinds(fake, findings)).toEqual([
      'packages/simplycms/src/plugin-sdk/usePluginTable.ts [throw]',
    ]);
  });

  it('усі шляхи в реєстрі існують', () => {
    const missing = [...PENDING_FILES, ...Object.keys(ALLOWLIST)].filter(
      (f) => !existsSync(resolve(REPO, f)),
    );

    expect(missing, 'записи реєстру без файлу на диску').toEqual([]);
  });

  it('allowlist покриває лише діагностику розробника', () => {
    // Звужуємо виняток навмисно: allowlist існує для `console.*` і `throw`, а
    // будь-який інший рядок у цих файлах має мігрувати, а не ховатись за записом.
    const nonLog = findings
      .filter((f) => f.file in ALLOWLIST)
      .filter((f) => !insideDevDiagnostic(f.file, f.line))
      .map((f) => `${f.file}:${f.line} ${f.text}`);

    expect(
      nonLog,
      'рядки в allowlist-файлах поза console.* / throw new Error',
    ).toEqual([]);
  });

  it('скановано всі зони SCANNED_ROOTS', () => {
    // Страховка від мовчазного нуля: якби обхід зламався, решта перевірок
    // стала б тривіально зеленою на порожньому наборі. Асертимо кожен корінь
    // окремо — інакше сумарний поріг сховав би корінь, що дав нуль файлів.
    const files = sourceFiles(REPO);

    const empty = SCANNED_ROOTS.filter(
      (root) => !files.some((f) => f.startsWith(`${root}/`)),
    );
    expect(empty, 'корені SCANNED_ROOTS без жодного файлу').toEqual([]);

    expect(
      files.filter((f) => f.startsWith('packages/simplycms/src/admin/')).length,
    ).toBeGreaterThan(50);
    expect(
      files.filter((f) =>
        f.startsWith('packages/simplycms/src/storefront-routes/'),
      ).length,
    ).toBeGreaterThan(20);
    expect(
      files.filter((f) => f.startsWith('packages/simplycms/src/checkout-ui/'))
        .length,
    ).toBeGreaterThan(10);
  });
});
