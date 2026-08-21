import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/pages/FaqAdmin.tsx'],
  format: ['esm'],
  dts: true,
  // 🔴 `tsconfig` — ТОП-РІВНЕВИЙ ключ; у `DtsConfig` такого поля немає
  // (докладно — `packages/simplycms/tsup.config.ts`).
  tsconfig: './tsconfig.json',
  sourcemap: true,
  clean: true,
  treeshake: true,
  // Без code-splitting: кожен entry самодостатній (інакше .d.ts ре-експортує
  // з hash-чанка через .js → ламає moduleResolution:node у споживачів).
  splitting: false,
});
