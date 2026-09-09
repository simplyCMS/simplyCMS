// Ядро owner:invite — запрошення власника ПРЯМО в Postgres (контракт v2).
//
// 🔴 GoTrue тут більше немає. Раніше скрипт кликав `admin.auth.admin
// .inviteUserByEmail` і будував посилання на `/auth/confirm` — обидві точки
// зникли разом із Supabase Auth, тож скрипт вів у 404 навіть коли «успішно»
// відпрацьовував. Тепер він кличе рівно той самий `issueOwnerInvite`, що й
// ядро: один механізм запрошення на весь продукт, без другої копії правил.
//
// 🔴 Лист НЕ надсилається — SMTP у магазині не налаштований (рішення
// власника). Замість мовчазної відправки в нікуди посилання друкується в
// консоль: власник відкриває його сам. Саме тому `sendEmail` тут — лог, а не
// заглушка-нічого.
import { issueOwnerInvite, ownerInviteStore } from 'simplycms/auth';

/**
 * @param {{
 *   email: string;
 *   siteUrl: string;
 *   storeName?: string;
 *   log: (message: string) => void;
 *   store?: import('simplycms/auth').OwnerInviteStore;
 * }} options
 */
export async function runOwnerInvite({
  email,
  siteUrl,
  storeName = 'SimplyCMS',
  log,
  store = ownerInviteStore,
}) {
  const result = await issueOwnerInvite({
    store,
    sendEmail: async (message) => {
      log(`Лист «${message.subject}» не надсилається: SMTP не налаштовано.`);
    },
    email,
    siteUrl,
    storeName,
  });

  // Ідемпотентність: повторний прогін не створює другого користувача й не
  // дублює роль — він лише перевипускає токен, гасячи попередній.
  log(
    result.created
      ? `Користувача ${email} створено, роль admin закріплена.`
      : `Користувач ${email} уже існує — роль admin на місці, токен перевипущено.`,
  );
  log(`Посилання (одноразове, дійсне 24 год):\n  ${result.url}`);

  return result;
}
