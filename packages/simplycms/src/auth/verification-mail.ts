import { createTranslator } from 'simplycms/i18n';
import {
  deliverMail,
  renderEmailVerificationMail,
  scheduleMail,
} from 'simplycms/mail';
import { getStoreLocale } from 'simplycms/site';
import {
  logDeliveryFailure,
  readStoreName,
  type MailDeps,
} from './mail-support';

/** Мінімум інстансу BA, потрібний мостові: лише `internalAdapter.updateUser`. */
type BoundAuth = {
  readonly $context: Promise<{
    readonly internalAdapter: {
      updateUser(
        id: string,
        data: { emailVerified: boolean },
      ): Promise<unknown>;
    };
  }>;
};

/**
 * Усе, що Р30 додає до конфігу Better Auth: `emailVerification` (лист через
 * outbox), хук `onPasswordReset` і місток `bind` до готового інстансу.
 *
 * Лист — швидкий запис в outbox -> доставка БЕЗ `await`, як у скиданні пароля
 * (Е8-О1): затримка SMTP у відповіді видала б існування акаунта за часом.
 * `url` будує сам BA від `baseURL` з env (Р18), власного посилання тут немає.
 *
 * Хук скидання пароля ставить `emailVerified = true`: перехід за посиланням зі
 * скриньки — такий самий доказ володіння поштою, як лист підтвердження. Інстанс
 * BA ще не існує, коли збирається конфіг, тож хук іде через `bind(auth)`.
 */
export function createEmailVerification(deps: MailDeps) {
  const schedule = deps.schedule ?? scheduleMail;
  let bound: BoundAuth | undefined;

  const sendVerificationEmail = async ({
    user,
    url,
  }: {
    user: { email: string };
    url: string;
  }): Promise<void> => {
    const message = renderEmailVerificationMail({
      to: user.email,
      url,
      storeName: deps.storeName ?? (await readStoreName()),
      t: createTranslator(getStoreLocale()),
    });
    const ids = await schedule([{ kind: 'email_verification', message }]);
    void deliverMail(ids, deps.mailTransport).catch(
      logDeliveryFailure('email_verification'),
    );
  };

  return {
    emailVerification: {
      // Непідтверджений акаунт (пошту змінив адмін, акаунт створено до SMTP)
      // отримує новий лист на спробу входу.
      sendOnSignIn: true,
      sendVerificationEmail,
    },
    onPasswordReset: async ({
      user,
    }: {
      user: { id: string; emailVerified: boolean };
    }): Promise<void> => {
      if (user.emailVerified || !bound) return;
      const context = await bound.$context;
      await context.internalAdapter.updateUser(user.id, {
        emailVerified: true,
      });
    },
    bind(auth: BoundAuth): void {
      bound = auth;
    },
  };
}
