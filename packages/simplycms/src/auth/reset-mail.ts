import { createTranslator } from 'simplycms/i18n';
import {
  deliverMail,
  renderPasswordResetMail,
  scheduleMail,
} from 'simplycms/mail';
import { getStoreLocale } from 'simplycms/site';
import {
  logDeliveryFailure,
  readStoreName,
  type MailDeps,
} from './mail-support';
import type { ResetGuard } from './reset-guard';

export type ResetMailDeps = MailDeps & {
  readonly resetGuard: ResetGuard;
};

/**
 * Колбек `emailAndPassword.sendResetPassword`: guard -> швидкий запис листа в
 * outbox -> доставка БЕЗ `await` (Е8-О1). BA кличе колбек лише для наявного
 * email, і затримка SMTP у відповіді видала б існування акаунта за часом.
 * Збій доставки лишає рядок в outbox — його добере наступна доставка.
 */
export function createResetPasswordSender(deps: ResetMailDeps) {
  const schedule = deps.schedule ?? scheduleMail;
  return async ({
    user,
    url,
    token,
  }: {
    user: { id: string; email: string };
    url: string;
    token: string;
  }): Promise<void> => {
    // Токен BA уже вставив окремим запитом: якщо email змінився або акаунт
    // видалено між пошуком і вставкою, guard його прибирає (Е6г-18).
    if (!(await deps.resetGuard(user.id, user.email, token))) return;
    const message = renderPasswordResetMail({
      to: user.email,
      url,
      storeName: deps.storeName ?? (await readStoreName()),
      t: createTranslator(getStoreLocale()),
    });
    const ids = await schedule([{ kind: 'password_reset', message }]);
    void deliverMail(ids, deps.mailTransport).catch(
      logDeliveryFailure('password_reset'),
    );
  };
}
