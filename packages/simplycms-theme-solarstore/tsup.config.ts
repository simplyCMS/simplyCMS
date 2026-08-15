import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: { tsconfig: './tsconfig.json' },
  sourcemap: true,
  clean: true,
  treeshake: true,
  // Тема — пасивний модуль без спільного singleton-стану між entry, тож
  // code-splitting не потрібен (та сама причина, що в plugin-faq: спільний
  // hash-чанк ре-експортував би типи через .js і ламав moduleResolution:node).
  splitting: false,
  // Ядро приїжджає до магазину окремими пакетами — вбудовувати його копію
  // в бандл теми означало б дубль React-контекстів (SupabaseProvider тощо).
  external: [/^@simplycms\//],
});
