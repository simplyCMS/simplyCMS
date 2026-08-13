import { defineConfig } from 'vitest/config';

// Окремий конфіг для packaging-suite (Task 1.4).
//
// Suite пакує кожен пакет ядра через `pnpm pack`, тому потребує попереднього
// `pnpm build:packages` — і саме тому `vitest.config.ts` (звичайний
// `pnpm test`) виключає цей файл. Запустити його «фільтром» не можна:
// у vitest 4 CLI-прапорець `--exclude` ДОПОВНЮЄ `test.exclude`, а не заміщає
// його, тож єдиний чесний спосіб — окремий конфіг.
//
// Аліаси й react-плагін не потрібні: тест читає лише tarball-и й manifest-и.
export default defineConfig({
  test: {
    environment: 'node',
    // Жорсткий список: сюди входить усе, що перевіряє ОПУБЛІКОВАНІ артефакти
    // (tarball-и), бо саме ця сюїта стоїть у релізному ланцюзі —
    // `pnpm release` і job `publish` у publish-packages.yml.
    include: [
      'tests/published-exports-parity.test.ts',
      'tests/create-store-pack.test.ts',
      'tests/cli-pack.test.ts',
    ],
    // Пакування — послідовне: `pnpm pack` на 20 пакетів паралельно тільки
    // б'ється за I/O і плутає вивід.
    fileParallelism: false,
    testTimeout: 300_000,
    hookTimeout: 300_000,
  },
});
