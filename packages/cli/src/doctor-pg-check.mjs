// doctor №13: `pg` — пряма залежність магазину, версія якої задовольняє peer-діапазон ядра.
// Обґрунтування — `pg-peer.mjs`.
import { readPgState, satisfies } from './pg-peer.mjs';

const TITLE = 'pg — залежність магазину в межах peer ядра';
const result = (status, details) => ({
  id: 'pg-driver',
  title: TITLE,
  status,
  details,
});

/** @param {{ storeRoot: string; manifest: Record<string, unknown> }} ctx */
export function checkPgDriver({ storeRoot, manifest }) {
  const { declared, installed, peerRange } = readPgState(storeRoot, manifest);
  if (!declared)
    return result(
      'error',
      'pg не оголошено в dependencies магазину: без нього драйвер вклеюється в серверний бандл і ' +
        'магазин не стартує. Додай: pnpm add pg@<версія з peerDependencies simplycms>',
    );
  if (!peerRange)
    return result(
      'skip',
      'ядро не встановлено — peer-діапазон pg невідомий (pnpm install)',
    );
  // Без node_modules/pg міряємо оголошену специфікацію: точна — як є, діапазон — по базі.
  const version = installed ?? declared.replace(/^[\^~>=\s]+/, '');
  const verdict = satisfies(version, peerRange);
  if (verdict === null)
    return result(
      'skip',
      `не вдалося порівняти pg ${version} із peer-діапазоном «${peerRange}»`,
    );
  if (!verdict)
    return result(
      'error',
      `pg ${version} не задовольняє peer ядра «${peerRange}»: pnpm add pg@${peerRange}`,
    );
  return result('ok');
}
