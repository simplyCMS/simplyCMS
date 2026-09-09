import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { settingsFields } from '../lib/pluginSettingsFields';

// Деривація форми налаштувань зі Zod-схеми definePlugin (конвенції Р2 плану
// Фази 3): describe→label, enum→select, default→значення за замовчуванням.

afterEach(() => {
  vi.restoreAllMocks();
});

describe('settingsFields', () => {
  it('number+default+describe, enum і boolean мапляться на контракти контролів', () => {
    const fields = settingsFields(
      z.object({
        maxVisible: z.number().int().default(5).describe('Max visible'),
        layout: z.enum(['list', 'grid']).default('list'),
        showBadge: z.boolean().default(true),
      }),
    );
    const byKey = Object.fromEntries(fields);

    expect(byKey.maxVisible).toMatchObject({
      type: 'integer',
      default: 5,
      description: 'Max visible',
    });
    expect(byKey.layout.enum).toEqual(['list', 'grid']);
    expect(byKey.showBadge.type).toBe('boolean');
  });

  it('збереження матеріалізує дефолти: safeParse торкнутого config дає повний обʼєкт', () => {
    // Той самий ланцюжок, що в handleSave: форма тримає лише торкнуті ключі,
    // а в БД їде повний config із дефолтами.
    const schema = z.object({
      maxVisible: z.number().int().default(5),
      badge: z.string().default('new'),
    });
    const parsed = schema.safeParse({ maxVisible: 12 });
    expect(parsed.success).toBe(true);
    expect(parsed.data).toEqual({ maxVisible: 12, badge: 'new' });

    // NaN-гард числового інпута: undefined-ключ теж падає в дефолт.
    const cleared = schema.safeParse({ maxVisible: undefined });
    expect(cleared.success && cleared.data.maxVisible).toBe(5);
  });

  it('непредставна для JSON Schema схема (z.date) — warn + порожня форма, НЕ виняток', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const fields = settingsFields(
      z.object({ since: z.date().default(new Date(0)) }),
    );
    expect(fields).toEqual([]);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('непредставна'),
      expect.anything(),
    );
  });

  it('без схеми — порожній список', () => {
    expect(settingsFields(undefined)).toEqual([]);
  });
});
