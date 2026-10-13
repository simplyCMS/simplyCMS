import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

// S4-16: абсолютна ціль симлінка існує лише на одній машині (`/tmp/claude-…`,
// `/home/<хтось>/…`) — у чужому клоні лінк висить у порожнечу. У git-індексі
// допустимі тільки відносні цілі. Індекс, а не диск: локальні лінки
// розробника (під `.gitignore`) цей тест не стосуються.
const git = (args: string[]): string =>
  execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

/** Симлінки індексу (режим 120000): шлях → ціль із блоба. */
function trackedSymlinks(): { path: string; target: string }[] {
  return git(['ls-files', '-s', '-z'])
    .split('\0')
    .filter((entry) => entry.startsWith('120000 '))
    .map((entry) => {
      const [meta, path] = entry.split('\t') as [string, string];
      const blob = meta.split(' ')[1]!;
      return { path, target: git(['cat-file', '-p', blob]) };
    });
}

describe('симлінки в git-індексі', () => {
  it('жоден не має абсолютної цілі', () => {
    const links = trackedSymlinks();
    // Страж від порожнього проходу: у репо є симлінки скілів.
    expect(links.length).toBeGreaterThan(0);
    const absolute = links.filter(({ target }) => target.startsWith('/'));
    expect(absolute.map(({ path }) => path)).toEqual([]);
  });
});
