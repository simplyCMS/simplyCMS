import { withActor } from 'simplycms/db';
import { createTranslator } from 'simplycms/i18n';
import {
  deliverMail,
  renderPasswordResetMail,
  scheduleMail,
  type MailTransport,
} from 'simplycms/mail';
import { getStoreLocale, readStoreProfile } from 'simplycms/site';
import type { ResetGuard } from './reset-guard';

/** `profile.name || 'SimplyCMS'` — той самий фолбек, що й в owner:invite. */
const readStoreName = (): Promise<string> =>
  withActor({ role: 'app_admin' }, readStoreProfile).then(
    (profile) => profile.name || 'SimplyCMS',
  );

/** Помилка фонової доставки без секретів: лише клас помилки, без тексту. */
const logDeliveryFailure = (error: unknown): void => {
  console.warn(
    '[simplycms/auth] фонова доставка листа скидання пароля не вдалась:',
    error instanceof Error ? error.name : typeof error,
  );
};

export type ResetMailDeps = {
  readonly resetGuard: ResetGuard;
  readonly schedule?: typeof scheduleMail;
  readonly mailTransport?: MailTransport;
  readonly storeName?: string;
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
    void deliverMail(ids, deps.mailTransport).catch(logDeliveryFailure);
  };
}
