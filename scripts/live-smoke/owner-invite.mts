/**
 * Випуск запрошення власника для живого прогону (К3-Е3, Task 13 Step 1).
 *
 * `.mts`, бо `tsx` поза пакетом (`scripts/` — не `packages/simplycms/`) бере
 * CJS і падає на top-level await (v2-state-map §5). Лист — заглушка: доставку
 * SMTP контур не доводить (борг №1 / К1а-6), URL для браузера беремо з
 * результату `issueOwnerInvite`.
 *
 * Env — ТОЙ САМИЙ, яким стартує магазин (`DATABASE_URL` під `app_runtime`):
 * оркестрація (`admin-catalog.mjs`) передає його явно через `env` дочірнього
 * процесу, а не через `.env.local` (контракт серверного env, CLAUDE.md).
 *
 *   pnpm exec tsx scripts/live-smoke/owner-invite.mts <email> <siteUrl>
 */
import {
  issueOwnerInvite,
  ownerInviteStore,
} from '../../packages/simplycms/src/auth/index.ts';
import { closeDbPool } from '../../packages/simplycms/src/db/index.ts';

const [email, siteUrl] = process.argv.slice(2);
if (!email || !siteUrl) {
  throw new Error('usage: owner-invite.mts <email> <siteUrl>');
}

const result = await issueOwnerInvite({
  email,
  store: ownerInviteStore,
  siteUrl,
  // Живий прогін не доводить доставку листа (борг №1) — URL читаємо з
  // результату виклику, а не з поштової скриньки.
  sendEmail: async () => {},
});

// Без явного закриття пулу `pg` процес не завершиться (відкритий сокет).
await closeDbPool();

process.stdout.write(JSON.stringify({ url: result.url }));
