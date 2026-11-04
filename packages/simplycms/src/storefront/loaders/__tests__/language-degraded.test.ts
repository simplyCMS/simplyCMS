import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LanguageSummary } from 'simplycms/site';

/**
 * Деградований режим мови (§19.15, Д12, І46): опублікована мова без пакета дає ОДНЕ
 * попередження в лог на процес і мову. Мокнуто лише межі — читання мов з БД і кеш.
 */
const rows = vi.hoisted(() => ({ value: [] as LanguageSummary[] }));
vi.mock('../db', () => ({ withStorefrontDb: (fn: () => unknown) => fn() }));
vi.mock('simplycms/site', async (importOriginal) => ({
  ...(await importOriginal<typeof import('simplycms/site')>()),
  readLanguages: async () => rows.value,
  languagesCache: { get: (load: () => Promise<unknown>) => load() },
}));

const lang = (
  code: string,
  status: LanguageSummary['status'],
  isDefault = false,
): LanguageSummary => ({ code, name: code, status, isDefault, sortOrder: 0 });

describe('loadLocaleSet: сигнал деградованого режиму', () => {
  let warn: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    // Лічильник «вже попередили» живе в модулі: свіжий модуль на кожен кейс.
    vi.resetModules();
    warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => warn.mockRestore());

  it('опублікована pl без пакета → рівно одне попередження за два виклики', async () => {
    rows.value = [lang('uk', 'published', true), lang('pl', 'published')];
    const { loadLocaleSet } = await import('../languages');

    await loadLocaleSet();
    const set = await loadLocaleSet();

    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toContain('"pl"');
    // Магазин не падає: мова лишається в наборі опублікованих.
    expect(set.published).toContain('pl');
  });

  it('uk, en з пакетами, чернетка pl і вимкнена de → жодного попередження', async () => {
    rows.value = [
      lang('uk', 'published', true),
      lang('en', 'published'),
      lang('pl', 'draft'),
      lang('de', 'disabled'),
    ];
    const { loadLocaleSet } = await import('../languages');

    await loadLocaleSet();

    expect(warn).not.toHaveBeenCalled();
  });
});
