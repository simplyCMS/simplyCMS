import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  declareStoreLocale,
  getStoreLocale,
  resetStoreLocale,
} from '../store-locale';

describe('локаль магазину', () => {
  afterEach(() => {
    resetStoreLocale();
    vi.restoreAllMocks();
  });

  it('незадекларована: uk і рівно одне попередження за два виклики', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(getStoreLocale()).toBe('uk');
    expect(getStoreLocale()).toBe('uk');
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('задекларована: повертається без попередження', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    declareStoreLocale('en');
    expect(getStoreLocale()).toBe('en');
    expect(warn).not.toHaveBeenCalled();
  });
});
