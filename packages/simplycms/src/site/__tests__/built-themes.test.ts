import { describe, expect, it, vi } from 'vitest';

describe('реєстр вшитих тем', () => {
  it('до декларації isBuiltTheme → false (fail-closed), після — лише для задекларованих; повторний виклик замінює набір', async () => {
    vi.resetModules();
    // Свіжий екземпляр модуля: стан модульний, інші тести його не мають псувати.
    const m = await import('../built-themes');
    expect(m.isBuiltTheme('default')).toBe(false);

    m.declareBuiltThemes(['default']);
    expect(m.isBuiltTheme('default')).toBe(true);
    expect(m.isBuiltTheme('other')).toBe(false);

    m.declareBuiltThemes(['other']);
    expect(m.isBuiltTheme('default')).toBe(false);
    expect(m.isBuiltTheme('other')).toBe(true);
  });
});
