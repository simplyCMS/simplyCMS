/**
 * Медіатека сіду (С-13): виділена тека, яку команда очищає перед стартом.
 *
 * 🔴 Чому очищення взагалі потрібне: ключі сховища недетерміновані
 * (`randomUUID`), а `db:demo` перестворює базу — файли попереднього прогону
 * лишалися б сиротами без жодного рядка `media`.
 *
 * 🔴 Чому стільки перевірок: це `rm -rf`. Шлях зашитий константою, але
 * `.data` чи сама тека можуть виявитись симлінком назовні — тоді рекурсивне
 * видалення пішло б по чужих файлах. Тому рішення ухвалюється за `realpath`,
 * і все, що веде за межі кореня репо, — відмова без жодного видалення.
 */
import { lstat, mkdir, realpath, rm } from 'node:fs/promises';
import {
  basename,
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
} from 'node:path';

/** Тека медіатеки сіду відносно кореня репо (gitignored через `.data/`). */
export const SHOWCASE_MEDIA_DIR = '.data/showcase-media';

/** Шлях медіатеки веде за межі кореня репо — нічого не видалено. */
export class ShowcaseMediaDirError extends Error {
  constructor(target: string, reason: string) {
    super(
      `[showcase] Відмова очищати медіатеку «${target}»: ${reason}. ` +
        'Команда видаляє лише теку всередині репозиторію; перевір, чи це не ' +
        'симлінк назовні, і прибери його вручну.',
    );
    this.name = 'ShowcaseMediaDirError';
  }
}

/** `child` лежить СТРОГО всередині `root` (сам корінь — ні). */
function isInside(root: string, child: string): boolean {
  const rel = relative(root, child);
  return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel);
}

/** realpath найближчого наявного предка + хвіст, якого ще немає на диску. */
async function realpathOfExisting(path: string): Promise<string> {
  try {
    await lstat(path);
    return await realpath(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    const parent = dirname(path);
    if (parent === path) throw error;
    return join(await realpathOfExisting(parent), basename(path));
  }
}

/**
 * Очищає (і створює наново) медіатеку `rel` усередині `repoRoot`.
 * Повертає справжній абсолютний шлях — його отримує `MEDIA_ROOT`.
 *
 * @throws ShowcaseMediaDirError якщо шлях виходить за корінь репо чи йде
 *   через симлінк — у такому разі НІЧОГО не видалено.
 */
export async function resetShowcaseMediaDir(
  repoRoot: string,
  rel: string = SHOWCASE_MEDIA_DIR,
): Promise<string> {
  const root = await realpath(repoRoot);
  const lexical = resolve(root, rel);
  if (!isInside(root, lexical)) {
    throw new ShowcaseMediaDirError(rel, 'шлях поза коренем репозиторію');
  }
  const real = await realpathOfExisting(lexical);
  // Симлінк будь-куди — відмова, навіть усередину репо: `.data/showcase-media`
  // → `src` пройшов би перевірку «всередині кореня» і стер би код.
  if (real !== lexical || !isInside(root, real)) {
    throw new ShowcaseMediaDirError(rel, `шлях веде через симлінк у ${real}`);
  }
  await rm(real, { recursive: true, force: true });
  await mkdir(real, { recursive: true });
  return real;
}
