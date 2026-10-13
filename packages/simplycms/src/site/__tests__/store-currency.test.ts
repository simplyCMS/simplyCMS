import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  declareStoreCurrency,
  getStoreCurrency,
  resetStoreCurrency,
} from '../store-currency';

describe('валюта магазину', () => {
  afterEach(() => {
    resetStoreCurrency();
    vi.restoreAllMocks();
  });

  it('незадекларована: UAH і рівно одне попередження за два виклики', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(getStoreCurrency()).toBe('UAH');
    expect(getStoreCurrency()).toBe('UAH');
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('задекларована: повертається без попередження', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    declareStoreCurrency('USD');
    expect(getStoreCurrency()).toBe('USD');
    expect(warn).not.toHaveBeenCalled();
  });
});
