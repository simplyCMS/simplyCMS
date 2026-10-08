/**
 * Модуль сіду вітрини: `seedShowcase(env)` кличуть і команда (`run.mts`), і
 * гейт С-8 — з явним env, без глобального стану команди.
 *
 * 🔴 Перший крок — guard С-16б (`assertPristine`), ДО будь-якого запису.
 * Наповнення (каталог, люди, замовлення, сирі записи С-3/С-11) додає Task 6:
 * усе йде через ядра під `withActor({ role: 'app_admin' })` поверх
 * `app_runtime`-підключення з `env.databaseUrl`.
 */
import { withActor } from '../../packages/simplycms/src/db/index.ts';
import { applyProcessEnv, type ShowcaseEnv } from './env.mts';
import { assertPristine } from './guard.mts';

export async function seedShowcase(env: ShowcaseEnv): Promise<void> {
  applyProcessEnv(env);
  await withActor({ role: 'app_admin' }, (db) => assertPristine(db));
  // Наповнення — Task 6.
}
