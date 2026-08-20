import { beforeAll, describe, expect, it } from 'vitest';
import {
  exportTargets,
  packPublishable,
  targetExists,
} from '../scripts/pack-inspect.mjs';

// Packaging-suite (Task 1.4). Перевіряє НЕ репозиторний `package.json`, а
// артефакт публікації: `pnpm pack` кожного пакета ядра → розбір `.tgz` →
// інваріанти опублікованого manifest-а:
//   (а) top-level `exports` — це publish-варіант (pnpm застосував publishConfig);
//   (б) кожна ціль export-а реально лежить у tarball-і (інакше споживач
//       дістане ERR_MODULE_NOT_FOUND уже після `pnpm install`);
//   (в) жодного `workspace:` у залежностях (pnpm мусив підставити версії).
//
// Не входить у `pnpm test`: потребує попереднього `pnpm build:packages`
// (див. `test.exclude` у vitest.config.ts). Запуск — CI-job `packaging`.

type Packed = ReturnType<typeof packPublishable>;
type Entry = {
  dir: string;
  source: Record<string, unknown>;
  manifest: Record<string, unknown>;
  files: string[];
};

let packed: Packed;

beforeAll(() => {
  packed = packPublishable();
}, 300_000);

const each = (assert: (name: string, entry: Entry) => void) => () => {
  for (const [name, entry] of packed) assert(name, entry as Entry);
};

describe('published packages: tarball parity', () => {
  it('пакетів для публікації знайдено', () => {
    // Поріг перехідний: К0 Task 2 злив дев'ять пакетів T0–T2 у флагман
    // (26 → 17), Task 3 замінить його ТОЧНИМ набором із пʼяти.
    expect(packed.size).toBeGreaterThanOrEqual(17);
    // К0: unscoped-флагман мусить проходити той самий гейт, що й сателіти.
    // Дискримінатор `pack-inspect` — `private === false` І імʼя ядра; без
    // явного `"private": false` пакет мовчки випадає з parity-suite (тест не
    // червоніє, просто нічого не перевіряє). Тому асерт саме на присутність.
    expect(packed.has('simplycms')).toBe(true);
  });

  it(
    'top-level exports у tarball-і = publishConfig.exports',
    each((name, { source, manifest }) => {
      const expected = (
        source.publishConfig as { exports?: Record<string, unknown> }
      )?.exports;
      expect(expected, `${name}: немає publishConfig.exports`).toBeDefined();
      expect(manifest.exports, `${name}: exports у tarball-і`).toEqual(
        expected,
      );
    }),
  );

  it(
    'main/types у tarball-і взяті з publishConfig',
    each((name, { source, manifest }) => {
      const pub = source.publishConfig as Record<string, unknown>;
      for (const key of ['main', 'types'] as const) {
        if (pub?.[key] === undefined) continue;
        expect(manifest[key], `${name}: ${key} у tarball-і`).toBe(pub[key]);
      }
    }),
  );

  it(
    'публікація йде на npmjs',
    each((name, { source }) => {
      const pub = source.publishConfig as { registry?: string };
      expect(pub?.registry, `${name}: registry`).toBe(
        'https://registry.npmjs.org',
      );
    }),
  );

  it(
    'пакет не лишився private',
    each((name, { manifest }) => {
      expect(manifest.private, `${name}: private`).not.toBe(true);
    }),
  );

  it(
    'кожна ціль export-а існує в tarball-і',
    each((name, { manifest, files }) => {
      const missing = exportTargets(manifest.exports).filter(
        (target: string) => !targetExists(files, target),
      );
      expect(missing, `${name}: цілі без файлу в tarball-і`).toEqual([]);
    }),
  );

  it(
    'main/types існують у tarball-і',
    each((name, { manifest, files }) => {
      const missing = (['main', 'types'] as const)
        .map((key) => manifest[key])
        .filter(
          (target): target is string =>
            typeof target === 'string' && !targetExists(files, target),
        );
      expect(missing, `${name}: main/types без файлу`).toEqual([]);
    }),
  );

  it(
    'жодного workspace: у залежностях tarball-а',
    each((name, { manifest }) => {
      const blocks = [
        'dependencies',
        'devDependencies',
        'peerDependencies',
        'optionalDependencies',
      ] as const;
      const leaked = blocks.flatMap((block) =>
        Object.entries(
          (manifest[block] as Record<string, string>) ?? {},
        ).filter(([, range]) => range.startsWith('workspace:')),
      );
      expect(leaked, `${name}: workspace-протокол`).toEqual([]);
    }),
  );
});
