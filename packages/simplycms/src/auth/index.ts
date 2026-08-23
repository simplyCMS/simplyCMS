/**
 * `simplycms/auth` — серверний auth-контур v2 (B3′, Task 7, В2-К1а).
 *
 * 🔴 Контур побудований ПОРУЧ із чинним GoTrue-шляхом і ще нікуди не
 * підключений: `src/start.ts`, `/auth/confirm` і `simplycms/supabase`
 * лишаються чинними до К1′б. Це навмисна адитивність — точка неповернення
 * планується окремо.
 *
 * 🔴 `./drizzle-proxy` і `./provision` тут НЕ реекспортуються: перший —
 * деталь того, як адаптер BA дістає транзакцію, другий уже прибінджений
 * дефолтом усередині `createAuth`. Назовні виходить рівно те, що споживач
 * мусить назвати сам: інстанс, порти, чисті функції — і `ownerInviteStore`,
 * бо invite нікуди не прибінджений і без сховища не запускається.
 */
export { createAuth, getAuth, resetAuth } from './instance';
export type { AuthDeps, SimplyAuth } from './instance';

export { resolveAuthSecret, resolveAuthBaseUrl } from './env';
export type { AuthEnv } from './env';

export {
  buildUserProvision,
  createUserCreateHook,
  splitName,
  SIGNUP_ROLE,
} from './hooks';
export type { NewAuthUser, ProvisionUser, UserProvisionPlan } from './hooks';

export {
  issueOwnerInvite,
  verifyOwnerInvite,
  inviteIdentifier,
} from './invite';
export type {
  InviteRejection,
  IssueOwnerInviteInput,
  OwnerInviteResult,
  OwnerInviteStore,
  VerifyOwnerInviteResult,
} from './invite';

export { ownerInviteStore, hasAnyAdmin } from './invite-store';

export { renderInviteEmail } from './invite-email';
export type {
  InviteEmail,
  InviteEmailInput,
  SendInviteEmail,
} from './invite-email';

export {
  AUTHZ_MATRIX,
  AuthzError,
  can,
  dbRoleFor,
  dbRoleForSubject,
  requireOperation,
  requireRole,
  resolveGrant,
} from './authz';
export type { AppRole, AuthScope, AuthzSubject, Operation } from './authz';
