// doctor №14: `nodemailer` — пряма залежність магазину в межах peer-діапазону ядра.
// Та сама причина, що й у №13 (`pg-peer.mjs`): транзитивний пакет невидимий із кореня магазину
// під pnpm strict, тож Vite вклеює його в серверний бандл; пряма залежність — один екземпляр.
import { readPeerState, satisfies } from './pg-peer.mjs';

const TITLE = 'nodemailer — залежність магазину в межах peer ядра';
const result = (status, details) => ({
  id: 'mail-driver',
  title: TITLE,
  status,
  details,
});

/** @param {{ storeRoot: string; manifest: Record<string, unknown> }} ctx */
export function checkMailDriver({ storeRoot, manifest }) {
  const { declared, installed, peerRange } = readPeerState(
    storeRoot,
    manifest,
    'nodemailer',
  );
  if (!declared)
    return result(
      'error',
      'nodemailer не оголошено в dependencies магазину: без нього SMTP-драйвер пошти не працює. ' +
        'Додай: pnpm add nodemailer@<версія з peerDependencies simplycms>',
    );
  if (!peerRange)
    return result(
      'skip',
      'ядро не встановлено — peer-діапазон nodemailer невідомий (pnpm install)',
    );
  const version = installed ?? declared.replace(/^[\^~>=\s]+/, '');
  const verdict = satisfies(version, peerRange);
  if (verdict === null)
    return result(
      'skip',
      `не вдалося порівняти nodemailer ${version} із peer-діапазоном «${peerRange}»`,
    );
  if (!verdict)
    return result(
      'error',
      `nodemailer ${version} не задовольняє peer ядра «${peerRange}»: pnpm add nodemailer@${peerRange}`,
    );
  return result('ok');
}

/**
 * Режим перевірки (Е8-Р17): `--production` АБО `isProductionRuntime(process.env)` ядра.
 * 🔴 Власної перевірки `NODE_ENV` у CLI немає — предикат один, у `simplycms/env`; без
 * встановленого ядра лишається тільки прапорець.
 * @param {{ flag: boolean; env: Record<string, string | undefined>;
 *   core: { isProductionRuntime(env: Record<string, string | undefined>): boolean } | null }} input
 */
export function resolveDoctorMode({ flag, env, core }) {
  return flag || (core?.isProductionRuntime(env) ?? false);
}

/**
 * Рядок режиму — ПЕРШИЙ у звіті: без нього warn у розробці читався б як «у проді все гаразд».
 * @param {boolean} production
 * @returns {import('./ui.mjs').Check}
 */
export function modeNotice(production) {
  return {
    id: 'mode',
    title: production
      ? 'режим: production'
      : 'режим: розробка (для перевірки проду — `--production`)',
    status: 'ok',
  };
}

/**
 * Пошта налаштована? Драйвер `log` у проді губить листи (посилання скидання пароля тощо) —
 * там це error, у розробці — warn. Часткова група SMTP — error завжди (кидає ядро).
 * `ctx.mail` готує `doctor.mjs` через ядро магазину: `{ driver }`, `{ error }` або `null`.
 * @param {{ production?: boolean; mail?: { driver?: string; error?: string } | null }} ctx
 * @returns {import('./ui.mjs').Check}
 */
export function checkMailConfigured({ production = false, mail }) {
  const base = { id: 'mail-configured', title: 'Пошта налаштована' };
  if (!mail)
    return {
      ...base,
      status: 'skip',
      details: 'ядро не встановлено — драйвер пошти невідомий (pnpm install)',
    };
  if (mail.error) return { ...base, status: 'error', details: mail.error };
  if (mail.driver !== 'log') return { ...base, status: 'ok' };
  return {
    ...base,
    status: production ? 'error' : 'warn',
    details:
      'пошта не налаштована: у проді листи губляться в лозі. Задай SMTP_URL і MAIL_FROM',
  };
}
