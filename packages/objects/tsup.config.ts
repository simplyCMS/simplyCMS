import { defineConfig } from 'tsup';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/objects/index.ts',
    'src/ports/index.ts',
    'src/semver/index.ts',
  ],
  format: ['esm'],
  dts: { tsconfig: './tsconfig.json' },
  sourcemap: true,
  clean: true,
  treeshake: true,
  // Без code-splitting: кожен entry самодостатній (інакше .d.ts ре-експортує
  // з hash-чанка через .js → ламає moduleResolution:node у споживачів).
  splitting: false,
});
