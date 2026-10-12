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
