/**
 * Дочірній Node-процес у скретч-магазині (гейти `gate-media`, `gate-mail`).
 *
 * Чому окремий процес, а не імпорт у гейті: доказ має бути про ЗАПАКОВАНЕ ядро —
 * `simplycms/*` резолвиться з `node_modules` скретча (dist із tarball-а) за env
 * скретча, а не з монорепо. `--input-type=module -e` бере базу резолву з `cwd`.
 *
 * Дочірній друкує один рядок `<TAG> <json>`; решта виводу (стек помилки) для
 * вердикту не потрібна — і не друкується далі, бо там можуть бути значення env.
 */
import { spawnSync } from 'node:child_process';

/**
 * Розбір виводу дочірнього: ОСТАННІЙ рядок `<tag> <json>`. `null`, якщо його
 * немає або json зіпсований — гейт тоді червоніє, а не вгадує.
 *
 * @param {string} stdout
 * @param {string} tag
 * @returns {Record<string, unknown> | null}
 */
export function parseReport(stdout, tag) {
  const prefix = `${tag} `;
  const line = stdout
    .split('\n')
    .reverse()
    .find((l) => l.startsWith(prefix));
  if (!line) return null;
  try {
    const value = JSON.parse(line.slice(prefix.length));
    return value !== null && typeof value === 'object' ? value : null;
  } catch {
    return null;
  }
}

/**
 * @param {string} storeDir скретч-магазин (cwd і база резолву)
 * @param {Record<string,string>} env env скретча (поверх `process.env`)
 * @param {string} source ESM-код дочірнього
 * @param {string} tag префікс рядка-звіту
 * @returns {{ report: Record<string, unknown> | null; status: number | null; error: string }}
 */
export function runInStore(storeDir, env, source, tag) {
  const run = spawnSync('node', ['--input-type=module', '-e', source], {
    cwd: storeDir,
    env: { ...process.env, ...env },
    encoding: 'utf8',
    timeout: 60_000,
  });
  // Зі stderr лишається лише перший рядок (імʼя й текст помилки, без стека).
  const error = (run.stderr ?? '').split('\n').find((l) => l.trim()) ?? '';
  return {
    report: parseReport(run.stdout ?? '', tag),
    status: run.status,
    error: error.slice(0, 300),
  };
}
