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
  // 🔴 `target: esnext` обовʼязковий (знахідка пілота Task 3.1): за нижчого
  // таргета esbuild лоуерить `import.meta` у `var import_meta = {}`, і
  // опублікований dist падає на `{}.env.VITE_…` ще до першого запиту. Пакет
  // читає `import.meta.env` — форму треба ЗБЕРЕГТИ, щоб її замінив bundler
  // магазину.
  target: 'esnext',
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
