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
  dts: true,
  tsconfig: './tsconfig.json',
  sourcemap: true,
  target: 'esnext',
  clean: true,
});
