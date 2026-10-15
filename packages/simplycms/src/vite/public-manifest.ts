import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

/**
 * Маніфест верхньорівневих імен `public/` (Мультимовність М1, Task 5).
 *
 * `server.mjs` віддає статику з `dist/client` раніше за роутер, тож адреса
 * сутності з таким іменем (`/robots.txt`, `/favicon`) була б недосяжна.
 * Константою ці імена не покрити — вони різні в кожному магазині, тому збірка
 * пише їх файлом, а `publicNames()` (`simplycms/addressing`) читає. Лише
 * верхній рівень: вкладені файли (`/img/a.png`) займають сегмент `img`.
 */
export const PUBLIC_MANIFEST_FILE = '.simplycms-public.json';

/** Імена верхнього рівня теки; немає теки — порожній перелік. */
export function listPublicNames(publicDir: string): string[] {
  try {
    return readdirSync(publicDir).sort();
  } catch {
    return [];
  }
}

/** Пише маніфест у `outDir` і повертає його шлях. */
export function writePublicManifest(publicDir: string, outDir: string): string {
  const file = join(outDir, PUBLIC_MANIFEST_FILE);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(listPublicNames(publicDir))}\n`);
  return file;
}

/** Контекст хука Vite: з усього середовища потрібні лише ім'я, корінь і outDir. */
interface EnvironmentContext {
  environment?: {
    name: string;
    config: {
      root: string;
      publicDir?: string | false;
      build: { outDir: string };
    };
  };
}

/** Мінімальна форма плагіна Vite (ядро від `vite` не залежить). */
export interface PublicManifestPlugin {
  name: string;
  apply: 'build';
  writeBundle(this: EnvironmentContext): void;
}

/** Плагін збірки: після `writeBundle` клієнтського оточення пише маніфест. */
export function simplycmsPublicManifest(): PublicManifestPlugin {
  return {
    name: 'simplycms-public-manifest',
    apply: 'build',
    writeBundle() {
      const env = this.environment;
      if (env?.name !== 'client') return;
      const { root, publicDir, build } = env.config;
      writePublicManifest(
        typeof publicDir === 'string' ? publicDir : resolve(root, 'public'),
        resolve(root, build.outDir),
      );
    },
  };
}
