import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  checkCleanup,
  scanCleanup,
  testFiles,
} from './test-cleanup-guard/scan';

/**
 * Гард класу «render без cleanup» у юніт-тестах.
 *
 * Чому: у репо `globals: false` і немає `setupFiles`, тож авто-cleanup
 * Testing Library (він реєструється лише за глобального `afterEach`) не діє.
 * Дерево, яке тест не зняв, живе далі: ефекти й запити досипаються ПІСЛЯ
 * teardown jsdom і дають недетермінований unhandled «window is not defined»
 * (хвиля Е8-E, `query-client-context.test.tsx`). Конвенція — `afterEach(cleanup)`
 * у кожному файлі; глобальний setup свідомо не беремо.
 *
 * Правило: файл, що імпортує `render`/`renderHook` з `@testing-library/react`,
 * імпортує `cleanup` і викликає його в `afterEach`.
 *
 * Правила 2 («живий auth-клієнт у тесті») немає: аудит 2026-10-14 знайшов
 * єдиний тест із `CMSProvider` (`query-client-context`), і той мокає
 * `auth-client`; решта тестів сесії мокають `auth-client`/`useAuth`.
 */
const fixture = (n: string) =>
  readFileSync(join(import.meta.dirname, 'test-cleanup-guard', n), 'utf8');

describe('гард: render без cleanup', () => {
  it('у репо немає тест-файлів із render/renderHook без afterEach(cleanup)', () => {
    expect(
      scanCleanup(),
      'додай `afterEach(cleanup)` (cleanup — з @testing-library/react): авто-cleanup RTL тут вимкнено',
    ).toEqual([]);
  });

  it('сканер бачить тест-файли (не вакуумний прохід)', () => {
    expect(testFiles().length).toBeGreaterThan(100);
  });

  it('негативний контроль: фікстура без cleanup червоніє', () => {
    expect(
      checkCleanup(fixture('no-cleanup.fixture.tsx'), 'no-cleanup.fixture.tsx'),
    ).not.toBeNull();
  });

  it('позитивний контроль: канонічна форма зелена', () => {
    expect(
      checkCleanup(
        fixture('with-cleanup.fixture.tsx'),
        'with-cleanup.fixture.tsx',
      ),
    ).toBeNull();
  });

  it.each([
    [
      'cleanup лише в коментарі',
      "// afterEach(cleanup)\nimport { cleanup, render } from '@testing-library/react';",
    ],
    [
      'cleanup імпортовано, але не викликано',
      "import { cleanup, render } from '@testing-library/react';\nafterEach(() => vi.restoreAllMocks());",
    ],
    [
      'cleanup не з RTL',
      "import { render } from '@testing-library/react';\nafterEach(cleanup);",
    ],
  ])('негативний контроль: %s', (_, src) => {
    expect(checkCleanup(src, 'case.test.tsx')).not.toBeNull();
  });

  it.each([
    [
      'afterEach(() => cleanup())',
      "import { cleanup, render } from '@testing-library/react';\nafterEach(() => cleanup());",
    ],
    [
      'блок з іншими викликами',
      "import { cleanup, renderHook } from '@testing-library/react';\nafterEach(() => {\n  vi.restoreAllMocks();\n  cleanup();\n});",
    ],
    [
      'багаторядковий імпорт',
      "import {\n  act,\n  cleanup,\n  render,\n} from '@testing-library/react';\nafterEach(cleanup);",
    ],
    ['файл без render', "import { screen } from '@testing-library/react';"],
  ])('легальна форма: %s', (_, src) => {
    expect(checkCleanup(src, 'case.test.tsx')).toBeNull();
  });
});
