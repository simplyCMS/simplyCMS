import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

const pkg = (p: string) => resolve(__dirname, 'packages', p);

// Окремий конфіг для тестів: @vitejs/plugin-react (а не tanstackStart, що
// SSR-трансформує і ламає hook-тести) + дедуп React + ті самі workspace-аліаси,
// що й у vite.config.ts.
export default defineConfig({
  plugins: [react()],
  resolve: {
    dedupe: ['react', 'react-dom', '@tanstack/react-query'],
    alias: {
      '@simplycms/plugin-faq': pkg('simplycms-plugin-faq/src'),
      '@simplycms/theme-solarstore': pkg('simplycms-theme-solarstore/src'),
      // 🔴 Навмисно `resolve`, а не хелпер `pkg`: рядок у лапках, що
      // починається з імені флагмана й слеша, audit-exports читає як
      // субшлях-специфікатор ядра й вимагає для нього ключ у exports.
      simplycms: resolve(__dirname, 'packages/simplycms/src'),
      '@themes': resolve(__dirname, 'themes'),
      '@plugins': resolve(__dirname, 'plugins'),
    },
  },
  test: {
    environment: 'node',
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.output/**',
      '**/package/**', // витяги npm/pnpm pack
      // Packaging-suite: пакує кожен пакет через `pnpm pack`, тому вимагає
      // попереднього `pnpm build:packages`. У `pnpm test` не входить —
      // запускається окремим CI-job-ом `packaging`.
      'tests/published-exports-parity.test.ts',
      // Смоук tarball-а скаффолдера: місце — саме релізний ланцюг
      // (`test:packaging`), бо job `publish` не запускає `pnpm test`.
      'tests/create-store-pack.test.ts',
      // Смоук tarball-а @simplycms/cli (Gate TOOL): та сама логіка — гейт
      // опублікованого артефакту живе в релізному ланцюзі.
      'tests/cli-pack.test.ts',
      // Гард лоуереного `import.meta` у dist: читає артефакт збірки, тому
      // без `pnpm build:packages` перевіряв би вчорашній (або порожній) dist.
      'tests/dist-import-meta.test.ts',
      // Playwright-специ (`*.e2e.ts`) — окремий раннер `pnpm test:e2e`
      // (`playwright.config.ts`), не vitest. Розширення `.e2e.ts` vitest і так
      // не підхоплює (include матчить лише `.test.`/`.spec.`), запис тут —
      // явний, а не мовчазний збіг конвенцій.
      'tests/e2e/**',
    ],
  },
});
