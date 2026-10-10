// С-10: статус відповіді ставить МЕЖА операції (`runAdminTransactions`), а не
// ядро. Ядро, викликане поза HTTP-запитом (сід, порти, майбутній MCP-сервер
// магазину), мусить кидати саме доменну помилку, а не падати на відсутньому
// контексті запиту — тому `@tanstack/react-start/server` тут НЕ мокається:
// справжній `setResponseStatus` поза запитом кидає власний виняток, і
// повернення його виклику в ядро цей тест ловить.
import { describe, expect, it } from 'vitest';
import { ADMIN_STATE_CONSTRAINT } from 'simplycms/contracts/domain-errors';
import {
  AdminConflictError,
  ValidationError,
  stateConflict,
  toAdminConflict,
} from '../errors';
import { fieldIssue } from '../validation';

const pgError = (code: string, constraint: string) =>
  Object.assign(new Error('Failed query: insert …'), {
    cause: Object.assign(new Error('duplicate key'), { code, constraint }),
  });

describe('ядро поза запитом (С-10)', () => {
  it('stateConflict кидає AdminConflictError, а не помилку контексту запиту', () => {
    const err = (() => {
      try {
        stateConflict(ADMIN_STATE_CONSTRAINT.customerNotFound);
      } catch (e) {
        return e;
      }
    })();
    expect(err).toBeInstanceOf(AdminConflictError);
    expect(err).toMatchObject({
      kind: 'state',
      constraint: ADMIN_STATE_CONSTRAINT.customerNotFound,
    });
  });

  it('fieldIssue кидає ValidationError з issue поля', () => {
    expect(() => fieldIssue(['email'], 'taken')).toThrow(ValidationError);
  });

  it('toAdminConflict лише повертає помилку, без побічного ефекту', () => {
    expect(toAdminConflict(pgError('23505', 'users_email_key'))).toMatchObject({
      kind: 'unique',
      constraint: 'users_email_key',
    });
  });
});
