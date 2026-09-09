import { beforeEach, describe, expect, it, vi } from 'vitest';

// Патерн мока Start-server — як у storefront-routes/__tests__/revalidate-theme.test.ts
const setResponseStatus = vi.fn();
vi.mock('@tanstack/react-start/server', () => ({
  getRequest: () => ({ headers: new Headers() }),
  setResponseStatus: (...a: unknown[]) => setResponseStatus(...a),
}));

let subject: unknown = null;
vi.mock('../session', () => ({
  readSessionSubject: vi.fn(async () => subject),
}));

import { AuthzError } from '../authz';
import { requireGrant, resolveRequestGrant } from '../authz-request';

describe('authz-request (К3-13)', () => {
  beforeEach(() => {
    subject = null;
    setResponseStatus.mockClear();
  });

  it('анонім на catalog.write — AuthzError', async () => {
    await expect(resolveRequestGrant('catalog.write')).rejects.toBeInstanceOf(
      AuthzError,
    );
  });

  it('admin на catalog.write — scope any і той самий субʼєкт', async () => {
    subject = { userId: 'u1', roles: ['admin'], email: 'a@b', name: null };
    const grant = await resolveRequestGrant('catalog.write');
    expect(grant.scope).toBe('any');
    expect(grant.subject.userId).toBe('u1');
  });

  it('user на order.read — scope own (склейка НЕ зʼїдає scope)', async () => {
    subject = { userId: 'u2', roles: ['user'], email: 'c@d', name: null };
    const grant = await resolveRequestGrant('order.read');
    expect(grant.scope).toBe('own');
  });

  it('requireGrant при відмові ставить 403 ДО прокидання', async () => {
    await expect(requireGrant('catalog.write')).rejects.toBeInstanceOf(
      AuthzError,
    );
    expect(setResponseStatus).toHaveBeenCalledWith(403);
  });

  it('requireGrant при дозволі статус не чіпає', async () => {
    subject = { userId: 'u1', roles: ['admin'], email: 'a@b', name: null };
    await requireGrant('catalog.write');
    expect(setResponseStatus).not.toHaveBeenCalled();
  });
});
