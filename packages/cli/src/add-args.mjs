// Парсер аргументів `simplycms add`. Винесено з add.mjs заради ліміту рядків:
// тут — лише розбір і контракт прапорців (порушення = гучна помилка, §3),
// сам сценарій установки — в add.mjs.

/**
 * @param {string[]} argv
 * @returns {{ pkg: string; type: 'plugin' | 'theme'; name?: string;
 *   install: boolean; copy: boolean; dryRun: boolean }}
 */
export function parseAddArgs(argv) {
  /** @type {{ pkg?: string; type?: 'plugin' | 'theme'; name?: string;
   *   install: boolean; copy: boolean; dryRun: boolean }} */
  const options = { install: true, copy: false, dryRun: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--plugin' || arg === '--theme') {
      const type = arg === '--plugin' ? 'plugin' : 'theme';
      if (options.type && options.type !== type)
        throw new Error('Прапорці --plugin і --theme взаємовиключні');
      options.type = type;
    } else if (arg === '--name') {
      const value = argv[i + 1];
      if (value === undefined || value.startsWith('-'))
        throw new Error('Прапорець --name потребує значення');
      options.name = value;
      i += 1;
    } else if (arg === '--no-install') options.install = false;
    else if (arg === '--copy') options.copy = true;
    else if (arg === '--dry-run') options.dryRun = true;
    else if (arg.startsWith('-'))
      throw new Error(`Невідомий прапорець add: ${arg}`);
    else if (options.pkg) throw new Error(`Зайвий аргумент: ${arg}`);
    else options.pkg = arg;
  }
  if (!options.pkg)
    throw new Error(
      'Не задано пакет: simplycms add <pkg> (--plugin | --theme)',
    );
  if (!options.type)
    throw new Error(
      'Задай тип явно: --plugin або --theme (автодетекції у v1 немає)',
    );
  // copy-in — лише для тем (плагін не має локальної форми в магазині) і лише
  // з установкою: без пакета в node_modules копіювати нема звідки.
  if (options.copy && options.type !== 'theme')
    throw new Error('Прапорець --copy — лише для тем: --theme --copy');
  if (options.copy && !options.install)
    throw new Error('Прапорці --copy і --no-install взаємовиключні');
  return { ...options, pkg: options.pkg, type: options.type };
}
