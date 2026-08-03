import { describe, expect, it } from 'vitest';
import { runAudit } from '../scripts/audit-exports.mjs';

// Крос-пакетний гейт (Task 1.2): усі реально вжиті специфікатори
// `@simplycms/<pkg>/<subpath>` мають відповідний ключ у `exports`
// (і в `publishConfig.exports`, якщо він є). Workspace-аліаси в
// tsconfig/vite резолвлять будь-який subpath незалежно від manifest-а —
// без цього гейта розрив виявиться лише на справжньому `npm install`
// (Етап 3, пілот), коли Node впаде на `ERR_PACKAGE_PATH_NOT_EXPORTED`.
describe('audit-exports: consumed subpath-и покриті exports', () => {
  it('0 відсутніх ключів exports', () => {
    const { missing, scanned } = runAudit();

    if (missing.length > 0) {
      const report = missing
        .map(
          (m) =>
            `  ${m.specifier} — немає ключа в ${m.reason} (${m.packageJsonPath})`,
        )
        .join('\n');
      throw new Error(
        `Знайдено ${missing.length} специфікатор(ів) без відповідного ключа exports:\n${report}`,
      );
    }

    expect(scanned).toBeGreaterThan(0);
  });
});
