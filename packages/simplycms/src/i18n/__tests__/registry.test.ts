import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Реєстр має модульний кеш, тож кожен тест бере свіжий граф модулів
 * (`vi.resetModules`): інакше проміс одного тесту підмінив би лоадер наступного.
 */
async function fresh() {
  vi.resetModules();
  const registry = await import('../registry');
  const { getUiPack } = await import('../packs');
  const { resolveUiLocale } = await import('../ui-locale');
  const { checkedContentLocale } =
    await import('simplycms/domain/translations');
  const uk = resolveUiLocale(
    checkedContentLocale('uk'),
    checkedContentLocale('uk'),
  );
  return { ...registry, uk, pack: getUiPack(uk) };
}

beforeEach(() => vi.resetModules());
afterEach(() => vi.restoreAllMocks());

describe('loadUiCatalog', () => {
  it('два виклики віддають ТОЙ САМИЙ проміс (React use() вимагає стабільну референцію)', async () => {
    const { loadUiCatalog, uk } = await fresh();

    expect(loadUiCatalog(uk, 'base')).toBe(loadUiCatalog(uk, 'base'));
  });

  it('лоадер, що впав, не кешується: наступний виклик повторює завантаження', async () => {
    const { loadUiCatalog, uk, pack } = await fresh();
    const loader = vi
      .spyOn(pack.ui, 'base')
      .mockRejectedValueOnce(new Error('chunk 503'));

    await expect(loadUiCatalog(uk, 'base')).rejects.toThrow('chunk 503');
    const retry = loadUiCatalog(uk, 'base');

    expect(loader).toHaveBeenCalledTimes(2);
    expect((await retry)['common.save']).toBe('Зберегти');
  });

  it('частина admin не вантажиться, доки її не попросили', async () => {
    const { loadUiCatalog, uk, pack } = await fresh();
    const admin = vi.spyOn(pack.ui, 'admin');
    const mail = vi.spyOn(pack.ui, 'mail');

    await loadUiCatalog(uk, 'base');
    expect(admin).not.toHaveBeenCalled();
    expect(mail).not.toHaveBeenCalled();

    await loadUiCatalog(uk, 'admin');
    expect(admin).toHaveBeenCalledTimes(1);
  });

  it('завантажена частина розгортається синхронно (status fulfilled)', async () => {
    const { loadUiCatalog, uk } = await fresh();
    const promise = loadUiCatalog(uk, 'base');
    await promise;

    expect(promise.status).toBe('fulfilled');
  });
});

describe('loadTranslator', () => {
  it('loadTranslator вантажить лише названі частини', async () => {
    const { loadTranslator, uk, pack } = await fresh();
    const admin = vi.spyOn(pack.ui, 'admin');

    const t = await loadTranslator(uk, ['base', 'mail']);

    expect(t('mail.reset.subject', { storeName: 'Х' })).toContain('Х');
    expect(admin).not.toHaveBeenCalled();
  });
});
