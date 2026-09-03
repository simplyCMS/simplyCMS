import { defineConfig, type UserConfig } from 'tsdown';

// 🔴 ДВА конфіги, а не один із двома entry: декларації тут емітить бандлер
// (`dts: true`), і спільний d.ts-чанк між `index` і `pages/FaqAdmin`
// ре-експортував би типи через відносний файл — саме те, що гейт
// `dist-server-boundary` забороняє для .d.ts сателітів. Збірка з одним
// входом не має з чим ділити.
const base = {
  format: ['esm'],
  // Той самий platform, що був дефолтом tsup: builtins Node зовнішні без
  // попереджень, а в браузер код їде лише через бандлер магазину.
  // `fixedExtension` при platform node дав би `.mjs` повз exports.
  platform: 'node',
  fixedExtension: false,
  // Ядро приїжджає до магазину окремим пакетом; вбудовувати його копію
  // означало б дубль React-контекстів. `external` у tsdown deprecated.
  deps: { neverBundle: [/^simplycms(\/|$)/, /^@simplycms\//] },
  dts: true,
  tsconfig: './tsconfig.json',
  sourcemap: true,
  target: 'esnext',
  // tsdown чистить outDir ОДИН раз для всього масиву конфігів, до першого
  // запису (мемоізований cleanOutDir) — гонки між конфігами немає.
  clean: true,
} satisfies UserConfig;

export default defineConfig([
  { ...base, entry: { index: 'src/index.ts' } },
  { ...base, entry: { 'pages/FaqAdmin': 'src/pages/FaqAdmin.tsx' } },
]);
