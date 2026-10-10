// Очищення медіатеки сіду (С-13) — це `rm -rf`, тож відмови перевіряються
// окремо: шлях поза репо (`../`, абсолютний) і симлінк назовні. Для симлінка
// головне — ціль ПІСЛЯ виклику ціла.
import { existsSync } from 'node:fs';
import {
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  resetShowcaseMediaDir,
  SHOWCASE_MEDIA_DIR,
  ShowcaseMediaDirError,
} from '../scripts/showcase/media-dir.mts';

describe('resetShowcaseMediaDir', () => {
  let sandbox: string;
  let repo: string;
  let outside: string;

  beforeEach(async () => {
    sandbox = await realpath(await mkdtemp(join(tmpdir(), 'showcase-media-')));
    repo = join(sandbox, 'repo');
    outside = join(sandbox, 'outside');
    await mkdir(repo);
    await mkdir(outside);
    await writeFile(join(outside, 'keep.txt'), 'чужий файл');
  });

  afterEach(async () => {
    await rm(sandbox, { recursive: true, force: true });
  });

  it('очищає й створює теку всередині репо', async () => {
    const dir = join(repo, SHOWCASE_MEDIA_DIR);
    await mkdir(join(dir, 'ab'), { recursive: true });
    await writeFile(join(dir, 'ab', 'old.png'), 'x');
    expect(await resetShowcaseMediaDir(repo)).toBe(dir);
    expect(existsSync(dir)).toBe(true);
    expect(existsSync(join(dir, 'ab'))).toBe(false);
  });

  it('створює теку, якої ще немає (разом із .data)', async () => {
    expect(await resetShowcaseMediaDir(repo)).toBe(
      join(repo, SHOWCASE_MEDIA_DIR),
    );
  });

  it.each([
    ['../outside', () => '../outside'],
    ['абсолютний шлях поза репо', () => outside],
  ])('відмовляє для %s і нічого не видаляє', async (_, rel) => {
    await expect(resetShowcaseMediaDir(repo, rel())).rejects.toBeInstanceOf(
      ShowcaseMediaDirError,
    );
    expect(await readFile(join(outside, 'keep.txt'), 'utf8')).toBe(
      'чужий файл',
    );
  });

  it('відмовляє для симлінка назовні — ціль не очищено', async () => {
    await mkdir(join(repo, '.data'));
    await symlink(outside, join(repo, SHOWCASE_MEDIA_DIR));
    await expect(resetShowcaseMediaDir(repo)).rejects.toBeInstanceOf(
      ShowcaseMediaDirError,
    );
    expect(await readFile(join(outside, 'keep.txt'), 'utf8')).toBe(
      'чужий файл',
    );
  });

  it('відмовляє, коли симлінком назовні є батьківська .data', async () => {
    await mkdir(join(outside, 'showcase-media'));
    await writeFile(join(outside, 'showcase-media', 'keep.png'), 'x');
    await symlink(outside, join(repo, '.data'));
    await expect(resetShowcaseMediaDir(repo)).rejects.toBeInstanceOf(
      ShowcaseMediaDirError,
    );
    expect(existsSync(join(outside, 'showcase-media', 'keep.png'))).toBe(true);
  });

  it('відмовляє й для симлінка всередину репо (інакше стер би код)', async () => {
    await mkdir(join(repo, 'src'));
    await writeFile(join(repo, 'src', 'code.ts'), 'export {}');
    await mkdir(join(repo, '.data'));
    await symlink(join(repo, 'src'), join(repo, SHOWCASE_MEDIA_DIR));
    await expect(resetShowcaseMediaDir(repo)).rejects.toBeInstanceOf(
      ShowcaseMediaDirError,
    );
    expect(existsSync(join(repo, 'src', 'code.ts'))).toBe(true);
  });
});
