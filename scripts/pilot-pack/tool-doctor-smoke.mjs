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
 * 🔴 Ключі env магазину вирізаються з env процесу: `readStoreEnv` мерджить
 * process.env, тож `.env.local` розробника зробив би результат перевірки env
 * залежним від машини. Голий скаффолд має виглядати саме голим — інакше
 * смоук зеленів би на чужому оточенні, а не на власному скаффолді.
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
/** Контракт env магазину — рівно те, що гейтить перевірка №5 doctor. */
const STORE_ENV_KEYS = ['DATABASE_URL', 'BETTER_AUTH_SECRET', 'VITE_SITE_URL'];

const REPORT_MARKERS = [
  'simplycms doctor',
  'Корінь магазину знайдено',
  'Версії пакетів ядра синхронні',
  // 🔴 Онлайн-перевірки знято в 0.4.1, але зникнути МОВЧКИ вони не мають:
  // звіт друкує окремий рядок зі статусом skip. Юніт кличе `offlineOnlyNotice()`
  // ізольовано, тож саме монтування (`doctor.mjs` → `checks.push(...)`) не
  // покривав ніхто — рядок можна було прибрати непомітно. Смоук ганяє
  // справжній `doctor` і читає stdout, тому гард живе саме тут.
  'Перевірки стану БД',
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
      ([name]) => !STORE_ENV_KEYS.includes(name),
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
