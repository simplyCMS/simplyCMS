// UPSTREAM:START-2 — docs/architecture/upstream-workarounds.md
// Без `domainErrorAdapter` у `serializationAdapters` доменні помилки (у т.ч.
// `ValidationError` з issues, Тема 12) долітають до клієнта голим
// `Error(message)`: помилки полів зникають, лишається службовий текст.
// Тести адаптера доводять МЕХАНІКУ; тут — що кожен стартовий файл
// магазину справді його реєструє (host, канон CLI, шаблон скаффолдера).
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const FILES = [
  'src/start.ts',
  'packages/cli/host/src/start.ts',
  'packages/create-simplycms-store/template/src/start.ts',
];

describe('domainErrorAdapter зареєстровано в createStart', () => {
  it.each(FILES)('%s', (file) => {
    const src = readFileSync(resolve(__dirname, '..', file), 'utf8');
    expect(src).toMatch(
      /serializationAdapters:\s*\[[^\]]*\bdomainErrorAdapter\b[^\]]*\]/,
    );
    expect(src).toContain("from 'simplycms/runtime/domain-error-adapter'");
  });
});
