import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/PluginSlot.tsx', 'src/types.ts'],
  format: ['esm'],
  dts: { tsconfig: './tsconfig.json' },
  sourcemap: true,
  clean: true,
  treeshake: true,
  // Спільні чанки: `HookRegistry` — модуль зі станом, і `@simplycms/plugins`
  // та `@simplycms/plugins/PluginSlot` мусять бачити ОДИН реєстр.
  splitting: true,
  // Сиблінги ядра — завжди зовнішні, включно з subpath-імпортами: регекс.
  external: [/^simplycms(\/|$)/, /^@simplycms\//],
});
