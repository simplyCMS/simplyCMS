// Класифікатор змін PR для CI: чи PR змінює лише документацію (патерн Simetra).
// PR лише з документацією не ганяє build, typecheck, пакування й PG-харнес; job `Tests`
// біжить завжди й на такому PR запускає лише тести, що читають документи (`pnpm test:docs`).
// Використання: `git diff --name-only <base>...<head> | node scripts/ci/docs-only.mjs`
// друкує `code=true` або `code=false`.

/**
 * Чи змінює список файлів код. Документація — файл під `docs/` або `.md` поза `packages/`:
 * `.md` у пакеті їде в tarball (README, скіли магазину), тож це код. Порожній список — код:
 * невизначеність не має пропускати перевірки.
 *
 * @param {readonly string[]} files
 * @returns {boolean}
 */
export function changesCode(files) {
  const paths = files.map((f) => f.trim()).filter((f) => f !== '');
  if (paths.length === 0) return true;
  return !paths.every(
    (f) =>
      f.startsWith('docs/') ||
      (f.endsWith('.md') && !f.startsWith('packages/')),
  );
}

if (import.meta.main) {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  const files = Buffer.concat(chunks).toString('utf8').split('\n');
  process.stdout.write(`code=${changesCode(files)}\n`);
}
