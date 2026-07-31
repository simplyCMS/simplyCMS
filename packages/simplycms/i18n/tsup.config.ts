import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: { tsconfig: './tsconfig.json' },
  sourcemap: true,
  clean: true,
  treeshake: true,
  // Один entry — ділити нічого.
  splitting: false,
  // Сиблінги ядра — завжди зовнішні, включно з subpath-імпортами
  // (`@simplycms/ui/button`): регекс, а не список імен.
  external: [/^@simplycms\//],
});
