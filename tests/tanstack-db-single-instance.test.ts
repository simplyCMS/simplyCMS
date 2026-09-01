import { execSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

/**
 * Два інстанси @tanstack/db у дереві — найгірший клас дефекту: колекція
 * створена одним, useLiveQuery підписується через інший, підписки одна
 * одну не бачать, симптом далеко від причини (К3-10′). Патерн гейта —
 * як tests/dts-toolchain.test.ts: структурна властивість дерева.
 */
describe('рівно один @tanstack/db у дереві', () => {
  it('усі resolved-версії @tanstack/db збігаються', () => {
    const out = execSync('pnpm ls -r --depth Infinity @tanstack/db --json', {
      encoding: 'utf8', cwd: process.cwd(),
    });
    // 🔴 СТРУКТУРНИЙ обхід, не regex по "version": вивід — масив
    // workspace-проєктів, КОЖЕН зі своєю версією пакета (0.4.1, 1.0.0…) —
    // сирий скан рахував би їх «другою версією» і фейлив здорове дерево
    // (знахідка Codex r2 проти redакції з regex-ом).
    const versions = new Set<string>();
    const walk = (node: unknown): void => {
      if (!node || typeof node !== 'object') return;
      for (const [name, dep] of Object.entries(
        node as Record<string, { version?: string; dependencies?: unknown }>,
      )) {
        if (name === '@tanstack/db' && dep?.version) versions.add(dep.version);
        if (dep && typeof dep === 'object') walk((dep as { dependencies?: unknown }).dependencies);
      }
    };
    for (const project of JSON.parse(out) as Array<Record<string, unknown>>) {
      for (const key of ['dependencies', 'devDependencies', 'peerDependencies'] as const)
        walk(project[key]);
    }
    expect(versions.size, 'у дереві немає @tanstack/db взагалі — гейт вхолосту').toBeGreaterThan(0);
    expect([...versions], 'дерево тримає кілька версій @tanstack/db').toHaveLength(1);
  });
});
