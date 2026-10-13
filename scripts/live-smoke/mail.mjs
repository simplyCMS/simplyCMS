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
import { setTimeout as sleep } from 'node:timers/promises';
import { expectVisible } from './wait.mjs';

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

/** Чистка скриньки на старті (лише через API Mailpit). */
export async function clearMailpit() {
  const res = await fetch(`${mailpitApi()}/api/v1/messages`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error(`[live-smoke] Mailpit DELETE: ${res.status}`);
}

/**
 * Чекає лист на адресу `to` із темою, що містить `subject`; повертає
 * `{ summary, text, from }` або `null` після таймауту (вердикт — у `check`).
 */
export async function waitForMail({ to, subject, timeout = 20_000 }) {
  const api = mailpitApi();
  const deadline = Date.now() + timeout;
  do {
    const res = await fetch(`${api}/api/v1/messages?limit=200`);
    const { messages = [] } = await res.json();
    const hit = messages.find(
      (m) => m.To.some((a) => a.Address === to) && m.Subject.includes(subject),
    );
    if (hit) {
      const full = await (
        await fetch(`${api}/api/v1/message/${hit.ID}`)
      ).json();
      return { summary: hit, text: full.Text ?? '', from: hit.From.Address };
    }
    await sleep(300);
  } while (Date.now() < deadline);
  return null;
}

/** Перше посилання в текстовій частині листа. */
export function firstLink(text) {
  return /https?:\/\/[^\s<>"]+/.exec(text)?.[0] ?? null;
}

/** Тема листа підтвердження реєстрації (`mail.verify.subject`). */
const VERIFY_SUBJECT = 'Підтвердіть пошту';

/**
 * Лист підтвердження → перехід за посиланням. `true`, коли лист знайдено й
 * посилання відкрилось без помилки сервера.
 */
export async function confirmEmail(page, email) {
  const mail = await waitForMail({ to: email, subject: VERIFY_SUBJECT });
  const link = mail && firstLink(mail.text);
  if (!link) return false;
  const res = await page.goto(link, { waitUntil: 'networkidle' });
  return res !== null && res.status() < 400;
}

/** Вхід формою `/auth` (вкладка за замовчуванням — «Вхід»). */
export async function signIn(page, base, email) {
  await page.goto(`${base}/auth`, { waitUntil: 'networkidle' });
  await page.locator('#login-email').fill(email);
  await page.locator('#login-password').fill(MAIL_STEP_PASSWORD);
  await page.getByRole('button', { name: 'Увійти', exact: true }).click();
}

/**
 * Листи воронки: замовлення покупцю → скидання пароля → форма за посиланням.
 * `context` — окремий контекст без сесії, щоб посилання відкрилось «з нуля».
 */
export async function runMailChecks({ browser, base, email, from, check }) {
  const order = await waitForMail({ to: email, subject: 'прийнято' });
  check(
    'пошта: лист замовлення покупцю в Mailpit',
    order !== null && order.from === from,
    order ? `From = ${order.from}` : 'листа немає',
  );

  const res = await fetch(`${base}/api/auth/request-password-reset`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: base },
    body: JSON.stringify({ email, redirectTo: '/auth/set-password' }),
  });
  const reset = await waitForMail({ to: email, subject: 'Скидання пароля' });
  const link = reset && firstLink(reset.text);
  check(
    'пошта: лист скидання пароля в Mailpit',
    res.ok && Boolean(link),
    link ? 'лист знайдено, посилання є' : `запит ${res.status}, листа немає`,
  );
  if (!link) return;

  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await page.goto(link, { waitUntil: 'networkidle' });
    const opened =
      page.url().includes('/auth/set-password?token=') &&
      (await expectVisible(page.getByLabel('Повторіть пароль')));
    check(
      'пошта: посилання скидання відкриває форму нового пароля',
      opened,
      opened ? 'форма відкрилась' : 'форми немає',
    );
  } finally {
    await context.close();
  }
}

/**
 * Р30: реєстрація нового покупця зі SMTP. Вхід до підтвердження відмовлено,
 * Mailpit має лист підтвердження, посилання підтверджує пошту, вхід проходить.
 */
export async function runSignupConfirmation({ browser, base, signUp, check }) {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    const email = await signUp(page, base);
    await signIn(page, base, email);
    const refused = await expectVisible(
      page.getByText('Пошту ще не підтверджено'),
      10_000,
    );
    check(
      'Р30: вхід до підтвердження пошти відмовлено',
      refused && page.url().includes('/auth'),
      refused ? 'тост «пошту не підтверджено»' : 'вхід пройшов або тосту немає',
    );
    const confirmed = await confirmEmail(page, email);
    check(
      'Р30: лист підтвердження в Mailpit, посилання відкривається',
      confirmed,
      confirmed ? 'лист знайдено, посилання відкрилось' : 'листа немає',
    );
    await signIn(page, base, email);
    const entered = await page
      .waitForURL(`${base}/`, { timeout: 15_000 })
      .then(() => true)
      .catch(() => false);
    check(
      'Р30: після підтвердження вхід успішний',
      entered,
      entered ? 'сесія є, головна' : `лишились на ${page.url()}`,
    );
  } finally {
    await context.close();
  }
}
