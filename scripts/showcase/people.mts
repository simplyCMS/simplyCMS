/**
 * Люди сіду (С-4): власник і другий адмін — штатним запрошенням власника
 * (`issueOwnerInvite` → `acceptOwnerInvite`, прецедент — CLI `owner:invite`),
 * покупці — `signUpEmail` Better Auth in-process, тож хуки провізії профілю й
 * дефолтної категорії спрацьовують так само, як на вітрині.
 *
 * 🔴 Email-и лише на `@showcase.test` (RFC 2606). Паролі — константи ЛИШЕ
 * для локального стенда: без них у демо-базу не зайти.
 */
import {
  acceptOwnerInvite,
  getAuth,
  issueOwnerInvite,
  ownerInviteStore,
} from '../../packages/simplycms/src/auth/index.ts';
import {
  SHOWCASE_OWNER_EMAIL,
  SHOWCASE_OWNER_PASSWORD,
  type ShowcaseEnv,
} from './env.mts';
import { int, pick } from './prng.mts';
import { stream } from './seed-context.mts';

/** Другий адмін демо-бази (лише локалка). */
export const SHOWCASE_MANAGER_EMAIL = 'manager@showcase.test';
export const SHOWCASE_MANAGER_PASSWORD = 'showcase-manager-2026';
/** Спільний пароль покупців `buyer-NN@showcase.test` (лише локалка). */
export const SHOWCASE_BUYER_PASSWORD = 'showcase-buyer-2026';
export const BUYER_COUNT = 18;

const FIRST =
  'Олена Андрій Марія Тарас Ірина Богдан Наталія Олег Софія Дмитро Юлія Василь'.split(
    ' ',
  );
const LAST =
  'Коваленко Бондаренко Шевчук Мельник Ткаченко Кравчук Олійник Савченко Руденко Лисенко'.split(
    ' ',
  );

export type Person = {
  readonly firstName: string;
  readonly lastName: string;
  readonly email: string;
  readonly phone: string;
};

export type Buyer = Person & { readonly id: string };

export type People = {
  readonly ownerId: string;
  readonly managerId: string;
  /** У порядку `buyer-01…buyer-NN`. */
  readonly buyers: readonly Buyer[];
};

/** Імʼя, прізвище й телефон із PRNG; email задає викликач. */
export function personOf(rand: () => number, email: string): Person {
  const phone = `+38067${String(int(rand, 0, 9_999_999)).padStart(7, '0')}`;
  return {
    firstName: pick(rand, FIRST),
    lastName: pick(rand, LAST),
    email,
    phone,
  };
}

async function inviteAdmin(
  env: ShowcaseEnv,
  email: string,
  password: string,
): Promise<string> {
  const issued = await issueOwnerInvite({
    email,
    store: ownerInviteStore,
    siteUrl: env.siteUrl,
    // Лист не потрібен: токен береться з URL результату, як у `owner-invite.mts`.
    sendEmail: async () => {},
  });
  const token = new URL(issued.url).searchParams.get('token');
  if (!token) throw new Error('[showcase] invite без токена в URL');
  const accepted = await acceptOwnerInvite({
    auth: getAuth(),
    store: ownerInviteStore,
    email,
    token,
    password,
  });
  if (!accepted.ok)
    throw new Error(`[showcase] invite ${email}: ${accepted.reason}`);
  return accepted.userId;
}

export async function seedPeople(env: ShowcaseEnv): Promise<People> {
  const ownerId = await inviteAdmin(
    env,
    SHOWCASE_OWNER_EMAIL,
    SHOWCASE_OWNER_PASSWORD,
  );
  const managerId = await inviteAdmin(
    env,
    SHOWCASE_MANAGER_EMAIL,
    SHOWCASE_MANAGER_PASSWORD,
  );
  const rand = stream('people');
  const buyers: Buyer[] = [];
  for (let n = 1; n <= BUYER_COUNT; n++) {
    const person = personOf(
      rand,
      `buyer-${String(n).padStart(2, '0')}@showcase.test`,
    );
    const { user } = await getAuth().api.signUpEmail({
      body: {
        email: person.email,
        password: SHOWCASE_BUYER_PASSWORD,
        name: `${person.firstName} ${person.lastName}`,
      },
    });
    buyers.push({ ...person, id: user.id });
  }
  return { ownerId, managerId, buyers };
}
