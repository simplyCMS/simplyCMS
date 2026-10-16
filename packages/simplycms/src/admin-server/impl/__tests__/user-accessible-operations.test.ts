import { describe, expect, it } from 'vitest';
import { AUTHZ_MATRIX } from 'simplycms/auth';
import { CORE_OPERATIONS } from 'simplycms/admin-server/impl';
import { USER_ACCESSIBLE_OPERATIONS } from './user-accessible-operations';

// Механічна гарантія: операція реєстру, чиє право дає щось ролі `user`, має
// запис-обґрунтування у знімку; зайвий запис теж червоний.
describe('операції реєстру, доступні покупцю', () => {
  const actual = CORE_OPERATIONS.filter(
    (op) => AUTHZ_MATRIX[op.permission].user !== undefined,
  )
    .map((op) => op.id)
    .sort();

  it('перелік збігається зі знімком', () => {
    expect(actual).toEqual(Object.keys(USER_ACCESSIBLE_OPERATIONS).sort());
  });

  it('кожен запис знімка має непорожню причину', () => {
    for (const [id, reason] of Object.entries(USER_ACCESSIBLE_OPERATIONS))
      expect(reason.trim(), id).not.toBe('');
  });
});
