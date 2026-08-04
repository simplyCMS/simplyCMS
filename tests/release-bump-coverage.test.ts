import { describe, expect, it } from 'vitest';
import { readPublishableManifests } from '../scripts/release/bump.mjs';

// Гард синхронної моделі версій: реліз-бамп мусить бачити ВСІ публіковані
// пакети, інакше версії розійдуться на першому ж релізі після появи пакета.
describe('release bump: покриття манифестів', () => {
  it('бачить create-simplycms-store і всі @simplycms/*', () => {
    const names = readPublishableManifests().map(
      ({ manifest }) => manifest.name,
    );
    expect(names).toContain('create-simplycms-store');
    expect(
      names.filter((n) => n.startsWith('@simplycms/')).length,
    ).toBeGreaterThanOrEqual(21);
  });

  it('версія одна на всіх (синхронна модель)', () => {
    const versions = new Set(
      readPublishableManifests().map(({ manifest }) => manifest.version),
    );
    expect(versions.size).toBe(1);
  });
});
