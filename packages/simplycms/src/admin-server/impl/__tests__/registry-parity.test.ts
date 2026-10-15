// І24: кожна операція реєстру має РІВНО одну serverFn-обгортку й доступна через
// HTTP. Тест у `admin-server/impl`, а не в `operations`: тір `operations` не
// імпортує `admin-server`, де живе реєстр.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbRow = vi.hoisted(() => ({ scopes: [] as string[] }));
vi.mock('simplycms/auth', async (orig) => ({
  ...(await orig<typeof import('simplycms/auth')>()),
  readUserRoles: vi.fn(async () => ['admin']),
  readSessionSubject: vi.fn(async () => null),
}));
vi.mock('simplycms/db', async (orig) => ({
  ...(await orig<typeof import('simplycms/db')>()),
  asService: vi.fn(async () => ({
    id: 't1',
    userId: 'u1',
    scopes: dbRow.scopes,
  })),
}));
// Виконавець не потрібен: паритет питає «операцію знайдено?», а не «що вона робить».
vi.mock('../../../operations/execute', () => ({
  executeOperation: vi.fn(async () => ({ replayed: false, output: null })),
}));

import * as impl from 'simplycms/admin-server/impl';
import { handleApiRequest } from '../../../operations/http/handle';
import { generateToken } from '../../../operations/http/token-auth';
import adminServerSource from '../../index.ts?raw';

const { CORE_OPERATIONS, getOperation } = impl;
const TOKEN_OPS = [
  'api-tokens.create',
  'api-tokens.list',
  'api-tokens.revoke',
  'service-accounts.create',
];

/** Імена експортів impl, що вказують саме на цю операцію (обгортка імпортує за ім'ям). */
const exportNames = (def: unknown) =>
  Object.entries(impl)
    .filter(([, v]) => v === def)
    .map(([k]) => k);

/** Скільки обгорток передає `name` в `invokeFromServerFn`. */
const wrapperCount = (name: string) =>
  [...adminServerSource.matchAll(/invokeFromServerFn\((\w+), data\)/g)].filter(
    (m) => m[1] === name,
  ).length;

describe('паритет реєстру операцій (І24): serverFn', () => {
  it.each(CORE_OPERATIONS.map((d) => [d.id, d] as const))(
    '%s: рівно одна обгортка в admin-server/index.ts',
    (_id, def) => {
      const names = exportNames(def);
      expect(names).not.toEqual([]);
      expect(names.reduce((n, k) => n + wrapperCount(k), 0)).toBe(1);
    },
  );

  it('навпаки: кожна обгортка посилається на операцію реєстру', () => {
    const used = [
      ...adminServerSource.matchAll(/invokeFromServerFn\((\w+), data\)/g),
    ].map((m) => m[1]!);
    expect(used.length).toBeGreaterThan(0);
    for (const name of used)
      expect(CORE_OPERATIONS).toContain(
        (impl as Record<string, unknown>)[name],
      );
  });

  it('усі чотири операції токенів — sessionOnly', () => {
    for (const id of TOKEN_OPS)
      expect(getOperation(id)?.sessionOnly, id).toBe(true);
  });
});

describe('паритет реєстру операцій (І24): HTTP', () => {
  beforeEach(() => {
    dbRow.scopes = CORE_OPERATIONS.map((d) => d.id);
  });
  const call = async (id: string) =>
    handleApiRequest(
      new Request(`https://shop.test/api/v1/${id}`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${generateToken().token}`,
        },
        body: '{}',
      }),
      id,
      getOperation,
    );

  it.each(CORE_OPERATIONS.map((d) => [d.id] as const))(
    '%s: операцію знайдено; sessionOnly ⇒ Bearer адміна дає 403 forbidden',
    async (id) => {
      const res = await call(id);
      const kind = (
        await res
          .clone()
          .json()
          .catch(() => null)
      )?.kind;
      expect(kind).not.toBe('unknown_operation');
      if (getOperation(id)!.sessionOnly) {
        expect(res.status).toBe(403);
        expect(kind).toBe('forbidden');
      } else {
        expect(res.status).not.toBe(404);
      }
    },
  );
});
