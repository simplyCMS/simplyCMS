import { describe, expect, it } from 'vitest';
import { runAudit } from '../scripts/audit-exports.mjs';

// Крос-пакетний гейт (Task 1.2): усі реально вжиті специфікатори
// `@simplycms/<pkg>/<subpath>` мають відповідний ключ у `exports`
// (і в `publishConfig.exports`, якщо він є). Workspace-аліаси в
// tsconfig/vite резолвлять будь-який subpath незалежно від manifest-а —
// без цього гейта розрив виявиться лише на справжньому `pnpm install`
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

// 🔴 Другий кошик того ж аудиту (закрито 2026-08-21). Специфікатор із іменем
// пакета ядра, якого в `packages/` немає, — це злите К0-ім'я або одрук. Він
// мовчки лягав у інформаційний `unresolved`, який не асертив ніхто: файл із
// `@simplycms/runtime/defineRuntime` лишав гейт зеленим, хоч у магазині це
// `ERR_MODULE_NOT_FOUND` на неіснуючому пакеті.
describe('audit-exports: мертві імена пакетів ядра', () => {
  it('у репо немає специфікаторів неіснуючих пакетів ядра', () => {
    const { stale } = runAudit();

    expect(
      stale.map((item) => `${item.specifier} (пакета ${item.pkg} немає)`),
    ).toEqual([]);
  });

  it('специфікатор злитого пакета валить гейт (негативний контроль)', () => {
    const { stale, missing } = runAudit({
      specifiers: ['@simplycms/runtime/defineRuntime'],
    });

    expect(stale).toEqual([
      {
        specifier: '@simplycms/runtime/defineRuntime',
        pkg: '@simplycms/runtime',
      },
    ]);
    expect(missing).toEqual([]);
  });

  it('живі сателіти в цей кошик не потрапляють', () => {
    // Позитивний контроль: `@simplycms/plugin-faq` — робочий пакет із
    // wildcard-ключем `./pages/*`, тож ані stale, ані missing.
    const { stale, missing } = runAudit({
      specifiers: ['@simplycms/plugin-faq/pages/FaqAdmin'],
    });

    expect(stale).toEqual([]);
    expect(missing).toEqual([]);
  });
});
