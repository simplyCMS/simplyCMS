import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Гард `tagExists` тепер читає REMOTE (`git ls-remote`), а не локальний
 * `git tag --list` — це і є фікс боргу «теги релізів не ведуться»
 * (docs/architecture/release-process.md, розділ «Теги релізів»): у свіжому
 * клоні локальний список тегів завжди порожній, тож старий варіант гарду
 * пропустив би повторний випуск уже виданої версії.
 *
 * Мокаємо `execSync`, бо реальний `git ls-remote` — мережевий виклик:
 * тест має лишатись детермінованим і офлайн.
 */

const execSyncMock = vi.fn();

vi.mock('node:child_process', () => ({
  execSync: (...args: unknown[]) => execSyncMock(...args),
}));

const { tagExists } = await import('../scripts/release/git.mjs');

describe('release git: tagExists — гард по тегах у remote', () => {
  beforeEach(() => {
    execSyncMock.mockReset();
  });

  it('true, коли `git ls-remote` знаходить збіг (exit 0)', () => {
    execSyncMock.mockReturnValue('deadbeef\trefs/tags/v1.2.3\n');

    expect(tagExists('1.2.3')).toBe(true);
    expect(execSyncMock).toHaveBeenCalledWith(
      expect.stringContaining(
        'git ls-remote --exit-code --tags origin refs/tags/v1.2.3',
      ),
      expect.objectContaining({ encoding: 'utf8' }),
    );
  });

  it('false, коли ls-remote відповів, але збігів немає (exit-код 2)', () => {
    execSyncMock.mockImplementation(() => {
      throw Object.assign(new Error('Command failed'), { status: 2 });
    });

    expect(tagExists('9.9.9')).toBe(false);
  });

  it('падає з поясненням, якщо remote недосяжний (інший exit-код) — БЕЗ фолбеку на локальні теги', () => {
    execSyncMock.mockImplementation(() => {
      throw Object.assign(new Error('Command failed'), {
        status: 128,
        stderr:
          "fatal: unable to access 'https://example.invalid/': Could not resolve host",
      });
    });

    expect(() => tagExists('1.0.0')).toThrow(
      /не відкочується на локальні теги/,
    );
  });

  it('падає і без явного status (напр. таймаут execSync) — теж не фолбек', () => {
    execSyncMock.mockImplementation(() => {
      throw new Error('ETIMEDOUT');
    });

    expect(() => tagExists('1.0.0')).toThrow('ETIMEDOUT');
  });
});
