import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { renderInviteEmail, type SendInviteEmail } from './invite-email';

/**
 * Invite власника — заміна механіки `inviteUserByEmail` (Task 7, В2-К1а).
 *
 * 🔴 Що змінилось по суті. У GoTrue лист будував сам Supabase за шаблоном
 * `supabase/templates/invite.html`, і перевірити рендер було нічим. Тепер
 * токен випускаємо МИ, лист рендеримо МИ (`./invite-email`), а шле його
 * колбек магазину — тож усе, крім SMTP-доставки, стає юніт-тестовним.
 * SMTP лишається боргом оточення (доводиться в власника).
 *
 * 🔴 У БД лягає лише SHA-256 токена. Дамп таблиці `verifications` не має
 * давати дійсного посилання: цим invite відрізняється від «просто рядка з
 * секретом».
 */

/** Порт сховища. Реалізація на Postgres — `./invite-store`. */
export interface OwnerInviteStore {
  findUserIdByEmail(email: string): Promise<string | null>;
  createUser(input: { email: string; name: string }): Promise<string>;
  storeToken(input: {
    identifier: string;
    valueHash: string;
    expiresAt: Date;
  }): Promise<void>;
  consumeToken(
    identifier: string,
  ): Promise<{ valueHash: string; expiresAt: Date } | null>;
  grantAdminRole(userId: string): Promise<void>;
}

const DEFAULT_TTL_MS = 24 * 3_600_000;

/** Ключ запису у `verifications`. Пошта — у нижньому регістрі: вона й є ключ. */
export const inviteIdentifier = (email: string): string =>
  `owner-invite:${email.trim().toLowerCase()}`;

const hashToken = (token: string): string =>
  createHash('sha256').update(token).digest('hex');

export interface IssueOwnerInviteInput {
  readonly store: OwnerInviteStore;
  readonly sendEmail: SendInviteEmail;
  readonly email: string;
  readonly siteUrl: string;
  readonly storeName?: string;
  readonly ttlMs?: number;
  readonly now?: Date;
  /** Тільки для тестів: детермінований токен замість випадкового. */
  readonly token?: string;
}

export interface OwnerInviteResult {
  readonly userId: string;
  /** `false` — користувач уже існував: повторний invite його не дублює. */
  readonly created: boolean;
  readonly url: string;
}

/**
 * Випускає запрошення. Ідемпотентно щодо КОРИСТУВАЧА: повторний виклик на ту
 * саму пошту не створює другого рядка `users` і не дублює роль — він лише
 * перевипускає токен. Саме так поводився старий `owner:invite` (гілка
 * `email_exists`), і саме цю поведінку власник очікує від «надішли ще раз».
 */
export async function issueOwnerInvite(
  input: IssueOwnerInviteInput,
): Promise<OwnerInviteResult> {
  const email = input.email.trim().toLowerCase();
  const ttlMs = input.ttlMs ?? DEFAULT_TTL_MS;
  const now = input.now ?? new Date();

  const existing = await input.store.findUserIdByEmail(email);
  const userId =
    existing ?? (await input.store.createUser({ email, name: email }));

  const token = input.token ?? randomBytes(32).toString('base64url');
  await input.store.storeToken({
    identifier: inviteIdentifier(email),
    valueHash: hashToken(token),
    expiresAt: new Date(now.getTime() + ttlMs),
  });

  // Роль закріплюється НЕ хуком signUp (той дає рівно `user` — інваріант
  // `first_user_no_auto_admin`), а саме тут: invite власника і є єдиний
  // легальний шлях до `admin` на чистому магазині.
  await input.store.grantAdminRole(userId);

  const url =
    `${input.siteUrl.replace(/\/$/, '')}/auth/invite` +
    `?email=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}`;

  await input.sendEmail(
    renderInviteEmail({
      to: email,
      url,
      storeName: input.storeName ?? 'SimplyCMS',
      ttlMs,
    }),
  );

  return { userId, created: existing === null, url };
}

/** Чому запрошення не прийнято — рівно ті випадки, які має розрізняти UI. */
export type InviteRejection = 'not-found' | 'expired' | 'mismatch';

export type VerifyOwnerInviteResult =
  | { readonly ok: true; readonly userId: string }
  | { readonly ok: false; readonly reason: InviteRejection };

/**
 * Перевіряє токен і СПОЖИВАЄ його (одноразовість).
 *
 * 🔴 Порівняння хешів — `timingSafeEqual`, а не `===`: обидва рядки однакової
 * довжини й повністю контрольовані зловмисником, тобто це класичний випадок,
 * де побайтове раннє повернення тече в тайминг.
 *
 * Прив'язку пароля робить К1′б: тут доводиться лише «токен дійсний і це той
 * самий користувач».
 */
export async function verifyOwnerInvite(input: {
  store: OwnerInviteStore;
  email: string;
  token: string;
  now?: Date;
}): Promise<VerifyOwnerInviteResult> {
  const email = input.email.trim().toLowerCase();
  const now = input.now ?? new Date();

  const record = await input.store.consumeToken(inviteIdentifier(email));
  if (!record) return { ok: false, reason: 'not-found' };
  if (record.expiresAt.getTime() <= now.getTime())
    return { ok: false, reason: 'expired' };

  const actual = Buffer.from(hashToken(input.token), 'hex');
  const expected = Buffer.from(record.valueHash, 'hex');
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
    return { ok: false, reason: 'mismatch' };

  const userId = await input.store.findUserIdByEmail(email);
  return userId ? { ok: true, userId } : { ok: false, reason: 'not-found' };
}
