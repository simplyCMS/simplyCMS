import { resolveDriverEnv } from './resolve';

type Env = Readonly<Record<string, string | undefined>>;

/**
 * Єдиний предикат прод-рантайму (Р16). `server.mjs` безумовно ставить
 * `NODE_ENV=production` перед імпортом бандла, тож у зібраному магазині він
 * істинний без участі власника; усі прод-залежні рішення (попередження про
 * пошту, log-драйвер без тіл листів) беруть сигнал лише звідси.
 */
export function isProductionRuntime(env: Env): boolean {
  return env.NODE_ENV === 'production';
}

/**
 * Перевірка env на старті сервера (Е8-Р7′): хост магазину кличе лише її, без
 * умов і текстів. Часткова група кидає `DriverEnvError` (`code:
 * 'SIMPLYCMS_DRIVER_ENV'`); попередження друкуються тільки в проді — у dev
 * HMR перезапускав би модуль, а log-драйвер пошти там норма.
 */
export function checkDriverEnvOnStart(
  env: Env,
  log: (line: string) => void,
): void {
  const driverEnv = resolveDriverEnv(env);
  if (!isProductionRuntime(env)) return;
  for (const warning of driverEnv.warnings) log(warning);
  if (driverEnv.mail.driver === 'log') {
    log(
      'пошта не налаштована: листи лише в лозі сервера (SMTP_URL і MAIL_FROM).',
    );
  }
}
