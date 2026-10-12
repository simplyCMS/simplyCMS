// К3-Е8, Е8-Р3 (Е6г-9): `users.email` завжди в нижньому регістрі — і кодом
// (кожен шлях запису нормалізує на межі), і схемою (`users_email_lowercase`).
// CHECK без тесту КОЖНОГО шляху запису небезпечний: шлях, що забув `lower()`,
// почав би падати з 23514 уже в проді на першому ж `Mixed@Case`. Тож чотири
// кейси ганяють справжні шляхи (BA над drizzle-адаптером, `issueOwnerInvite`,
// `updateCustomerContacts`) на тимчасовій БД, а п'ятий доводить сам CHECK.
//
// Окремого шляху «адмін-запрошення» в кодобазі немає: і CLI `owner:invite`, і
// адмінка кличуть той самий `issueOwnerInvite` → `ownerInviteStore.createUser`,
// тож його покриває кейс 2.
import { describe, expect, it, vi } from 'vitest';
import { createAuth, issueOwnerInvite, ownerInviteStore } from 'simplycms/auth';
import * as C from './fixtures/customer-contacts';
import * as F from './fixtures/customer-categories';

vi.mock('@tanstack/react-start/server', () => ({ setResponseStatus: vi.fn() }));
vi.mock('simplycms/auth', async (orig) => ({
  ...(await orig()),
  requireGrant: vi.fn(async () => ({
    subject: { userId: F.ADMIN_ID, roles: ['admin'] },
    scope: 'any',
  })),
}));

import { updateCustomerContactsOp } from 'simplycms/admin-server/impl';

describe('users.email: нижній регістр на всіх шляхах запису', () => {
  const db = F.useCustomersDb('simplycms_email_lowercase');
  const url = () => db.url();
  const emailOf = async (email: string) =>
    (
      await F.rows(url(), `select email from public.users where email = $1`, [
        email,
      ])
    ).map((r) => r.email);

  it('Better Auth signUpEmail з Mixed@Case.UA кладе mixed@case.ua', async () => {
    const auth = createAuth({
      secret: 'email-lowercase-secret-not-a-real-one',
      baseURL: 'http://localhost:3000',
    });
    const response = await auth.api.signUpEmail({
      body: {
        email: 'Mixed@Case.UA',
        password: 'super-secret-password',
        name: 'Оксана Коваль',
      },
      asResponse: true,
    });
    expect(response.status, await response.clone().text()).toBe(200);
    expect(await emailOf('mixed@case.ua')).toEqual(['mixed@case.ua']);
    expect(await emailOf('Mixed@Case.UA')).toEqual([]);
  });

  it('issueOwnerInvite з Owner@Shop.UA кладе owner@shop.ua', async () => {
    await issueOwnerInvite({
      store: ownerInviteStore,
      schedule: async () => [],
      email: 'Owner@Shop.UA',
      env: { VITE_SITE_URL: 'https://shop.example' },
    });
    expect(await emailOf('owner@shop.ua')).toEqual(['owner@shop.ua']);
    expect(await emailOf('Owner@Shop.UA')).toEqual([]);
  });

  it('адмін-запрошення — той самий issueOwnerInvite: повторний виклик з іншим регістром не дублює рядок', async () => {
    const again = await issueOwnerInvite({
      store: ownerInviteStore,
      schedule: async () => [],
      email: 'OWNER@shop.ua',
      env: { VITE_SITE_URL: 'https://shop.example' },
    });
    expect(again.created).toBe(false);
    expect(await emailOf('owner@shop.ua')).toHaveLength(1);
  });

  it('updateCustomerContacts з Olena@Mail.UA кладе olena@mail.ua', async () => {
    const id = await F.seedCustomer(url(), { email: 'old@x.test' });
    const { email } = await updateCustomerContactsOp({
      data: {
        userId: id,
        firstName: 'Олена',
        lastName: null,
        phone: null,
        email: 'Olena@Mail.UA',
      },
    });
    expect(email).toBe('olena@mail.ua');
    expect(await C.contactHelpers(url).user(id)).toMatchObject({
      email: 'olena@mail.ua',
    });
  });

  it('прямий insert з Bad@X.UA → 23514 (users_email_lowercase)', async () => {
    await expect(
      F.rows(
        url(),
        `insert into public.users (id, name, email) values ($1, 'Х', 'Bad@X.UA')`,
        [crypto.randomUUID()],
      ),
    ).rejects.toMatchObject({
      code: '23514',
      constraint: 'users_email_lowercase',
    });
  });
});
