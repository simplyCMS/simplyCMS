import { describe, expect, it, vi } from 'vitest';
import {
  buildUserProvision,
  createUserCreateHook,
  splitName,
  SIGNUP_ROLE,
} from '../hooks';
import type { UserProvisionPlan } from '../hooks';

// Порт `handle_new_user` у TS (B3′, Task 7).

describe('splitName: одне поле BA → пара полів profiles', () => {
  it.each([
    [undefined, null, null],
    ['', null, null],
    ['   ', null, null],
    ['Оксана', 'Оксана', null],
    ['Оксана Коваль', 'Оксана', 'Коваль'],
    // Решта рядка йде в прізвище цілком — склеювання назад дає оригінал.
    ['Оксана Коваль-Іваненко Молодша', 'Оксана', 'Коваль-Іваненко Молодша'],
    ['  Оксана   Коваль  ', 'Оксана', 'Коваль'],
  ])('%s → %s / %s', (input, firstName, lastName) => {
    expect(splitName(input)).toEqual({ firstName, lastName });
  });
});

describe('buildUserProvision: інваріант first_user_no_auto_admin', () => {
  it('новий користувач отримує роль user', () => {
    expect(
      buildUserProvision({ id: 'u-1', email: 'a@example.test', name: 'А Б' }),
    ).toEqual({
      userId: 'u-1',
      email: 'a@example.test',
      firstName: 'А',
      lastName: 'Б',
      role: 'user',
    });
  });

  it('роль — КОНСТАНТА, а не результат умови', () => {
    // 🔴 Гвіздок аудиту 2026-08-04: діра «хто перший встиг» була саме умовою
    // («якщо адмінів ще немає — зроби адміном»). Функція не приймає жодного
    // контексту, з якого таку умову можна було б зібрати, — тож тест фіксує
    // не значення, а ВІДСУТНІСТЬ входу для регресії.
    expect(SIGNUP_ROLE).toBe('user');
    expect(buildUserProvision.length).toBe(1);
    const plans = ['перший', 'другий', 'третій'].map((name, index) =>
      buildUserProvision({ id: `u-${index}`, email: `${index}@t.test`, name }),
    );
    expect(plans.map((plan) => plan.role)).toEqual(['user', 'user', 'user']);
  });
});

describe('createUserCreateHook', () => {
  it('віддає план у порт провізії', async () => {
    const calls: UserProvisionPlan[] = [];
    const hook = createUserCreateHook(async (plan) => {
      calls.push(plan);
    });

    await hook({ id: 'u-9', email: 'o@example.test', name: 'Оксана Коваль' });

    expect(calls).toEqual([
      {
        userId: 'u-9',
        email: 'o@example.test',
        firstName: 'Оксана',
        lastName: 'Коваль',
        role: 'user',
      },
    ]);
  });

  it('помилка провізії НЕ ковтається', async () => {
    // Тихий catch тут дав би найгірший стан: користувач є, профілю немає, і
    // магазин дізнається про це аж на першому замовленні.
    const boom = new Error('немає звʼязку з БД');
    const hook = createUserCreateHook(vi.fn().mockRejectedValue(boom));

    await expect(hook({ id: 'u-1', email: 'a@t.test' })).rejects.toBe(boom);
  });
});
