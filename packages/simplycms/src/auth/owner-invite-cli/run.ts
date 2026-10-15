import {
  isProductionRuntime,
  redactUrls,
  resolveDriverEnv,
} from 'simplycms/env';
import { createTranslator } from 'simplycms/i18n';
import {
  deliverMail,
  scheduleMail,
  selectMailTransport,
  type MailMessage,
  type MailTransport,
} from 'simplycms/mail';
import {
  issueOwnerInvite,
  OwnerInviteError,
  type OwnerInviteResult,
  type OwnerInviteStore,
} from '../invite';
import { ownerInviteStore } from '../invite-store';

// Ядро `owner:invite` — запрошення власника ПРЯМО в Postgres тим самим
// `issueOwnerInvite`, що й решта ядра: один механізм на весь продукт.
//
// 🔴 Лист ставиться в outbox і доставляється через порт пошти (Е8-С2):
//   - SMTP налаштований — «лист надіслано на <email>», посилання НЕ друкується
//     (лог CLI читає більше людей, ніж скринька власника);
//   - драйвер `log` поза продом — посилання друкується (dev-канал);
//   - прод без SMTP — відмова ДО випуску токена: посилання не друкуємо мовчки в
//     лог контейнера; власник налаштовує пошту або свідомо передає `--print-link`.

export type RunOwnerInviteOptions = {
  email: string;
  siteUrl: string;
  storeName?: string;
  locale?: string;
  printLink?: boolean;
  env?: Readonly<Record<string, string | undefined>>;
  log: (message: string) => void;
  store?: OwnerInviteStore;
  schedule?: typeof scheduleMail;
  deliver?: typeof deliverMail;
  transport?: MailTransport;
};

/**
 * Відмова з машинним кодом (`no-mail`, `banned`): CLI друкує лише текст, а код і
 * первинна помилка (`cause`) лишаються для діагностики.
 */
export class OwnerInviteCliError extends Error {
  constructor(
    message: string,
    readonly code: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
  }
}

export async function runOwnerInvite({
  email,
  siteUrl,
  storeName = 'SimplyCMS',
  locale = 'uk',
  printLink = false,
  env = process.env,
  log,
  store = ownerInviteStore,
  schedule = scheduleMail,
  deliver = deliverMail,
  transport,
}: RunOwnerInviteOptions): Promise<OwnerInviteResult> {
  const mail = resolveDriverEnv(env).mail;
  const production = isProductionRuntime(env);
  if (mail.driver === 'log' && production && !printLink)
    throw new OwnerInviteCliError(
      'Пошта не налаштована, а в проді посилання запрошення не друкується в лог. Налаштуйте SMTP_URL і MAIL_FROM (лист піде на пошту власника) або свідомо запустіть команду з --print-link — тоді посилання з’явиться в консолі.',
      'no-mail',
    );

  let result: OwnerInviteResult;
  try {
    result = await issueOwnerInvite({
      store,
      schedule,
      email,
      env: { VITE_SITE_URL: siteUrl },
      storeName,
      // CLI не бачить `simplycms.config` магазину — локаль листа з env.
      // М2: листи підуть мовою одержувача, фолбек — основна мова магазину.
      t: createTranslator(locale, 'uk'),
    });
  } catch (error) {
    // Забанений не може стати адміном (Е6г-19): підказка замість сирого коду;
    // первинна помилка не губиться для діагностики.
    if (error instanceof OwnerInviteError && error.code === 'banned')
      throw new OwnerInviteCliError(
        `Користувача ${email} заблоковано — спершу розблокуйте покупця.`,
        error.code,
        { cause: error },
      );
    throw error;
  }

  // Ідемпотентність: повторний прогін лише перевипускає токен. 🔴 Р19: роль
  // admin тут НЕ видається — її видає прийняття запрошення.
  if (result.created)
    log(
      `Користувача ${email} створено; роль admin буде видано після прийняття запрошення.`,
    );
  else
    log(
      `Користувач ${email} уже існує — токен перевипущено; роль admin буде видано після прийняття запрошення.`,
    );
  // Не відмова: акаунт міг зареєструвати хтось інший на пошту власника, а роль
  // отримає лише той, хто відкриє посилання з цієї скриньки.
  if (result.existingUnverified)
    log(
      'Увага: акаунт уже існує й не підтверджений — роль буде видано лише після прийняття запрошення з цієї скриньки.',
    );

  // `deliverMail` не кидає (рядок лишається в outbox), тож невдачу саме цього
  // листа видно лише через обгортку транспорту.
  const base = transport ?? selectMailTransport(mail);
  const recipient = email.trim().toLowerCase(); // як у `issueOwnerInvite`
  let failure: unknown = null;
  const probe: MailTransport = {
    driver: base.driver,
    async send(message: MailMessage) {
      try {
        await base.send(message);
      } catch (error) {
        if (message.kind === 'owner_invite' && message.to === recipient)
          failure = error;
        throw error;
      }
    },
  };
  await deliver(result.mailIds, probe);

  const showLink = printLink || (mail.driver === 'log' && !production);
  if (showLink) log(`Посилання (одноразове, дійсне 24 год):\n  ${result.url}`);
  if (mail.driver === 'log') log('SMTP не налаштовано — лист не надсилається.');
  else if (failure === null) log(`Лист надіслано на ${email}.`);
  else
    throw new Error(
      `Лист на ${email} не надіслано: ${redactUrls(failure instanceof Error ? failure.message : String(failure))}. ` +
        'Він лишився в черзі пошти — повторіть після виправлення SMTP.',
    );

  return result;
}
