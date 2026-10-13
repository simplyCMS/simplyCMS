/**
 * Кроки пошти живого прогону (К3-Е8): лист замовлення, скидання пароля, Р30.
 * Помічники Mailpit і вхід — `./mail.mjs`.
 */
import { confirmEmail, firstLink, signIn, waitForMail } from './mail.mjs';
import { expectVisible } from './wait.mjs';

/**
 * Листи воронки: замовлення покупцю → скидання пароля → форма за посиланням.
 * `context` — окремий контекст без сесії, щоб посилання відкрилось «з нуля».
 */
export async function runMailChecks({ browser, base, email, from, check }) {
  const { mail: order, error: orderError } = await waitForMail({
    to: email,
    subject: 'прийнято',
  });
  check(
    'пошта: лист замовлення покупцю в Mailpit',
    order !== null && order.from === from,
    order ? `From = ${order.from}` : `листа немає${orderError ? ` (${orderError})` : ''}`,
  );

  const res = await fetch(`${base}/api/auth/request-password-reset`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: base },
    body: JSON.stringify({ email, redirectTo: '/auth/set-password' }),
  });
  const { mail: reset, error: resetError } = await waitForMail({
    to: email,
    subject: 'Скидання пароля',
  });
  const link = reset && firstLink(reset.text);
  check(
    'пошта: лист скидання пароля в Mailpit',
    res.ok && Boolean(link),
    link
      ? 'лист знайдено, посилання є'
      : `запит ${res.status}, листа немає${resetError ? ` (${resetError})` : ''}`,
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
