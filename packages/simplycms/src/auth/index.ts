/**
 * `simplycms/auth` — серверний auth-контур v2 (B3′, Task 7, В2-К1а).
 *
 * 🔴 К1′б: контур ПІДКЛЮЧЕНО. GoTrue знесено — `src/start.ts` питає ролі
 * звідси, роут `/api/auth/$` віддає запити хендлеру Better Auth, а клієнт
 * вітрини живе на `better-auth/react`. Модулів `/auth/confirm` і
 * `/auth/callback` більше немає.
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

export { acceptOwnerInvite } from './accept-invite';
export type {
  AcceptInviteRejection,
  AcceptOwnerInviteInput,
  AcceptOwnerInviteResult,
} from './accept-invite';

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

export { renderInviteEmail, renderResetPasswordEmail } from './invite-email';
export type {
  InviteEmail,
  InviteEmailInput,
  ResetPasswordEmailInput,
  SendInviteEmail,
} from './invite-email';

export { stubSendAuthEmail } from './send-email';
export type { SendAuthEmail } from './send-email';

export { isAdminRequest, readSessionSubject, readUserRoles } from './session';
export type { SessionSubject } from './session';

export { requireGrant, resolveRequestGrant } from './authz-request';
export type { RequestGrant } from './authz-request';

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
