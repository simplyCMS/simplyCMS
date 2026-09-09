import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import {
  acceptOwnerInvite as acceptInvite,
  getAuth,
  ownerInviteStore,
  type AcceptInviteRejection,
} from 'simplycms/auth';

/**
 * Прийняття запрошення власника зі сторінки `/auth/invite` (В2-К1а).
 *
 * 🔴 Уся логіка живе в `simplycms/auth/accept-invite`, а тут лишається рівно
 * обгортка: серверна функція недосяжна для тестів без контексту запиту, тож
 * тримати в ній рішення означало б винести доказовану частину контуру за
 * межу гейтів. Той самий поділ, що й у `./auth` ↔ `./is-admin`.
 *
 * 🔴 Назовні їде лише вердикт і КОД причини — ні userId, ні тексту помилки
 * Better Auth. Форма причини перекладається каталогом на сторінці: сирий
 * текст чужої бібліотеки в інтерфейсі магазину не місце.
 */

/** Мінімальна довжина пароля — та сама, що в формі (`SetPasswordForm`). */
const MIN_PASSWORD = 8;

export interface AcceptInviteReply {
  readonly ok: boolean;
  readonly reason?: AcceptInviteRejection;
}

export const acceptOwnerInvite = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      email: z.string().min(1),
      token: z.string().min(1),
      password: z.string().min(MIN_PASSWORD),
    }),
  )
  .handler(async ({ data: input }): Promise<AcceptInviteReply> => {
    const { email, token, password } = input as {
      email: string;
      token: string;
      password: string;
    };

    const result = await acceptInvite({
      auth: getAuth(),
      store: ownerInviteStore,
      email,
      token,
      password,
    });

    return result.ok ? { ok: true } : { ok: false, reason: result.reason };
  });
