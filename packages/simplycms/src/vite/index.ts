/**
 * 🔴 Server-only (contracts/server-only): допоміжні плагіни Vite для ЗБІРКИ
 * магазину (Node). Клієнтський код цей субшлях не імпортує.
 */
import { resolveBuildId } from './build-id';

export { resolveBuildId } from './build-id';
export type { BuildIdEnv, BuildIdContext } from './build-id';
export { precompressAssets, precompressDir } from './precompress';
export type { PrecompressOptions, PrecompressPlugin } from './precompress';
export {
  PUBLIC_MANIFEST_FILE,
  listPublicNames,
  simplycmsPublicManifest,
  writePublicManifest,
} from './public-manifest';
export type { PublicManifestPlugin } from './public-manifest';

/**
 * Мінімальна форма плагіна Vite: ядро не залежить від `vite`, а структурна
 * сумісність із `Plugin` досить, щоб покласти значення в `plugins: [...]`.
 */
export interface BuildInfoPlugin {
  name: string;
  config(
    userConfig: { root?: string },
    env: { command: string },
  ): { define: Record<string, string> };
}

/**
 * Вшиває ідентифікатор збірки в код глобалом `__SIMPLYCMS_BUILD_ID__`
 * (читає `simplycms/runtime/build-id`). Чи доходить `define` до коду ядра в
 * `node_modules`, доводить Gate B пілота (`/api/health.build`).
 */
export function simplycmsBuildInfo(): BuildInfoPlugin {
  return {
    name: 'simplycms-build-info',
    config(userConfig, { command }) {
      const id = resolveBuildId(process.env, {
        command,
        cwd: userConfig.root ?? process.cwd(),
      });
      return { define: { __SIMPLYCMS_BUILD_ID__: JSON.stringify(id) } };
    },
  };
}
