// Ядро owner:invite — запрошення власника ПРЯМО в Postgres (контракт v2).
//
// 🔴 GoTrue тут більше немає. Скрипт кличе рівно той самий `issueOwnerInvite`,
// що й ядро: один механізм запрошення на весь продукт, без другої копії правил.
//
// 🔴 Лист ставиться в outbox і доставляється через порт пошти (Е8-С2):
//   - SMTP налаштований — «лист надіслано на <email>», посилання НЕ друкується
//     (лог CLI читає більше людей, ніж скринька власника);
//   - драйвер `log` поза продом — посилання друкується (dev-канал);
//   - прод без SMTP — відмова (код 1) ДО випуску токена: посилання не друкуємо
//     мовчки в лог контейнера; власник або налаштовує пошту, або свідомо
//     передає `--print-link`.
import {
  issueOwnerInvite,
  OwnerInviteError,
  ownerInviteStore,
} from 'simplycms/auth';
import {
  isProductionRuntime,
  redactUrls,
  resolveDriverEnv,
} from 'simplycms/env';
import { createTranslator, normalizeLocale } from 'simplycms/i18n';
import { deliverMail, scheduleMail, selectMailTransport } from 'simplycms/mail';

const NO_MAIL_IN_PROD =
  'Пошта не налаштована, а в проді посилання запрошення не друкується в лог. ' +
  'Налаштуйте SMTP_URL і MAIL_FROM (лист піде на пошту власника) або ' +
  'свідомо запустіть команду з --print-link — тоді посилання з’явиться в консолі.';

const UNVERIFIED_WARNING =
  'Увага: акаунт уже існує й не підтверджений — роль буде видано лише після прийняття запрошення з цієї скриньки.';

/**
 * @param {{
 *   email: string;
 *   siteUrl: string;
 *   storeName?: string;
 *   locale?: string;
 *   printLink?: boolean;
 *   env?: Record<string, string | undefined>;
 *   log: (message: string) => void;
 *   store?: import('simplycms/auth').OwnerInviteStore;
 *   schedule?: typeof scheduleMail;
 *   deliver?: typeof deliverMail;
 *   transport?: import('simplycms/mail').MailTransport;
 * }} options
 */
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
}) {
  const mail = resolveDriverEnv(env).mail;
  const production = isProductionRuntime(env);
  if (mail.driver === 'log' && production && !printLink)
    throw Object.assign(new Error(NO_MAIL_IN_PROD), { code: 'no-mail' });

  let result;
  try {
    result = await issueOwnerInvite({
      store,
      schedule,
      email,
      env: { VITE_SITE_URL: siteUrl },
      storeName,
      // CLI не бачить `simplycms.config` магазину — локаль листа з env.
      t: createTranslator(normalizeLocale(locale)),
    });
  } catch (error) {
    // Забанений не може стати адміном (Е6г-19): підказка замість сирого коду.
    if (error instanceof OwnerInviteError && error.code === 'banned')
      throw Object.assign(
        new Error(
          `Користувача ${email} заблоковано — спершу розблокуйте покупця.`,
          // Первинна помилка не губиться для діагностики.
          { cause: error },
        ),
        { code: error.code },
      );
    throw error;
  }

  // Ідемпотентність: повторний прогін не створює другого користувача — він
  // лише перевипускає токен, гасячи попередній. 🔴 Р19: роль admin тут НЕ
  // видається — її видає прийняття запрошення, тож текст цього не стверджує.
  log(
    result.created
      ? `Користувача ${email} створено; роль admin буде видано після прийняття запрошення.`
      : `Користувач ${email} уже існує — токен перевипущено; роль admin буде видано після прийняття запрошення.`,
  );
  // Не відмова (код виходу звичайний): акаунт міг зареєструвати хтось інший на
  // пошту власника. Запрошення лишається безпечним — роль отримає лише той, хто
  // відкриє посилання з цієї скриньки, а прийняття гасить усі наявні сесії.
  if (result.existingUnverified) log(UNVERIFIED_WARNING);

  // Невдачу доставки видно лише через транспорт: `deliverMail` не кидає (рядок
  // лишається в outbox), тож обгортка запам'ятовує помилку саме цього листа.
  const base = transport ?? selectMailTransport(mail);
  const recipient = email.trim().toLowerCase(); // як у `issueOwnerInvite`
  let failure = null;
  const probe = {
    driver: base.driver,
    async send(message) {
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
      `Лист на ${email} не надіслано: ${redactUrls(String(failure?.message ?? failure))}. ` +
        'Він лишився в черзі пошти — повторіть після виправлення SMTP.',
    );

  return result;
}
