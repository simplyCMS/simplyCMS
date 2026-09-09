import { defineConfig } from 'tsdown';

// Тема — один entry, тож питання спільних чанків не постає взагалі
// (на відміну від плагіна, див. його конфіг). Декларації емітить бандлер:
// поверхня типів теми — один `ThemeModule`, окремий крок tsc, як у ядрі,
// тут не потрібен. Опції — канон репо (див. plugin-faq).
export default defineConfig({
  entry: { index: 'src/index.ts' },
  format: ['esm'],
  platform: 'node',
  fixedExtension: false,
  deps: { neverBundle: [/^simplycms(\/|$)/, /^@simplycms\//] },
  // 🔴 `sourcemap` тут не декор, а полагоджене висяче посилання. Топ-рівневий
  // `sourcemap: true` — це опція ВИХОДУ rolldown, і вона чіпляє коментар
  // `//# sourceMappingURL=index.d.ts.map` в тому числі на .d.ts-чанк; а сам
  // файл мапи пише dts-плагін, чий власний `sourcemap` за замовчуванням
  // резолвиться з `compilerOptions.declarationMap` (у наших tsconfig не
  // заданий → false) і в `generateBundle` ВИДАЛЯЄ .d.ts.map із бандла.
  // Наслідок до 2026-09-03: опублікований .d.ts посилався на файл, якого в
  // tarball немає, і жоден гейт цього не бачив (tsc, IDE, publint, attw мовчать).
  // Явне `true` вмикає запис мапи; `src/` у `files` пакета вже їде, тож
  // go-to-definition із магазину веде в джерело.
  dts: { sourcemap: true },
  tsconfig: './tsconfig.json',
  sourcemap: true,
  target: 'esnext',
  clean: true,
});
