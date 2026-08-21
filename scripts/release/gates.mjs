import { execSync } from 'node:child_process';

/**
 * Канонічний порядок гейтів — той самий, що в CLAUDE.md.
 *
 * 🔴 Порядок не «оптимізувати»: `install --frozen-lockfile` перший (єдиний, хто
 * ловить розсинхрон lockfile з манифестами), `build` перед `typecheck` (генерує
 * `src/routeTree.gen.ts`), packaging-suite остання (працює по зібраних tarball-ах).
 */
export const GATES = [
  { name: 'install --frozen-lockfile', cmd: 'pnpm install --frozen-lockfile' },
  { name: 'format:check', cmd: 'pnpm format:check' },
  { name: 'lint', cmd: 'pnpm lint' },
  { name: 'build', cmd: 'pnpm build' },
  { name: 'typecheck', cmd: 'pnpm typecheck' },
  { name: 'test', cmd: 'pnpm test' },
  { name: 'build:packages', cmd: 'pnpm build:packages' },
  // 🔴 Після `build:packages`, бо типізує шаблон проти зібраного `dist` —
  // рівно того, що бачить магазин. Кореневий `typecheck` шаблон не бачить
  // (він виключений із `tsconfig.json`), тож без цього кроку в реєстр їде
  // шаблон, з якого магазин може не зібратись.
  { name: 'typecheck:template', cmd: 'pnpm typecheck:template' },
  { name: 'test:packaging', cmd: 'pnpm test:packaging' },
];

/**
 * Прогнати всі гейти по черзі. Перший червоний зупиняє реліз.
 *
 * Вивід гейтів глушиться (`stdio: 'pipe'`), але при падінні друкується
 * повністю — інакше причина фейлу лишилась би невидимою.
 */
export function runGates({ log }) {
  for (const [index, gate] of GATES.entries()) {
    log(`  [${index + 1}/${GATES.length}] ${gate.name}…`);
    try {
      execSync(gate.cmd, { stdio: 'pipe', encoding: 'utf8' });
    } catch (error) {
      const output = `${error.stdout ?? ''}${error.stderr ?? ''}`;
      throw new Error(
        `Гейт «${gate.name}» червоний — реліз зупинено.\n\n${output.slice(-4000)}`,
      );
    }
  }
}
