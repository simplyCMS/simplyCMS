/**
 * Пошта живого прогону (К3-Е8, Task 13): Mailpit як справжня «скринька».
 *
 * Сервер магазину піднімається з `SMTP_URL`/`MAIL_FROM` (драйвер `smtp`), тож
 * листи йдуть у Mailpit, а тут читаються його HTTP-API. Посилання й токени з
 * листів у вивід НЕ друкуються — лише факт «лист знайдено, форма відкривається».
 *
 * 🔴 Відсутній Mailpit — FAIL прогону, не skip: з SMTP реєстрація вимагає
 * підтвердження пошти (Р30), тож без скриньки не пройде жоден крок із покупцем.
 */
import {
  clearMailbox,
  findMail,
  firstLink,
  toWithSubject,
} from '../mailpit.mjs';

/** Пароль, яким покупці прогону входять після підтвердження пошти. */
export const MAIL_STEP_PASSWORD = 'live-smoke-2026';

/** HTTP-API Mailpit з env прогону; без нього гучна відмова. */
export function mailpitApi() {
  const api = process.env.HARNESS_MAILPIT_URL;
  if (!api)
    throw new Error(
      '[live-smoke] потрібен HARNESS_MAILPIT_URL (Mailpit): виконай `pnpm harness:up`',
    );
  return api.replace(/\/+$/, '');
}

/** Чистка скриньки на старті. */
export const clearMailpit = () => clearMailbox(mailpitApi());

/** Чекає лист на `to` із темою, що містить `subject`; `null` — вердикт у `check`. */
export async function waitForMail({ to, subject, timeout }) {
  const { mail } = await findMail({
    api: mailpitApi(),
    match: toWithSubject(to, subject),
    timeout,
  });
  return mail;
}

export { firstLink };

/** Тема листа підтвердження реєстрації (`mail.verify.subject`). */
const VERIFY_SUBJECT = 'Підтвердіть пошту';

/**
 * Лист підтвердження → перехід за посиланням. `true`, коли лист знайдено, сервер
 * не відповів помилкою і BA не повернув на `?error=` (недійсний/простроєний
 * токен редіректить саме так, зі статусом 200). Остаточний доказ — вхід після
 * цього, який є в кожного виклику.
 */
export async function confirmEmail(page, email) {
  const mail = await waitForMail({ to: email, subject: VERIFY_SUBJECT });
  const link = mail && firstLink(mail.text);
  if (!link) return false;
  const res = await page.goto(link, { waitUntil: 'networkidle' });
  return (
    res !== null &&
    res.status() < 400 &&
    !new URL(page.url()).searchParams.has('error')
  );
}

/** Вхід формою `/auth` (вкладка за замовчуванням — «Вхід»). */
export async function signIn(page, base, email) {
  await page.goto(`${base}/auth`, { waitUntil: 'networkidle' });
  await page.locator('#login-email').fill(email);
  await page.locator('#login-password').fill(MAIL_STEP_PASSWORD);
  await page.getByRole('button', { name: 'Увійти', exact: true }).click();
}
