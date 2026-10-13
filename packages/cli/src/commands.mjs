/**
 * Реєстр команд CLI. Окремий модуль без побічних ефектів: `index.mjs` запускає
 * `main()` на імпорті, тож тести скілів читають реєстр звідси, а не з входу.
 * Динамічні імпорти — модуль команди вантажиться лише за викликом.
 */
export const COMMANDS = {
  doctor: () => import('./doctor.mjs'),
  status: () => import('./status.mjs'),
  smoke: () => import('./smoke.mjs'),
  'deploy:record': () => import('./deploy-record-cli.mjs'),
  add: () => import('./add.mjs'),
  create: () => import('./create.mjs'),
  update: () => import('./update.mjs'),
  'db:diff': () => import('./db-diff.mjs'),
  'db:apply': () => import('./db-apply.mjs'),
  'theme:conformance': () => import('./theme-conformance.mjs'),
};
