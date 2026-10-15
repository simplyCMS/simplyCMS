import { execSync } from 'node:child_process';

/**
 * ЄДИНИЙ перелік гейтів: його беруть і `pnpm release`, і `pnpm gates` (`scripts/gates.mjs`)
 * — копії немає, а `tests/release-gates.test.ts` звіряє його з порядком у `AGENTS.md`
 * («Порядок гейтів») + `pilot` наприкінці.
 *
 * 🔴 `test:schema` іде там, де в `AGENTS.md`, але ганяється повним харнесом
 * (`schema-full.mjs`: Postgres, Garage, Mailpit — проєкти storage і mail без них не
 * стартують; з 1.0 обовʼязковий, Docker на машині релізу — вимога). Наприкінці —
 * повний `pilot` (доказ межі клієнт/сервер у реальному клієнтському бандлі та СТАРТУ
 * серверного бандла скретч-магазину; потребує Docker).
 *
 * 🔴 Порядок не «оптимізувати»: `install --frozen-lockfile` перший (єдиний, хто
 * ловить розсинхрон lockfile з манифестами), `build` перед `typecheck` (генерує
 * `src/routeTree.gen.ts`), packaging-suite остання перед пілотом (працює по зібраних
 * tarball-ах).
 */
export const GATES = [
  { name: 'install --frozen-lockfile', cmd: 'pnpm install --frozen-lockfile' },
  { name: 'format:check', cmd: 'pnpm format:check' },
  { name: 'lint', cmd: 'pnpm lint' },
  { name: 'build', cmd: 'pnpm build' },
  { name: 'typecheck', cmd: 'pnpm typecheck' },
  // 🔴 Окремо від `typecheck`: `tsx` типів не перевіряє, а кореневий
  // `tsconfig.json` не включає `scripts/showcase/*.mts`, тож дрейф сигнатур
  // ядер, якими пише сід, інакше не червонів би ніде до живого запуску.
  { name: 'typecheck:showcase', cmd: 'pnpm typecheck:showcase' },
  { name: 'test', cmd: 'pnpm test' },
  // 🔴 Обіцянка 1.0 (Е8-В2/В3): магазин із даними переживає наступну версію —
  // це доводить схемний контур (`upgrade-1x`, журнал міграцій, RLS). Потребує
  // Docker: харнес цілим (Postgres, Garage, Mailpit) піднімає `schema-full.mjs`.
  { name: 'test:schema', cmd: 'node scripts/release/schema-full.mjs' },
  { name: 'build:packages', cmd: 'pnpm build:packages' },
  // 🔴 Після `build:packages`, бо типізує шаблон проти зібраного `dist` —
  // рівно того, що бачить магазин. Кореневий `typecheck` шаблон не бачить
  // (він виключений із `tsconfig.json`), тож без цього кроку в реєстр їде
  // шаблон, з якого магазин може не зібратись.
  { name: 'typecheck:template', cmd: 'pnpm typecheck:template' },
  { name: 'test:packaging', cmd: 'pnpm test:packaging' },
  // 🔴 Повний `pnpm pilot` (Gate A–D, SB, IP, CLI, TOOL), а НЕ `pilot:pack`: Gate B —
  // єдиний доказ, що серверний бандл свіжого магазину СТАРТУЄ. `pilot:pack` без БД
  // його не піднімає, і дефект вклеєного `pg` (UPSTREAM:START-IP-1) сидів у
  // 0.7.0–0.13.0 непоміченим (К3-Е7, Task 11). БД і сід — `pilot-full.mjs`
  // (`pnpm harness:up` + `db:demo`); Gate B не скорочується. Gate C пілота лишається
  // доказом межі клієнт/сервер у реальному клієнтському бандлі.
  { name: 'pilot', cmd: 'node scripts/release/pilot-full.mjs' },
];

/**
 * Виконати один гейт. Вивід глушиться (`stdio: 'pipe'`), але при падінні йде в помилку
 * повністю — інакше причина фейлу лишилась би невидимою.
 *
 * 🔴 `maxBuffer` явний: дефолт `execSync` — 1 МіБ НА ПОТІК, а найбалакучіший
 * гейт `pilot` (збирає скретч-магазин: `pnpm pack` × 5, install, `vite build`) дає
 * 172 КБ stdout на ЗЕЛЕНОМУ прогоні (вимір 2026-09-03), тобто запас лише ×6. Балакучий
 * саме червоний прогін — і переповнення обірвало б вивід `ENOBUFS`-ом, сховавши
 * справжню причину фейлу за помилкою, що коду не стосується.
 */
export function execGate(gate) {
  try {
    execSync(gate.cmd, {
      stdio: 'pipe',
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch (error) {
    const output = `${error.stdout ?? ''}${error.stderr ?? ''}`;
    throw new Error(`Гейт «${gate.name}» червоний.\n\n${output.slice(-4000)}`, {
      cause: error,
    });
  }
}

/** Прогнати всі гейти релізу по черзі. Перший червоний зупиняє реліз. */
export function runGates({ log }) {
  for (const [index, gate] of GATES.entries()) {
    log(`  [${index + 1}/${GATES.length}] ${gate.name}…`);
    try {
      execGate(gate);
    } catch (error) {
      throw new Error(
        `${error.message.replace('червоний.', 'червоний — реліз зупинено.')}`,
        { cause: error },
      );
    }
  }
}
