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
  // 🔴 `sourcemap` тут не декор, а полагоджене висяче посилання. Топ-рівневий
  // `sourcemap: true` — це опція ВИХОДУ rolldown, і вона чіпляє коментар
  // `//# sourceMappingURL=<name>.d.ts.map` в тому числі на .d.ts-чанки; а самі
  // файли мап пише dts-плагін, чий власний `sourcemap` за замовчуванням
  // резолвиться з `compilerOptions.declarationMap` (у нашому tsconfig не
  // заданий → false) і в `generateBundle` ВИДАЛЯЄ .d.ts.map із бандла.
  // Наслідок до 2026-09-03: обидва опубліковані .d.ts посилались на файли,
  // яких у tarball немає, і жоден гейт цього не бачив (tsc, IDE, publint,
  // attw мовчать). Явне `true` вмикає запис мап; `src/` у `files` пакета вже
  // їде, тож go-to-definition із магазину веде в джерело.
  dts: { sourcemap: true },
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
