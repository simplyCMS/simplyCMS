// Прогін ESLint по СИНТЕТИЧНОМУ файлу — спільний для асертів тір-зон.
//
// Прийом той самий, що довів межу довіри плагінів і контракт серверного env:
// правилу підсовується один імпорт із `filePath` усередині зони й поза нею.

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';

export const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

export const eslint = new ESLint({ cwd: REPO });

/**
 * Повідомлення `no-restricted-imports` для одного імпорту в заданому файлі.
 * 🔴 Файл, зʼїдений `ignores`, дав би 0 повідомлень і хибно-зелений тест —
 * тому скоупінг зон асертиться окремим кейсом через `isPathIgnored`.
 */
export async function restrictedImports(
  specifier: string,
  filePath: string,
): Promise<string[]> {
  const [result] = await eslint.lintText(
    `import { probe } from '${specifier}';\nexport const used = probe;\n`,
    { filePath: join(REPO, filePath), warnIgnored: true },
  );
  return (result?.messages ?? [])
    .filter((m) => m.ruleId === 'no-restricted-imports')
    .map((m) => m.message);
}
