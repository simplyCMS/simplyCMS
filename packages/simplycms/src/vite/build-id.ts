import { execSync } from 'node:child_process';

/**
 * Ідентифікатор збірки: один для SSR- і клієнтського проходів тієї самої
 * збірки. Порядок: явний `BUILD_ID` → `SOURCE_COMMIT` (перші 12) → `git
 * rev-parse --short HEAD` (лише `build`) → `t<base36 часу>`. У dev — `'dev'`:
 * бандл і сервер там один код, а `define` без значення дає той самий `'dev'`
 * (guard у `runtime/build-id.ts`).
 *
 * 🔴 Мемоізація обовʼязкова, і значення пишеться в `process.env.BUILD_ID`:
 * конфіг Vite резолвиться не раз (клієнтське й SSR-оточення), а різні
 * `Date.now()` дали б клієнту й серверу різні id — тоді кожна вкладка бачила б
 * постійний фальшивий «застарілий чанк». Dokploy не виставляє змінної з
 * комітом, тож без `BUILD_ID` і без `.git` у збірці лишається час збірки.
 */
export type BuildIdEnv = Readonly<Record<string, string | undefined>>;

export interface BuildIdContext {
  /** `command` Vite: `build` | `serve`. */
  command: string;
  /** Тека, де шукати `.git` (корінь магазину). */
  cwd: string;
}

let memo: string | undefined;

export function resolveBuildId(
  env: BuildIdEnv,
  { command, cwd }: BuildIdContext,
): string {
  memo ??= compute(env, command, cwd);
  // Дочірні процеси збірки (інша копія конфігу) читають те саме значення.
  if (command === 'build') process.env.BUILD_ID = memo;
  return memo;
}

function compute(env: BuildIdEnv, command: string, cwd: string): string {
  if (command !== 'build') return 'dev';
  const fromEnv = env.BUILD_ID || env.SOURCE_COMMIT;
  if (fromEnv) return fromEnv.slice(0, 12);
  try {
    return execSync('git rev-parse --short HEAD', {
      cwd,
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim();
  } catch {
    return `t${Date.now().toString(36)}`;
  }
}
