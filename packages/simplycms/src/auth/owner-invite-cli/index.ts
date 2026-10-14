/**
 * 🔴 Server-only (під `auth` у contracts/server-only): CLI запрошення власника
 * `pnpm owner:invite` (F5 рев'ю Е8). Живе в `auth`, бо кличе той самий
 * `issueOwnerInvite` і має ті самі залежності (`mail`, `env`, `i18n`, `db`); в
 * `@simplycms/cli` йому не місце — той лише devDependency магазину. Окремий
 * субшлях, а не барель `simplycms/auth`: читання `.env*` і CLI-тексти не мають
 * їхати в серверний бандл. У магазині — шим `scripts/owner-invite.mjs`.
 */
export { runOwnerInvite, type RunOwnerInviteOptions } from './run';
export {
  resolveInviteLocale,
  runOwnerInviteCli,
  type OwnerInviteCliOptions,
} from './cli';
export { loadEnvFiles } from './env-files';
export { ownerInviteMain } from './main';
