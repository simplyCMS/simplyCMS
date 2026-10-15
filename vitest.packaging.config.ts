import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

// Окремий конфіг для packaging-suite (Task 1.4).
//
// Suite пакує кожен пакет ядра через `pnpm pack`, тому потребує попереднього
// `pnpm build:packages` — і саме тому `vitest.config.ts` (звичайний
// `pnpm test`) виключає цей файл. Запустити його «фільтром» не можна:
// у vitest 4 CLI-прапорець `--exclude` ДОПОВНЮЄ `test.exclude`, а не заміщає
// його, тож єдиний чесний спосіб — окремий конфіг.
//
// React-плагін не потрібен: тести читають tarball-и, manifest-и й файли
// `dist` напряму, без JSX. Alias нижче — виняток лише для гейту партиції.
export default defineConfig({
  // Гейт не читає `.env*` розробника (Р31): див. пояснення у vitest.config.ts.
  envDir: false,
  // Один base-prefix ключ, як у vitest.config.ts: гейт партиції треку T
  // імпортує декларацію межі bare-субшляхом `simplycms/contracts/server-only`.
  // Тим самим специфікатором декларацію читає `tsdown.config.ts` ядра, а
  // `dts-toolchain` імпортує сам конфіг — тож alias потрібен і йому.
  resolve: {
    alias: {
      simplycms: resolve(import.meta.dirname, 'packages/simplycms/src'),
    },
  },
  test: {
    environment: 'node',
    // Жорсткий список: сюди входить усе, що перевіряє ОПУБЛІКОВАНІ артефакти
    // (tarball-и), бо саме ця сюїта стоїть у релізному ланцюзі —
    // `pnpm release` і job `publish` у publish-packages.yml.
    include: [
      'tests/published-exports-parity.test.ts',
      'tests/create-store-pack.test.ts',
      // Оверлей-проба пілота не їде в tarball-и (склад — `npm pack --dry-run`, потрібен dist).
      'tests/pilot-probe-not-packed.test.ts',
      // Маніфест видалених файлів канону їде в tarball ядра (його читає CLI).
      'tests/removed-manifest-packed.test.ts',
      'tests/cli-pack.test.ts',
      // Гард форми `import.meta` у зібраному `dist` (див. шапку тесту):
      // потребує свіжого `pnpm build:packages`, тож місце — тут.
      'tests/dist-import-meta.test.ts',
      // Позитивний контроль того гейта: збірка фікстуру справжнім `base`.
      'tests/dist-import-meta-fixture.test.ts',
      // Структурний гард тулчейна декларацій (dts поза бандлером + кеп памʼяті):
      // ламається першим, коли хтось повертає `dts: true` чи знімає кеп.
      'tests/dts-toolchain.test.ts',
      // Партиція dist ядра на серверну й клієнтську групи + .d.ts сателітів
      // (трек T): ламається першою, коли серверний код потрапляє в чанк,
      // досяжний із клієнтського entry.
      'tests/dist-server-boundary.test.ts',
      // Справжня збірка з нестандартним `serverFns.base` (Р20′).
      'tests/server-fn-base-build.test.ts',
    ],
    // Пакування — послідовне: `pnpm pack` на 20 пакетів паралельно тільки
    // б'ється за I/O і плутає вивід.
    fileParallelism: false,
    testTimeout: 300_000,
    hookTimeout: 300_000,
  },
});
