import { brotliCompressSync, constants, gzipSync } from 'node:zlib';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';

/**
 * Прекомпресія статики збірки (К3-Е8, Task 7).
 *
 * `server.mjs` віддає `sirv({ gzip: true, brotli: true })`, а той шукає
 * `<файл>.br` / `<файл>.gz` поруч з асетом — стискати на льоту не вміє. Вимір
 * на пілоті показав нуль: збірка таких файлів не кладе, тож 400 КБ входу
 * летіли клієнту сирими. Плагін дописує їх у `closeBundle` клієнтського
 * оточення, коли публічні файли вже скопійовано.
 */
export interface PrecompressOptions {
  /** Менші за це файли не стискаємо: виграш менший за ціну пошуку на диску. */
  minBytes?: number;
  exts?: readonly string[];
}

const DEFAULT_EXTS = ['.js', '.css', '.svg', '.json', '.txt', '.xml', '.html'];

/**
 * Стискає кожен підходящий файл теки; сусідній `.br`/`.gz` пишеться лише коли
 * стиснене менше за оригінал (інакше `sirv` віддав би більший файл).
 * Повертає кількість записаних файлів.
 */
export function precompressDir(
  dir: string,
  { minBytes = 1024, exts = DEFAULT_EXTS }: PrecompressOptions = {},
): number {
  let written = 0;
  const walk = (current: string): void => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const path = join(current, entry.name);
      if (entry.isDirectory()) {
        walk(path);
        continue;
      }
      if (!exts.includes(extname(entry.name))) continue;
      if (statSync(path).size < minBytes) continue;
      const source = readFileSync(path);
      const br = brotliCompressSync(source, {
        params: {
          [constants.BROTLI_PARAM_QUALITY]: 11,
          [constants.BROTLI_PARAM_SIZE_HINT]: source.length,
        },
      });
      if (br.length < source.length) {
        writeFileSync(`${path}.br`, br);
        written += 1;
      }
      const gz = gzipSync(source, { level: 9 });
      if (gz.length < source.length) {
        writeFileSync(`${path}.gz`, gz);
        written += 1;
      }
    }
  };
  walk(dir);
  return written;
}

/** Контекст хука Vite: з усього середовища потрібні лише ім'я, корінь і outDir. */
interface EnvironmentContext {
  environment?: {
    name: string;
    config: { root: string; build: { outDir: string } };
  };
}

/** Мінімальна форма плагіна Vite (ядро від `vite` не залежить). */
export interface PrecompressPlugin {
  name: string;
  apply: 'build';
  closeBundle(this: EnvironmentContext): void;
}

export function precompressAssets(
  options: PrecompressOptions = {},
): PrecompressPlugin {
  return {
    name: 'simplycms-precompress-assets',
    apply: 'build',
    closeBundle() {
      // Серверне оточення Start теж викликає closeBundle, але його вивід у
      // `dist/server` статикою не віддається.
      const env = this.environment;
      if (env?.name !== 'client') return;
      precompressDir(
        resolve(env.config.root, env.config.build.outDir),
        options,
      );
    },
  };
}
