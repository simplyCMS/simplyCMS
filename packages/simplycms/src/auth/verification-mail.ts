import { createTranslator } from 'simplycms/i18n';
import {
  deliverMail,
  renderEmailVerificationMail,
  scheduleMail,
} from 'simplycms/mail';
import { getStoreLocale } from 'simplycms/site';
import { logDeliveryFailure, readStoreName } from './mail-support';
import type { ResetMailDeps } from './reset-mail';

/**
 * Колбек `emailVerification.sendVerificationEmail` (Р30): швидкий запис листа в
 * outbox -> доставка БЕЗ `await`, як у скиданні пароля (Е8-О1). `url` будує сам
 * Better Auth від `baseURL` з env (Р18), власного посилання тут немає.
 *
 * BA кличе колбек при реєстрації й при спробі входу непідтвердженого акаунта;
 * затримка SMTP у відповіді видала б існування акаунта за часом.
 */
export function createVerificationSender(
  deps: Pick<ResetMailDeps, 'schedule' | 'mailTransport' | 'storeName'>,
) {
  const schedule = deps.schedule ?? scheduleMail;
  return async ({
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
}
