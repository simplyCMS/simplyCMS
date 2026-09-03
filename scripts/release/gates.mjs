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
  // 🔴 Трек T: після зміни бандлера єдиний доказ межі клієнт/сервер у
  // РЕАЛЬНОМУ клієнтському бандлі — Gate C пілота (плюс Import Protection
  // шаблону з того самого tarball-а). БД не потребує (`--pack-only`),
  // детермінований; у CI не ганяється (рішення 2026-08-01 стосується `pilot`
  // з Gate B), тож реліз — єдине місце, де він обовʼязковий.
  { name: 'pilot:pack', cmd: 'pnpm pilot:pack' },
];

/**
 * Прогнати всі гейти по черзі. Перший червоний зупиняє реліз.
 *
 * Вивід гейтів глушиться (`stdio: 'pipe'`), але при падінні друкується
 * повністю — інакше причина фейлу лишилась би невидимою.
 *
 * 🔴 `maxBuffer` явний: дефолт `execSync` — 1 МіБ НА ПОТІК, а найбалакучіший
 * гейт `pilot:pack` (доданий треком T — збирає скретч-магазин: `pnpm pack`
 * × 5, install, `vite build`) дає 172 КБ stdout на ЗЕЛЕНОМУ прогоні (вимір
 * 2026-09-03), тобто запас лише ×6. Балакучий саме червоний прогін — і
 * переповнення обірвало б вивід `ENOBUFS`-ом, сховавши справжню причину
 * фейлу за помилкою, що коду не стосується.
 */
export function runGates({ log }) {
  for (const [index, gate] of GATES.entries()) {
    log(`  [${index + 1}/${GATES.length}] ${gate.name}…`);
    try {
      execSync(gate.cmd, {
        stdio: 'pipe',
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024,
      });
    } catch (error) {
      const output = `${error.stdout ?? ''}${error.stderr ?? ''}`;
      throw new Error(
        `Гейт «${gate.name}» червоний — реліз зупинено.\n\n${output.slice(-4000)}`,
      );
    }
  }
}
