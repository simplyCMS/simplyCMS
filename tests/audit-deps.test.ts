import { describe, expect, it } from 'vitest';
import { formatGap, runAudit } from '../scripts/audit-deps.mjs';

// Крос-пакетний гейт (Task 1.3): кожен bare-імпорт з publish-root-ів пакета
// (`src/` і `routes/`) має бути оголошений у `dependencies` або
// `peerDependencies` цього ж пакета. У монорепо розрив невидимий —
// workspace-аліаси й hoisted-корінь `node_modules` резолвлять що завгодно;
// вилізе він лише на справжньому `npm install` з tarball-а (Етап 3, пілот)
// як `ERR_MODULE_NOT_FOUND` у споживача.
describe('audit-deps: manifest покриває всі bare-імпорти', () => {
  it('0 недекларованих залежностей', () => {
    const { missing, scanned, packages } = runAudit();

    if (missing.length > 0) {
      throw new Error(
        `Знайдено ${missing.length} недекларованих залежностей:\n${missing
          .map(formatGap)
          .join('\n')}`,
      );
    }

    expect(packages).toBeGreaterThan(0);
    expect(scanned).toBeGreaterThan(0);
  });
});
