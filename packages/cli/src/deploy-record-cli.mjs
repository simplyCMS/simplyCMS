// simplycms deploy:record get|set — єдиний шлях скриптів скіла деплою до
// `.simplycms/deploy.json`: схему й валідатор тримає лише deploy-record.mjs, а скіли
// (вони живуть у пакеті ядра і CLI не імпортують) кличуть цю команду.
// Коди: 0 — гаразд; 3 — запису немає (get); 1 — помилка (невалідний запис чи ввід).
import { readFileSync } from 'node:fs';
import { findStoreRoot } from './context.mjs';
import {
  DEPLOY_RECORD_PATH,
  readDeployRecord,
  writeDeployRecord,
} from './deploy-record.mjs';

const USAGE = 'deploy:record: очікується get або set (set читає JSON зі stdin)';

/** @param {string[]} argv */
export async function run(argv) {
  if (argv.length !== 1 || !['get', 'set'].includes(argv[0]))
    throw new Error(USAGE);
  const storeRoot = findStoreRoot();
  if (argv[0] === 'get') {
    const record = readDeployRecord(storeRoot);
    if (record === null) {
      console.error(`${DEPLOY_RECORD_PATH}: запису розгортання ще немає`);
      return 3;
    }
    console.log(JSON.stringify(record, null, 2));
    return 0;
  }
  // Без перенаправленого вводу `set` чекав би на клавіатуру.
  if (process.stdin.isTTY)
    throw new Error(
      'deploy:record set: JSON читається зі stdin (… | simplycms deploy:record set)',
    );
  let input;
  try {
    input = JSON.parse(readFileSync(0, 'utf8'));
  } catch {
    throw new Error('deploy:record set: stdin не є JSON');
  }
  writeDeployRecord(storeRoot, input);
  console.log(`${DEPLOY_RECORD_PATH}: записано`);
  return 0;
}
