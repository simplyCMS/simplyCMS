// І29: problem+json не витікає сирим вводом, стеком чи текстом БД; одна карта
// «помилка → (status, kind)» для HTTP і serverFn.
import { describe, expect, it } from 'vitest';
import { AuthzError } from 'simplycms/auth';
import {
  AdminConflictError,
  AdminNotFoundError,
  CodedError,
  DOMAIN_ERROR_NAME,
  InUseError,
  SourceChangedError,
  ValidationError,
  VersionMismatchError,
  type DomainErrorName,
} from 'simplycms/contracts/domain-errors';
import {
  PROBLEM_STATUS,
  ProblemError,
  problemResponse,
  toProblem,
  type ProblemKind,
} from '../http/problem';
import { methodNotAllowed } from '../http/handle';

describe('toProblem (І29)', () => {
  it('невідома помилка → 500 internal без жодних деталей БД', () => {
    const { status, body } = toProblem(
      new Error('pg: relation x'),
      'languages.add',
    );
    expect(status).toBe(500);
    expect(body).toMatchObject({
      kind: 'internal',
      operation: 'languages.add',
    });
    expect(JSON.stringify(body)).not.toContain('relation');
    expect(body).not.toHaveProperty('detail');
    expect(body).not.toHaveProperty('message');
  });

  it('не-Error (рядок) → 500', () => {
    expect(toProblem('boom', 'x.y').status).toBe(500);
  });

  const cases: [string, unknown, ProblemKind][] = [
    ['ValidationError', new ValidationError([]), 'validation'],
    ['AuthzError', new AuthzError('x'), 'forbidden'],
    ['AdminNotFoundError', new AdminNotFoundError('мова'), 'not_found'],
    [
      'AdminConflictError unique',
      new AdminConflictError('unique', 'k'),
      'conflict',
    ],
    [
      'AdminConflictError state',
      new AdminConflictError('state', 'k'),
      'conflict',
    ],
    [
      'AdminConflictError reference',
      new AdminConflictError('reference', 'k'),
      'reference',
    ],
    [
      'InUseError language_in_use',
      new InUseError('language_in_use'),
      'language_in_use',
    ],
    ['InUseError reference', new InUseError('reference'), 'reference'],
    [
      'SourceChangedError',
      new SourceChangedError('en', { title: 'h' }),
      'source_changed',
    ],
    ['VersionMismatchError', new VersionMismatchError(3), 'version_mismatch'],
    [
      'ProblemError in_flight',
      new ProblemError('idempotency_in_flight'),
      'idempotency_in_flight',
    ],
    [
      'ProblemError mismatch',
      new ProblemError('idempotency_mismatch'),
      'idempotency_mismatch',
    ],
  ];
  it.each(cases)('%s → свій kind і статус таблиці', (_n, error, kind) => {
    const { status, body } = toProblem(error, 'op.x');
    expect(body.kind).toBe(kind);
    expect(status).toBe(PROBLEM_STATUS[kind]);
    expect(body.type).toBe(`urn:simplycms:problem:${kind}`);
  });

  it('400 несе лише path і code, без сирого вводу', () => {
    const { body } = toProblem(
      new ValidationError([
        { path: ['name'], code: 'too_small', params: { minimum: 1 } },
      ]),
      'op.x',
    );
    expect(body.errors).toEqual([{ path: ['name'], code: 'too_small' }]);
  });

  it('412 і 409 source_changed несуть поточний стан', () => {
    expect(
      toProblem(new VersionMismatchError(7), 'o.p').body.currentVersion,
    ).toBe(7);
    expect(
      toProblem(new SourceChangedError('en', { title: 'h' }), 'o.p').body
        .currentSourceHashes,
    ).toEqual({ title: 'h' });
  });

  it('kind кожного статусу майстра §3.3 має рядок таблиці', () => {
    expect(PROBLEM_STATUS).toMatchObject({
      unauthenticated: 401,
      unknown_operation: 404,
      method_not_allowed: 405,
      idempotency_in_flight: 409,
      unsupported_media_type: 415,
      idempotency_mismatch: 422,
      internal: 500,
    });
  });
});

/** Екземпляр на КОЖНЕ ім'я родини: `Record` не скомпілюється, якщо ім'я додали без рядка. */
const SAMPLE: Record<DomainErrorName, Error> = {
  [DOMAIN_ERROR_NAME.adminConflict]: new AdminConflictError('unique', null),
  [DOMAIN_ERROR_NAME.authz]: new AuthzError('x'),
  [DOMAIN_ERROR_NAME.validation]: new ValidationError([]),
  [DOMAIN_ERROR_NAME.notFound]: new AdminNotFoundError('x'),
  [DOMAIN_ERROR_NAME.coded]: new CodedError('media/bad-format'),
  [DOMAIN_ERROR_NAME.versionMismatch]: new VersionMismatchError(1),
  [DOMAIN_ERROR_NAME.sourceChanged]: new SourceChangedError('en', {}),
  [DOMAIN_ERROR_NAME.inUse]: new InUseError('reference'),
};

describe('вичерпність карти доменних помилок', () => {
  it.each(Object.values(DOMAIN_ERROR_NAME))(
    '%s має запис із не-500 статусом',
    (name) => {
      expect(SAMPLE[name]!.name).toBe(name);
      expect(toProblem(SAMPLE[name], 'op.x').status).not.toBe(500);
    },
  );
});

describe('problemResponse / 405', () => {
  it('405 → problem+json із Allow', async () => {
    const res = methodNotAllowed('POST');
    expect(res.status).toBe(405);
    expect(res.headers.get('allow')).toBe('POST');
    expect(res.headers.get('content-type')).toBe('application/problem+json');
    expect((await res.json()).kind).toBe('method_not_allowed');
  });

  it('401 несе WWW-Authenticate, коли його передали', () => {
    const res = problemResponse('unauthenticated', 'x.y', {
      'www-authenticate': 'Bearer',
    });
    expect(res.status).toBe(401);
    expect(res.headers.get('www-authenticate')).toBe('Bearer');
  });
});
