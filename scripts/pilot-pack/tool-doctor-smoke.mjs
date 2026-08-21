/**
 * Doctor-крок Gate TOOL — запуск `simplycms doctor` із РОЗПАКОВАНОГО tarball-а
 * на свіжому скаффолді шаблону магазину (обіцянка спеки CLI v1 §6).
 *
 * Скаффолд — тими самими функціями, що й юніт-контур (`scaffold.mjs`
 * скаффолдера), тож крок не потребує ні БД, ні мережі. Голий скаффолд без
 * node_modules і env — легітимно «хворий» магазин: doctor має ЗНАЙТИ помилки
 * (exit 1) або їх відсутність (exit 0), але не впасти. Будь-який інший
 * exit-код чи відсутність маркерів звіту — FAIL гейта, без мовчазних
 * запасних варіантів (§3 спеки).
 *
 * 🔴 VITE_SUPABASE_* вирізаються з env процесу: `readStoreEnv` мерджить
 * process.env, і ключі з середовища розробника ввімкнули б онлайн-перевірки —
 * смоук пішов би в мережу, а він герметичний за контрактом packaging-сюїти.
 */

import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { scaffold } from '../../packages/create-simplycms-store/src/scaffold.mjs';

const TEMPLATE_DIR = resolve(
  import.meta.dirname,
  '../../packages/create-simplycms-store/template',
);

/**
 * Упізнавані рядки звіту doctor — дослівно з packages/cli/src: заголовок
 * intro і перевірка №1 (doctor.mjs), перша оффлайн-перевірка
 * (doctor-checks.mjs) — вона доводить, що прогін дійшов далі пошуку кореня.
 */
const REPORT_MARKERS = [
  'simplycms doctor',
  'Корінь магазину знайдено',
  'Версії пакетів ядра синхронні',
];

/**
 * @param {string} pkgDir Тека розпакованого tarball-а `@simplycms/cli`.
 * @param {string} work Робоча tmp-тека гейта — сюди кладеться скаффолд.
 * @param {string} version Версія ядра для підстановки в шаблон — версія
 *   манифеста з tarball-а, щоб перевірка версій doctor бачила синхрон.
 * @returns {Promise<{ ok: boolean; details: string[] }>}
 */
export async function doctorSmoke(pkgDir, work, version) {
  const details = [];
  const storeDir = join(work, 'doctor-store');
  await scaffold({
    templateDir: TEMPLATE_DIR,
    targetDir: storeDir,
    storeName: 'doctor-smoke-store',
    version,
  });
  const env = Object.fromEntries(
    Object.entries(process.env).filter(
      ([name]) => !name.startsWith('VITE_SUPABASE_'),
    ),
  );
  const run = spawnSync('node', [join(pkgDir, 'src/index.mjs'), 'doctor'], {
    cwd: storeDir,
    env,
    encoding: 'utf8',
  });
  if (run.status !== 0 && run.status !== 1) {
    const reason = run.error?.message ?? run.stderr?.trim() ?? '';
    return {
      ok: false,
      details: [
        `✗ doctor упав із кодом ${run.status}${reason ? `: ${reason}` : ''}`,
      ],
    };
  }
  details.push(`✓ doctor на скаффолді: exit ${run.status} — без крашу`);
  const missing = REPORT_MARKERS.filter((m) => !run.stdout.includes(m));
  if (missing.length > 0) {
    const list = missing.map((m) => `«${m}»`).join(', ');
    return {
      ok: false,
      details: [...details, `✗ у stdout doctor немає маркерів: ${list}`],
    };
  }
  details.push(`✓ звіт doctor: усі ${REPORT_MARKERS.length} маркери на місці`);
  return { ok: true, details };
}
