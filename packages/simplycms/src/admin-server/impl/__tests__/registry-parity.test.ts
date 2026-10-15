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
// Виконавець підмінено мінімально: перевіряє ЛИШЕ вхід за схемою операції (як
// справжній, 400 на невалідному) і не чіпає БД. Паритет питає «операцію
// знайдено й доступну?», а не «що вона робить».
vi.mock('../../../operations/execute', async () => {
  const { ValidationError } = await import('simplycms/contracts/domain-errors');
  return {
    executeOperation: vi.fn(
      async (def: { input: import('zod').ZodType }, body: unknown) => {
        const parsed = def.input.safeParse(body);
        if (!parsed.success) throw new ValidationError([]);
        return { replayed: true, status: 200, body: { ok: true } };
      },
    ),
  };
});

import * as impl from 'simplycms/admin-server/impl';
import { handleApiRequest } from '../../../operations/http/handle';
import { generateToken } from '../../../operations/http/token-auth';
import tseslint from 'typescript-eslint';
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

/** Усі `invokeFromServerFn(<ідентифікатор>, …)` у файлі — за AST, а не за текстом. */
function wrapperTargets(source: string): string[] {
  // Типи `typescript-eslint` оголошують `parseForESLint` з одним аргументом.
  const parser = tseslint.parser as unknown as {
    parseForESLint(code: string, options: object): { ast: { body: unknown } };
  };
  const { ast } = parser.parseForESLint(source, { sourceType: 'module' });
  const out: string[] = [];
  const walk = (n: unknown): void => {
    if (Array.isArray(n)) return n.forEach(walk);
    if (!n || typeof n !== 'object') return;
    const node = n as Record<string, unknown> & { type?: string };
    if (node.type === 'CallExpression') {
      const c = node.callee as { type: string; name?: string };
      const a = (node.arguments as { type: string; name?: string }[])[0];
      if (c.name === 'invokeFromServerFn' && a?.type === 'Identifier')
        out.push(a.name!);
    }
    for (const [k, v] of Object.entries(node))
      if (k !== 'parent' && k !== 'loc' && k !== 'range') walk(v);
  };
  walk(ast.body);
  return out;
}
const targets = wrapperTargets(adminServerSource);
/** Скільки обгорток передає `name` в `invokeFromServerFn`. */
const wrapperCount = (name: string) => targets.filter((t) => t === name).length;

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
    expect(targets.length).toBeGreaterThan(0);
    for (const name of targets)
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
    '%s: операцію знайдено, статус відповідає категорії',
    async (id) => {
      const def = getOperation(id)!;
      const res = await call(id);
      const kind = (await res.clone().json())?.kind;
      expect(kind).not.toBe('unknown_operation');
      if (def.sessionOnly) {
        // Токен не керує токенами: Bearer адміна — рівно 403.
        expect(res.status).toBe(403);
        expect(kind).toBe('forbidden');
      } else {
        // Автентифікація й права пройшли (не 401/403/404): порожнє тіло дає
        // 200, якщо схема входу його приймає, і 400 `validation`, якщо ні.
        const accepts = def.input.safeParse({}).success;
        expect(res.status).toBe(accepts ? 200 : 400);
      }
    },
  );
});
