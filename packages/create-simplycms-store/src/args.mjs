/**
 * Опції запуску скаффолдера.
 * @typedef {object} CliOptions
 * @property {string} [storeName] Тека призначення (позиційний аргумент).
 * @property {string} [supabaseUrl]
 * @property {string} [supabaseKey]
 * @property {boolean} install
 * @property {boolean} git
 * @property {boolean} yes Неінтерактивний режим.
 */

/**
 * Значення прапорця = наступний argv. Прапорець, що ковтає сусіда, тихо ламає
 * запуск: `--supabase-url --no-git` записало б «--no-git» у `.env.local`, а
 * `--supabase-url --supabase-key sb_x shop` розгорнуло б магазин у теці «sb_x».
 * Тому відсутнє значення й значення, схоже на прапорець, — помилка.
 * @param {string[]} argv
 * @param {number} index Позиція самого прапорця.
 * @param {string} flag
 * @returns {string}
 */
function requireValue(argv, index, flag) {
  const value = argv[index + 1];
  if (value === undefined || value.startsWith('-')) {
    throw new Error(`Прапорець ${flag} потребує значення`);
  }
  return value;
}

/**
 * Розбір аргументів CLI. Неінтерактивність: --yes АБО CI=true АБО не-TTY.
 * @param {string[]} argv
 * @param {Record<string, string | undefined>} [env]
 * @param {boolean | undefined} [isTTY]
 * @returns {CliOptions}
 */
export function resolveOptions(
  argv,
  env = process.env,
  isTTY = process.stdout.isTTY,
) {
  /** @type {CliOptions} */
  const options = { install: true, git: true, yes: false };
  const rest = [];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--yes' || arg === '-y') options.yes = true;
    else if (arg === '--no-install') options.install = false;
    else if (arg === '--no-git') options.git = false;
    else if (arg === '--supabase-url') {
      options.supabaseUrl = requireValue(argv, i, arg);
      i += 1;
    } else if (arg === '--supabase-key') {
      options.supabaseKey = requireValue(argv, i, arg);
      i += 1;
    } else if (arg.startsWith('-'))
      throw new Error(`Невідомий прапорець: ${arg}`);
    else rest.push(arg);
  }
  if (rest[0]) options.storeName = rest[0];
  if (env.CI === 'true' || !isTTY) options.yes = true;
  return options;
}
