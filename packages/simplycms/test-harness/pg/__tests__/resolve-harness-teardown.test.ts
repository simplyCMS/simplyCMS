// Фінальне рев'ю М1, раунд 4 (R3-4): збій підготовки ролей на ефемерному шляху `resolveHarness`
// не лишає кластер-сироту. Кластер уже піднятий, а викликач `teardown` не отримує — тож гасить
// його сам `resolveHarness`. Без БД: обидва кроки підмінені.
import { afterEach, describe, expect, it, vi } from 'vitest';

const teardown = vi.fn(async () => {});

vi.mock('../ephemeral-cluster.mjs', () => ({
  startEphemeralCluster: vi.fn(async () => ({
    url: 'postgres://postgres@127.0.0.1:1/postgres',
    teardown,
  })),
}));
vi.mock('../roles.mjs', () => ({
  prepareClusterRoles: vi.fn(async () => {
    throw new Error('прелюдія впала');
  }),
}));

describe('resolveHarness: ефемерний кластер і збій підготовки ролей', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('помилка підготовки → кластер погашено, помилка та сама', async () => {
    // Порожнє значення = «не задано»: шлях ефемерного кластера.
    vi.stubEnv('PG_HARNESS_URL', '');
    const { resolveHarness } = await import('../up.mjs');
    await expect(resolveHarness()).rejects.toThrow('прелюдія впала');
    expect(teardown).toHaveBeenCalledOnce();
  });
});
