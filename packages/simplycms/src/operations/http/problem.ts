import {
  DOMAIN_ERROR_NAME,
  type AdminConflictError,
  type DomainErrorName,
  type InUseError,
  type SourceChangedError,
  type ValidationError,
  type VersionMismatchError,
} from 'simplycms/contracts/domain-errors';
import {
  PROBLEM_STATUS,
  TITLE,
  type ProblemBody,
  type ProblemExtra,
  type ProblemKind,
} from './problem-kinds';

export { PROBLEM_STATUS };
export type { ProblemBody, ProblemKind };

type Extra = ProblemExtra;

/** Відмова, яку кидає сам HTTP-шар (ідемпотентність): має власний `kind`. */
export class ProblemError extends Error {
  constructor(
    readonly kind: ProblemKind,
    readonly extra: Extra = {},
  ) {
    super(`[simplycms/operations] ${kind}`);
  }
}

type Mapped = { kind: ProblemKind; extra?: Extra };

/**
 * Доменна помилка → проблема. `Record<DomainErrorName, …>` робить мапу
 * ВИЧЕРПНОЮ за побудовою: нове ім'я в `DOMAIN_ERROR_NAME` без рядка тут не
 * скомпілюється (інакше воно тихо стало б 500).
 */
const BY_NAME: Record<DomainErrorName, (e: Error) => Mapped> = {
  [DOMAIN_ERROR_NAME.adminConflict]: (e) => ({
    kind:
      (e as AdminConflictError).kind === 'reference' ? 'reference' : 'conflict',
  }),
  [DOMAIN_ERROR_NAME.authz]: () => ({ kind: 'forbidden' }),
  [DOMAIN_ERROR_NAME.validation]: (e) => ({
    kind: 'validation',
    extra: {
      errors: (e as ValidationError).issues.map(({ path, code }) => ({
        path,
        code,
      })),
    },
  }),
  [DOMAIN_ERROR_NAME.notFound]: () => ({ kind: 'not_found' }),
  // Повідомлення `CodedError` — машинний код (`media/bad-format`), не текст.
  [DOMAIN_ERROR_NAME.coded]: (e) => ({
    kind: 'validation',
    extra: { detail: e.message },
  }),
  [DOMAIN_ERROR_NAME.versionMismatch]: (e) => ({
    kind: 'version_mismatch',
    extra: { currentVersion: (e as VersionMismatchError).currentVersion },
  }),
  [DOMAIN_ERROR_NAME.sourceChanged]: (e) => ({
    kind: 'source_changed',
    extra: { currentSourceHashes: (e as SourceChangedError).current },
  }),
  [DOMAIN_ERROR_NAME.inUse]: (e) => ({ kind: (e as InUseError).kind }),
};

const isDomainName = (name: string): name is DomainErrorName =>
  Object.hasOwn(BY_NAME, name);

/** Побудова проблеми за `kind` (для відмов самого адаптера). */
export function buildProblem(
  kind: ProblemKind,
  operation: string,
  extra: Extra = {},
): { status: number; body: ProblemBody } {
  const status = PROBLEM_STATUS[kind];
  return {
    status,
    body: {
      type: `urn:simplycms:problem:${kind}`,
      title: TITLE[kind],
      status,
      kind,
      operation,
      ...extra,
    },
  };
}

/**
 * ЄДИНА карта «помилка → (status, kind)»: її ж читає межа serverFn.
 * 🔴 Усе невідоме — 500 БЕЗ `message`/стека: текст помилки драйвера містить
 * імена таблиць і роль (І29).
 */
export function toProblem(
  error: unknown,
  operation: string,
): { status: number; body: ProblemBody } {
  if (error instanceof ProblemError)
    return buildProblem(error.kind, operation, error.extra);
  if (error instanceof Error && isDomainName(error.name)) {
    const { kind, extra } = BY_NAME[error.name](error);
    return buildProblem(kind, operation, extra);
  }
  return buildProblem('internal', operation);
}

/** HTTP-відповідь `application/problem+json`. */
export function problemResponse(
  kind: ProblemKind,
  operation: string,
  headers: Record<string, string> = {},
): Response {
  const { status, body } = buildProblem(kind, operation);
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/problem+json', ...headers },
  });
}

/** Відповідь за помилкою; невідомі йдуть у лог, а не в тіло. */
export function errorResponse(error: unknown, operation: string): Response {
  const { status, body } = toProblem(error, operation);
  if (status === 500)
    console.error('[api/v1] внутрішня помилка', operation, error);
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/problem+json' },
  });
}
