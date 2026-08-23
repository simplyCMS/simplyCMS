import { memoryAdapter } from 'better-auth/adapters/memory';
import { beforeEach, describe, expect, it } from 'vitest';
import { createAuth } from '../instance';
import type { UserProvisionPlan } from '../hooks';

// Інстанс Better Auth на memory-адаптері (Task 7, В2-К1а).
//
// 🔴 Це і є DoD спеки «BA тестується без Docker» — фактом, а не обіцянкою:
// увесь життєвий цикл сесії (реєстрація → cookie → читання → вихід) тут
// проганяється без Postgres узагалі. Повний контур над реальним PG живе в
// `test-harness/pg/__tests__/auth-integration.test.ts` (гейт `test:schema`).

const BASE = 'http://localhost:3000';
const EMAIL = 'owner@example.test';
const PASSWORD = 'super-secret-password';

/** Свіжий інстанс на порожньому сховищі + журнал викликів провізії. */
function setup() {
  const provisioned: UserProvisionPlan[] = [];
  const auth = createAuth({
    // 🔴 Ключі — імена МОДЕЛЕЙ Better Auth (однина), а не наших таблиць:
    // `usePlural` живе в drizzle-адаптері й memory-адаптера не стосується.
    // Сховище треба завести заздалегідь — memory-адаптер відсутню модель не
    // створює, а падає «Model user not found».
    database: memoryAdapter({
      user: [],
      session: [],
      account: [],
      verification: [],
    }),
    secret: 'test-secret-not-a-real-one',
    baseURL: BASE,
    provisionUser: async (plan) => {
      provisioned.push(plan);
    },
  });
  return { auth, provisioned };
}

/** Cookie із відповіді у форму, придатну для наступного запиту. */
const cookieHeader = (response: Response): string =>
  (response.headers.getSetCookie?.() ?? [])
    .map((raw) => raw.split(';')[0])
    .join('; ');

describe('Better Auth: email+password на memory-адаптері', () => {
  let ctx: ReturnType<typeof setup>;

  beforeEach(() => {
    ctx = setup();
  });

  const signUp = () =>
    ctx.auth.api.signUpEmail({
      body: { email: EMAIL, password: PASSWORD, name: 'Оксана Коваль' },
      asResponse: true,
    });

  it('signUp віддає 200 і ставить cookie сесії', async () => {
    const response = await signUp();

    expect(response.status).toBe(200);
    expect(cookieHeader(response)).toContain('session_token');
  });

  it('cookie з signUp читається як сесія', async () => {
    const cookie = cookieHeader(await signUp());

    const session = await ctx.auth.api.getSession({
      headers: new Headers({ cookie }),
    });

    expect(session?.user.email).toBe(EMAIL);
    // 🔴 id — саме UUID: контракт B3′ вимагає uuid-PK, бо на `users.id`
    // дивляться uuid-колонки FK шести доменних таблиць. Рядковий id BA за
    // замовчуванням мовчки зламав би вставку профілю.
    expect(session?.user.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });

  it('хук create.after провізує профіль із роллю user', async () => {
    const cookie = cookieHeader(await signUp());
    const session = await ctx.auth.api.getSession({
      headers: new Headers({ cookie }),
    });

    expect(ctx.provisioned).toEqual([
      {
        userId: session?.user.id,
        email: EMAIL,
        firstName: 'Оксана',
        lastName: 'Коваль',
        role: 'user',
      },
    ]);
  });

  it('невірний пароль сесії не дає', async () => {
    await signUp();

    const response = await ctx.auth.api.signInEmail({
      body: { email: EMAIL, password: 'не той пароль' },
      asResponse: true,
    });

    expect(response.ok).toBe(false);
    expect(cookieHeader(response)).not.toContain('session_token');
  });

  it('signOut робить сесію недійсною негайно', async () => {
    const cookie = cookieHeader(await signUp());
    const headers = new Headers({ cookie });

    await ctx.auth.api.signOut({ headers, asResponse: true });

    // Cookie-сесії BA — stateful: відкликання не чекає закінчення TTL, рядок
    // сесії зникає зі сховища. Саме цим вони й обрані замість JWT.
    expect(await ctx.auth.api.getSession({ headers })).toBeNull();
  });
});
