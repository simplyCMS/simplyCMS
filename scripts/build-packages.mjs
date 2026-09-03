// Збірка публікованих пакетів ПІД КЕПОМ памʼяті — запобіжник, а не декор.
//
// 🔴 Навіщо кеп. 2026-08-24 збірка декларацій вичерпувала 9 ГБ heap: dts-плагін
// бандлера (rollup-plugin-dts у tsup, rolldown-plugin-dts у tsdown) тримає
// повну ts.Program — тоді по одній на КОЖНУ теку entry профілю (несталий
// dirName на cache-hit у getCompilerOptions), і всі живими до кінця збірки.
// Фікс — dts емітить `tsc -p tsconfig.dts.json` (вимір того ж дня: ~26 с /
// 1.1 ГБ; переміряно 2026-09-02 — 11 с / 1,1 ГБ). Кеп 3 ГБ
// гарантує, що регресія цього класу (наприклад, повернення `dts: true` у
// конфіг ядра tsdown) червоніє МИТТЄВО і тут само — у CI-job `packaging`,
// у гейтах `pnpm release` і локально, — а не через пів року на слабшому
// раннері. Дочірні процеси успадковують ліміт (перевірено вимером), тож кеп
// накриває і їх; native-памʼять Rolldown він не обмежує — її вимір у
// docs/architecture/test-contours.md.
//
// Другий запобіжник — стеля часу: повзуче здорожчання типів (нові serverFn,
// ширша схема) видно за wall-часом задовго до OOM.
//
// Константи стережуться tests/dts-toolchain.test.ts — не перейменовувати
// мовчки. Деталі й виміри — docs/architecture/test-contours.md,
// розділ «Бюджет памʼяті після tsdown».
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export const HEAP_CAP_MB = 3072;
export const WALL_CAP_SECONDS = 300;

// Виконання — ЛИШЕ при прямому запуску: константи вище імпортує
// tests/dts-toolchain.test.ts, і імпорт не має запускати збірку.
const runAsMain =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (runAsMain) main();

function main() {
  const startedAt = Date.now();
  const result = spawnSync(
    'pnpm',
    ['--filter', '@simplycms/*', '--filter', 'simplycms', 'run', 'build'],
    {
      stdio: 'inherit',
      env: {
        ...process.env,
        NODE_OPTIONS: [
          process.env.NODE_OPTIONS ?? '',
          `--max-old-space-size=${HEAP_CAP_MB}`,
        ]
          .join(' ')
          .trim(),
      },
    },
  );
  const wallSeconds = Math.round((Date.now() - startedAt) / 1000);

  if (result.status !== 0) {
    console.error(
      `\n🔴 build:packages не вклався в кеп ${HEAP_CAP_MB} МБ heap (див. вище).\n` +
        `Найімовірніша причина — декларації знову генерує бандлер ('dts: true'\n` +
        `у конфізі ядра tsdown): його dts-плагін тримає повну ts.Program на\n` +
        `весь пакет — 3 ГБ heap за 25 с (вимір 2026-09-02). Декларації мусить\n` +
        `видавати 'tsc -p tsconfig.dts.json' (крок build пакета ядра).\n` +
        `Деталі — docs/architecture/test-contours.md, «Бюджет памʼяті після tsdown».`,
    );
    process.exit(result.status ?? 1);
  }

  if (wallSeconds > WALL_CAP_SECONDS) {
    console.error(
      `\n🔴 build:packages зайняв ${wallSeconds} с — понад стелю ` +
        `${WALL_CAP_SECONDS} с (норма 2026-08-24 — ~60–90 с, запас ×3;\n` +
        `після переходу на tsdown вимір 2026-09-02 — 15–24 с, запас ×12–20).\n` +
        `Це раннє попередження про повзуче здорожчання типів або повернення\n` +
        `важкого dts-шляху. Розберись ЗАРАЗ — наступна зупинка цього поїзда\n` +
        `називається OOM у CI.`,
    );
    process.exit(1);
  }

  console.log(
    `build:packages: ok за ${wallSeconds} с під кепом ${HEAP_CAP_MB} МБ.`,
  );
}
