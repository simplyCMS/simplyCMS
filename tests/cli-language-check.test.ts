import { describe, expect, it, vi } from 'vitest';

// Збій імпорту ядра магазину: мокнуто лише межу `importFromStore`.
vi.mock('../packages/cli/src/store-core.mjs', () => ({
  importFromStore: async () => {
    throw new Error('Cannot find module simplycms/i18n');
  },
}));

import { languagePackCheck } from '../packages/cli/src/doctor-language-check.mjs';

describe('doctor language-packs: збій імпорту ядра', () => {
  it('warn (не skip) з причиною: сигнал про мови не ховається', async () => {
    const c = await languagePackCheck('/store', ['uk', 'pl']);
    expect(c.status).toBe('warn');
    expect(c.details).toContain('перевірку пакетів мов не виконано');
    expect(c.details).toContain('Cannot find module');
  });
});
