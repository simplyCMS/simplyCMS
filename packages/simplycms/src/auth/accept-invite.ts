import { randomBytes } from 'node:crypto';
import type { SimplyAuth } from './instance';
import {
  verifyOwnerInvite,
  type InviteRejection,
  type OwnerInviteStore,
} from './invite';

/**
 * Прийняття запрошення власника: токен із листа → пароль → робочий вхід.
 *
 * 🔴 Ланка, якої бракувало. `issueOwnerInvite` випускав посилання, а
 * `verifyOwnerInvite` умів лише сказати «токен дійсний»; пароля власник не
 * отримував ніде, тож перший адмін на чистому магазині був недосяжний.
 *
 * 🔴 Пароль пишеться НЕ вручну в `accounts`, а штатним `POST /reset-password`
 * самого Better Auth. Це свідомий обхід чужої внутрішньої кухні: саме той
 * ендпойнт уміє і створити credential-акаунт, коли його ще немає (наш
 * запрошений власник), і перезаписати наявний, і робить це тим самим
 * хешуванням, що й реєстрація. Копія цієї логіки в нас застаріла б мовчки —
 * і виявилось би це неможливістю ввійти.
 *
 * Ціна прийому — одноразовий внутрішній verification-рядок BA: наш токен уже
 * доведено спожитий, і ми обмінюємо його на токен, який розуміє BA. Він живе
 * хвилину й гаситься самим ендпойнтом.
 */

/** Чому прийняття не відбулось — рівно ті випадки, які розрізняє UI. */
export type AcceptInviteRejection = InviteRejection | 'password-rejected';

export type AcceptOwnerInviteResult =
  | { readonly ok: true; readonly userId: string }
  | { readonly ok: false; readonly reason: AcceptInviteRejection };

export interface AcceptOwnerInviteInput {
  readonly auth: SimplyAuth;
  readonly store: OwnerInviteStore;
  readonly email: string;
  readonly token: string;
  readonly password: string;
  readonly now?: Date;
}

/** Скільки живе внутрішній обмінний токен BA. Хвилини вистачає з запасом. */
const EXCHANGE_TTL_MS = 60_000;

export async function acceptOwnerInvite(
  input: AcceptOwnerInviteInput,
): Promise<AcceptOwnerInviteResult> {
  // 🔴 Спершу СПОЖИТИ наш токен і лише потім чіпати пароль: інакше невдала
  // спроба пароля лишала б запрошення живим, а це вже підбір за посиланням.
  const verified = await verifyOwnerInvite({
    store: input.store,
    email: input.email,
    token: input.token,
    now: input.now,
  });
  if (!verified.ok) return { ok: false, reason: verified.reason };

  const context = await input.auth.$context;
  const exchangeToken = randomBytes(32).toString('base64url');
  await context.internalAdapter.createVerificationValue({
    identifier: `reset-password:${exchangeToken}`,
    value: verified.userId,
    expiresAt: new Date((input.now ?? new Date()).getTime() + EXCHANGE_TTL_MS),
  });

  const response = await input.auth.api.resetPassword({
    body: { newPassword: input.password, token: exchangeToken },
    asResponse: true,
  });
  if (!response.ok) return { ok: false, reason: 'password-rejected' };

  // Перехід за одноразовим посиланням і є доказом володіння поштою — саме
  // тому `issueOwnerInvite` заводив користувача з `emailVerified: false`.
  await context.internalAdapter.updateUser(verified.userId, {
    emailVerified: true,
  });

  return { ok: true, userId: verified.userId };
}
