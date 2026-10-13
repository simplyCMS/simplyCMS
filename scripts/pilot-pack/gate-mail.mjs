/**
 * Gate MAIL — ЗАПАКОВАНЕ ядро шле лист через SMTP-драйвер у справжній Mailpit
 * (К3-Е8, Task 13; спека А §8). Повний режим, після Gate B.
 *
 * Дочірній процес у скретчі імпортує `simplycms/mail` з його `node_modules`:
 * `getMailTransport().send(...)` з унікальною темою. Далі ГЕЙТ читає HTTP-API
 * Mailpit: лист із цією темою є, `From = MAIL_FROM`. Драйвер `log`, що мовчки
 * підставився б замість `smtp`, лист у Mailpit не доставить, і гейт червоніє.
 *
 * Намір прогону — з `PILOT_SMTP_URL`/`PILOT_MAILPIT_URL`/`PILOT_MAIL_FROM`, а не з
 * env скретча (див. `gate-media.mjs`: випадіння ключів не має робити skip).
 */
import { randomUUID } from 'node:crypto';
import { findMail } from '../mailpit.mjs';
import { skippedGate } from './report.mjs';
import { runInStore } from './store-child.mjs';

const TAG = 'GATE_MAIL';
const TO = 'gate-mail@simplycms.test';

const sendSource = (subject) => `
import { getMailTransport } from 'simplycms/mail';
const transport = getMailTransport();
await transport.send({ to: '${TO}', subject: ${JSON.stringify(subject)}, text: 'Gate MAIL', kind: 'gate' });
console.log('${TAG} ' + JSON.stringify({ driver: transport.driver }));
`;

/**
 * @param {string} storeDir
 * @param {Record<string,string>} env env скретча
 * @param {{ packOnly?: boolean }} [opts]
 * @returns {Promise<{ ok: boolean; skipped?: boolean; details: string[] }>}
 */
export async function gateMail(storeDir, env, { packOnly = false } = {}) {
  if (packOnly) return skippedGate('Gate MAIL — у --pack-only немає Mailpit');
  const api = process.env.PILOT_MAILPIT_URL?.replace(/\/+$/, '');
  const from = process.env.PILOT_MAIL_FROM;
  if (!process.env.PILOT_SMTP_URL || !api || !from)
    return skippedGate(
      'Gate MAIL — не задано PILOT_SMTP_URL/PILOT_MAIL_FROM/PILOT_MAILPIT_URL (повний прогін робить `pilot-full`)',
    );

  const subject = `Gate MAIL ${randomUUID()}`;
  const sent = runInStore(storeDir, env, sendSource(subject), TAG);
  const details = [];
  if (sent.report === null)
    return {
      ok: false,
      details: [
        `FAIL запакований simplycms/mail: send без звіту (код ${sent.status}) — ${sent.error}`,
      ],
    };
  const { mail, error } = await findMail({
    api,
    match: (m) => m.Subject === subject,
    timeout: 15_000,
  });
  const delivered = mail !== null && mail.from === from;
  details.push(
    `${delivered ? 'OK  ' : 'FAIL'} запакований simplycms/mail → Mailpit — драйвер ${sent.report.driver}, ` +
      (mail
        ? `From = ${mail.from} (очікую ${from})`
        : `листа з темою немає (${error ?? 'лист пішов у лог, а не в SMTP?'})`),
  );
  return { ok: delivered, details };
}
