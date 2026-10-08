// Читачі й сід токенів для харнесу контактів покупця (К3-Е6г, Task 6).
import * as F from './customer-categories';

export const contactHelpers = (url: () => string) => ({
  user: async (id: string) =>
    (
      await F.rows(
        url(),
        `select name, email, email_verified from public.users where id = $1`,
        [id],
      )
    )[0]!,
  profile: async (id: string) =>
    (
      await F.rows(
        url(),
        `select first_name, last_name, phone, email from public.profiles where user_id = $1`,
        [id],
      )
    )[0]!,
  token: (identifier: string, value: string) =>
    F.rows(
      url(),
      `insert into public.verifications (id, identifier, value, expires_at)
       values ($1, $2, $3, now() + interval '1 day')`,
      [crypto.randomUUID(), identifier, value],
    ),
  identifiers: async () =>
    (await F.rows(url(), `select identifier from public.verifications`)).map(
      (r) => String(r.identifier),
    ),
});
