import { defineConfig } from 'tsup';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/keys.ts',
    'src/browser-client.ts',
    'src/server-client.ts',
    'src/anon-client.ts',
    'src/SupabaseProvider.tsx',
  ],
  format: ['esm'],
  dts: { tsconfig: './tsconfig.json' },
  sourcemap: true,
  clean: true,
  treeshake: true,
  // Спільні чанки: модулі зі станом (реєстри/singleton-клієнти) мусять
  // лишатися ОДНИМ інстансом для всіх subpath-entry пакета.
  splitting: true,
  // Сиблінги ядра — завжди зовнішні, включно з subpath-імпортами
  // (`@simplycms/ui/button`): регекс, а не список імен.
  external: [/^@simplycms\//],
});
