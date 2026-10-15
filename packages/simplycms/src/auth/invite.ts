import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { createTranslator, type Translator } from 'simplycms/i18n';
import { siteUrl } from 'simplycms/env';
import { renderOwnerInviteMail, scheduleMail } from 'simplycms/mail';
import { getStoreLocale } from 'simplycms/site';

/**
 * Invite власника — заміна механіки `inviteUserByEmail` (Task 7, В2-К1а).
 *
 * 🔴 Що змінилось по суті. Раніше лист будував зовнішній сервіс автентифікації за власним
 * шаблоном, і перевірити рендер було нічим. Тепер
 * токен випускаємо МИ, лист рендеримо МИ (`renderOwnerInviteMail` з `simplycms/mail`), а шле його
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
  /**
   * Лише токен під `admin-roles` (Е6г-19). `'banned'` — користувач забанений:
   * нічого не записано.
   *
   * 🔴 Р19: роль `admin` тут НЕ видається. Better Auth не вимагає підтвердження
   * пошти, тож будь-хто міг зареєструватися на пошту власника ДО випуску
   * запрошення — видача ролі при випуску віддала б адмінку його живим сесіям.
   * Роль видає `grantAdminRole` після прийняття (доказ володіння скринькою) і
   * скидання сесій. Токен і роль розділені свідомо: щілина «токен є, ролі
   * немає» безпечна, а «роль є до прийняття» — це і була дірка.
   */
  issueAdminInvite(input: {
    userId: string;
    identifier: string;
    valueHash: string;
    expiresAt: Date;
  }): Promise<'issued' | 'banned'>;
  /**
   * Видача ролі `admin` ПІСЛЯ прийняття запрошення: лок `admin-roles` першим
   * запитом, `FOR SHARE` на користувача, перевірка бану (той самий інваріант
   * Е6г-4/Е6г-19, що раніше стояв у `issueAdminInvite`). `'banned'` — роль не
   * видано (користувача забанили між випуском і прийняттям).
   */
  grantAdminRole(input: { userId: string }): Promise<'granted' | 'banned'>;
  /** `users.email_verified` — щоб CLI попередив про непідтверджений акаунт. */
  isEmailVerified(userId: string): Promise<boolean>;
  consumeToken(
    identifier: string,
  ): Promise<{ valueHash: string; expiresAt: Date } | null>;
}

/** Відмова випуску invite. Єдина причина зараз — `banned` (Е6г-19). */
export class OwnerInviteError extends Error {
  override readonly name = 'OwnerInviteError';
  constructor(readonly code: 'banned') {
    super(`[auth] invite відхилено: ${code}`);
  }
}

const DEFAULT_TTL_MS = 24 * 3_600_000;

/** Ключ запису у `verifications`. Пошта — у нижньому регістрі: вона й є ключ. */
export const inviteIdentifier = (email: string): string =>
  `owner-invite:${email.trim().toLowerCase()}`;

const hashToken = (token: string): string =>
  createHash('sha256').update(token).digest('hex');

export interface IssueOwnerInviteInput {
  readonly store: OwnerInviteStore;
  /** Постановка листа в outbox. За замовчуванням — `scheduleMail`. */
  readonly schedule?: typeof scheduleMail;
  readonly email: string;
  /** Джерело `VITE_SITE_URL` для посилання (див. `siteUrl`); за замовчуванням `process.env`. */
  readonly env?: Readonly<Record<string, string | undefined>>;
  readonly storeName?: string;
  /** Транслятор листа; за замовчуванням — від локалі хоста. */
  readonly t?: Translator;
  readonly ttlMs?: number;
  readonly now?: Date;
  /** Тільки для тестів: детермінований токен замість випадкового. */
  readonly token?: string;
}

export interface OwnerInviteResult {
  readonly userId: string;
  /** `false` — користувач уже існував: повторний invite його не дублює. */
  readonly created: boolean;
  /**
   * Р19: акаунт існував і `email_verified = false` — це може бути чужа
   * самореєстрація на пошту власника. Роль від випуску не видається, але CLI
   * про це попереджає.
   */
  readonly existingUnverified: boolean;
  readonly url: string;
  /** Id рядків outbox для `deliverMail`. */
  readonly mailIds: readonly string[];
}

/**
 * Випускає запрошення. Ідемпотентно щодо КОРИСТУВАЧА: повторний виклик на ту
 * саму пошту не створює другого рядка `users` — він лише перевипускає токен.
 * Саме так поводився старий `owner:invite` (гілка `email_exists`), і саме цю
 * поведінку власник очікує від «надішли ще раз».
 */
export async function issueOwnerInvite(
  input: IssueOwnerInviteInput,
): Promise<OwnerInviteResult> {
  const email = input.email.trim().toLowerCase();
  const ttlMs = input.ttlMs ?? DEFAULT_TTL_MS;
  const now = input.now ?? new Date();

  const existing = await input.store.findUserIdByEmail(email);
  const existingUnverified =
    existing !== null && !(await input.store.isEmailVerified(existing));
  const userId =
    existing ?? (await input.store.createUser({ email, name: email }));

  const token = input.token ?? randomBytes(32).toString('base64url');
  // Тут випускається лише токен. Роль `admin` видає `acceptOwnerInvite`
  // після прийняття (Р19): invite власника — єдиний легальний шлях до
  // `admin` на чистому магазині (хук signUp дає рівно `user`, інваріант
  // `first_user_no_auto_admin`), але лише для контролера скриньки.
  const outcome = await input.store.issueAdminInvite({
    userId,
    identifier: inviteIdentifier(email),
    valueHash: hashToken(token),
    expiresAt: new Date(now.getTime() + ttlMs),
  });
  if (outcome === 'banned') throw new OwnerInviteError('banned');

  const url = siteUrl(
    `/auth/invite?email=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}`,
    input.env ?? process.env,
  );

  const message = renderOwnerInviteMail({
    to: email,
    url,
    storeName: input.storeName ?? 'SimplyCMS',
    ttlMs,
    // М2: листи підуть мовою одержувача, фолбек — основна мова магазину.
    t: input.t ?? createTranslator(getStoreLocale(), 'uk'),
  });
  const mailIds = await (input.schedule ?? scheduleMail)([
    { kind: 'owner_invite', message },
  ]);

  return {
    userId,
    created: existing === null,
    existingUnverified,
    url,
    mailIds,
  };
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
