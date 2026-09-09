import { describe, expect, it } from 'vitest';
import {
  AUTHZ_MATRIX,
  AuthzError,
  can,
  dbRoleFor,
  dbRoleForSubject,
  requireOperation,
  requireRole,
  resolveGrant,
  type AuthzSubject,
  type Operation,
} from '../authz';

// Перший рубіж моделі безпеки B5″ — типізований authz (Task 7, В2-К1а).
//
// 🔴 Матриця асертиться не «чи є ключ», а ПОВЕДІНКОЮ на кожному з трьох
// субʼєктів: анонім, покупець, адмін. Тест, що переказував би структуру
// `AUTHZ_MATRIX`, лишався б зеленим після будь-якої зміни самої матриці.

const ANON: AuthzSubject = { userId: null, roles: [] };
const USER: AuthzSubject = { userId: 'u-1', roles: ['user'] };
const ADMIN: AuthzSubject = { userId: 'a-1', roles: ['admin'] };
const BOTH: AuthzSubject = { userId: 'a-2', roles: ['user', 'admin'] };

const OPERATIONS = Object.keys(AUTHZ_MATRIX) as Operation[];

describe('authz: матриця «роль × операція»', () => {
  it.each(OPERATIONS)('анонім не може %s', (operation) => {
    expect(resolveGrant(ANON, operation)).toBeNull();
    expect(can(ANON, operation)).toBe(false);
  });

  it('покупець отримує лише свої рядки там, де це його дані', () => {
    expect(resolveGrant(USER, 'order.read')).toBe('own');
    expect(resolveGrant(USER, 'profile.update')).toBe('own');
    // Каталог — не «його дані», тож звужувати нема до чого.
    expect(resolveGrant(USER, 'catalog.read')).toBe('any');
  });

  it('адмінські операції покупцю закриті', () => {
    for (const operation of [
      'catalog.write',
      'review.moderate',
      'user.role.assign',
      'admin.access',
    ] as Operation[]) {
      expect(can(USER, operation), operation).toBe(false);
      expect(can(ADMIN, operation), operation).toBe(true);
    }
  });

  it('кілька ролей дають НАЙШИРШИЙ scope, а не перший знайдений', () => {
    // Порядок ролей у субʼєкті довільний — результат не має від нього
    // залежати, інакше права «мерехтіли б» від порядку рядків у user_roles.
    expect(resolveGrant(BOTH, 'order.read')).toBe('any');
    expect(
      resolveGrant({ ...BOTH, roles: ['admin', 'user'] }, 'order.read'),
    ).toBe('any');
  });
});

describe('authz: хелпери відмови', () => {
  it('requireOperation повертає scope, а не void', () => {
    expect(requireOperation(USER, 'order.read')).toBe('own');
    expect(requireOperation(ADMIN, 'order.read')).toBe('any');
  });

  it('відмова — AuthzError, а не звичайний Error', () => {
    expect(() => requireOperation(USER, 'admin.access')).toThrow(AuthzError);
    expect(() => requireRole(USER, 'admin')).toThrow(AuthzError);
    expect(() => requireRole(ADMIN, 'admin')).not.toThrow();
  });
});

describe('authz: міст до другого рубежу (ролі БД)', () => {
  it('доменна роль мапиться в роль БД', () => {
    expect(dbRoleFor('admin')).toBe('app_admin');
    expect(dbRoleFor('user')).toBe('app_user');
  });

  it('субʼєкт без ролі адміна працює як app_user', () => {
    expect(dbRoleForSubject(ANON)).toBe('app_user');
    expect(dbRoleForSubject(USER)).toBe('app_user');
    expect(dbRoleForSubject(BOTH)).toBe('app_admin');
  });
});
