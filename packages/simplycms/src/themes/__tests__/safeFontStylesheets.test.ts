import { describe, expect, it, vi } from 'vitest';
import { safeFontStylesheets } from '../safeFontStylesheets';

describe('safeFontStylesheets', () => {
  it('пропускає валідний https: URL', () => {
    const urls = safeFontStylesheets([
      { stylesheet: 'https://fonts.googleapis.com/css2?family=Inter' },
    ]);

    expect(urls).toEqual(['https://fonts.googleapis.com/css2?family=Inter']);
  });

  it('відкидає http: (не https:)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const urls = safeFontStylesheets([
      { stylesheet: 'http://fonts.googleapis.com/css2?family=Inter' },
    ]);

    expect(urls).toEqual([]);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('відкидає відносний URL', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    expect(safeFontStylesheets([{ stylesheet: '/fonts/inter.css' }])).toEqual(
      [],
    );

    warn.mockRestore();
  });

  it('відкидає URL із лапками (спроба інʼєкції в href)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const urls = safeFontStylesheets([
      { stylesheet: 'https://fonts.googleapis.com/"><script>' },
    ]);

    expect(urls).toEqual([]);
    warn.mockRestore();
  });

  it('повертає порожній масив для не-масиву', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    expect(safeFontStylesheets(undefined)).toEqual([]);
    expect(safeFontStylesheets(null)).toEqual([]);
    expect(safeFontStylesheets('https://fonts.googleapis.com')).toEqual([]);
    expect(safeFontStylesheets({})).toEqual([]);

    warn.mockRestore();
  });

  it('повертає порожній масив для порожнього fonts', () => {
    expect(safeFontStylesheets([])).toEqual([]);
  });

  it('пропускає лише валідні записи, відкидаючи биті серед валідних', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const urls = safeFontStylesheets([
      { stylesheet: 'https://fonts.googleapis.com/css2?family=Inter' },
      { stylesheet: 'not-a-url' },
      { stylesheet: 42 },
      {},
      null,
    ]);

    expect(urls).toEqual(['https://fonts.googleapis.com/css2?family=Inter']);
    expect(warn).toHaveBeenCalledTimes(4);
    warn.mockRestore();
  });
});
