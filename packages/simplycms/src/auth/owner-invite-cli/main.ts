import { closeDbPool } from 'simplycms/db';
import { runOwnerInviteCli } from './cli';
import { loadEnvFiles } from './env-files';

type MainOptions = {
  /** Цільовий env; за замовчуванням `process.env`. */
  env?: Record<string, string | undefined>;
  /** Файли наповнення відносно cwd; за замовчуванням `.env.local`, `.env`. */
  files?: readonly string[];
};

/**
 * Проводка `pnpm owner:invite` для шима магазину `scripts/owner-invite.mjs`:
 * шим лишається кількома рядками під `simplycms update`, а поведінка
 * оновлюється разом із ядром.
 *
 * 🔴 Контракт env — серверний (спека CLI v1 §7): читається лише `process.env`,
 * а `.env.local`/`.env` служать способом його наповнити (паритет із
 * `server.mjs`: реальний env > `.env.local` > `.env`). Ключ підключення один —
 * `DATABASE_URL`.
 *
 * @returns код виходу
 */
export async function ownerInviteMain(
  argv: readonly string[],
  { env = process.env, files }: MainOptions = {},
): Promise<number> {
  loadEnvFiles(env, files);
  try {
    return await runOwnerInviteCli({ argv, env });
  } finally {
    // Без цього процес висів би на відкритому пулі Postgres.
    await closeDbPool();
  }
}
